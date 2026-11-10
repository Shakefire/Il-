"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import {
  X,
  Check,
  Lock,
  Key,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  Clock,
  Mail,
} from "lucide-react"
import { Property } from "@/types"
import { formatNaira, calculateNights, calculatePaystackFee } from "@/lib/utils"
import { guestReservationOutcome } from "@/lib/phase11-guest-outcome"
import { guestFlowError } from "@/lib/phase13-guest-errors"
import { GuestMessages } from "@/lib/guest-messages"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"

type FlowStep =
  | "review"
  | "guest"
  | "waiting_host"
  | "payment"
  | "confirmed"
  | "terminal"

interface BookingModalProps {
  property: Property
  isOpen: boolean
  onClose: () => void
  checkIn: string
  checkOut: string
  guests: number
}

interface ConfirmedBookingDetails {
  id: string
  reference: string
  totalPrice: number
  contactDetails?: {
    exactAddress: string
    unitNumber?: string
    accessGateCode?: string
    checkInInstructions?: string
    hostName: string
    hostPhone: string
    hostEmail: string
  }
}

const UNPAID_STATUSES = new Set(["PENDING_HOST", "PAYMENT_PENDING", "PENDING"])
const POLL_MS = 4000
const MAX_POLLS = 90

const secondsUntil = (iso: string | null | undefined): number => {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((t - Date.now()) / 1000))
}

const formatCountdown = (totalSeconds: number): string => {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}s`
  return `${m}:${r.toString().padStart(2, "0")}`
}

export default function BookingModal({
  property,
  isOpen,
  onClose,
  checkIn,
  checkOut,
  guests,
}: BookingModalProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<FlowStep>("review")
  const [guestName, setGuestName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null)
  const [serverBooking, setServerBooking] = useState<any>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [hostDeadlineAt, setHostDeadlineAt] = useState<string | null>(null)
  const [paymentDeadlineAt, setPaymentDeadlineAt] = useState<string | null>(null)
  const [hostSecondsLeft, setHostSecondsLeft] = useState(0)
  const [paySecondsLeft, setPaySecondsLeft] = useState(0)
  const [confirmedData, setConfirmedData] = useState<ConfirmedBookingDetails | null>(null)
  const pollCountRef = useRef(0)
  const abandonedRef = useRef(false)

  const nights = calculateNights(checkIn, checkOut)
  const minNights = property.minimumNights ?? 1
  const clientStayCost = property.pricePerNight * nights
  const clientProcessingFee = calculatePaystackFee(clientStayCost)
  const clientTotal = clientStayCost + clientProcessingFee
  const displayTotal = serverBooking?.totalPrice ?? serverBooking?.totalAmount ?? clientTotal

  const resetLocal = () => {
    setStep("review")
    setServerBooking(null)
    setAccessToken(null)
    setHostDeadlineAt(null)
    setPaymentDeadlineAt(null)
    setConfirmedData(null)
    setErrorMessage(null)
    setTerminalMessage(null)
    pollCountRef.current = 0
    abandonedRef.current = false
  }

  const persistGuestBooking = (booking: any) => {
    try {
      const stored = JSON.parse(localStorage.getItem("ile_guest_bookings") || "[]")
      const merged = [booking, ...stored.filter((b: any) => b.id !== booking.id)]
      localStorage.setItem("ile_guest_bookings", JSON.stringify(merged.slice(0, 20)))
    } catch {
      /* ignore */
    }
  }

  const applyStatusFromBooking = useCallback((booking: any, token?: string | null) => {
    const status = booking?.status || booking?.bookingStatus
    const tokenValue = token || booking?.accessToken || accessToken
    if (tokenValue) setAccessToken(tokenValue)
    setServerBooking(booking)
    persistGuestBooking(booking)

    if (status === "PENDING_HOST") {
      const deadline =
        booking.hostResponseDeadlineAt ||
        booking.timers?.hostResponseDeadlineAt ||
        hostDeadlineAt
      if (deadline) setHostDeadlineAt(deadline)
      setStep("waiting_host")
      return
    }
    if (status === "PAYMENT_PENDING") {
      const deadline = booking.paymentDeadlineAt || paymentDeadlineAt
      if (deadline) setPaymentDeadlineAt(deadline)
      setStep("payment")
      return
    }
    if (status === "CONFIRMED" || status === "COMPLETED") {
      setStep("confirmed")
      return
    }
    if (status === "CANCELLED" || status === "FAILED") {
      const outcome = guestReservationOutcome({
        status,
        cancellationReason: booking.cancellationReason,
        hostResponse: booking.hostResponse,
      })
      setTerminalMessage(`${outcome.headline}. ${outcome.body}`)
      setStep("terminal")
    }
  }, [accessToken, hostDeadlineAt, paymentDeadlineAt])

  const refreshBooking = useCallback(async () => {
    if (!serverBooking?.id) return null
    try {
      const res = await api.getBooking(serverBooking.id, accessToken || undefined)
      const booking = res.booking || res
      applyStatusFromBooking(booking, accessToken)
      return booking
    } catch (err: any) {
      setErrorMessage(err.message || "Could not refresh reservation status.")
      return null
    }
  }, [serverBooking?.id, accessToken, applyStatusFromBooking])

  useEffect(() => {
    if (user && isOpen) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ")
      if (fullName) setGuestName(fullName)
      if (user.email) setGuestEmail(user.email)
      if (user.phone) setGuestPhone(user.phone)
    }
  }, [user, isOpen])

  // Display-only countdowns — never invent status when they hit 0
  useEffect(() => {
    if (!isOpen) return
    if (step !== "waiting_host" && step !== "payment") return
    const tick = () => {
      if (step === "waiting_host") setHostSecondsLeft(secondsUntil(hostDeadlineAt))
      if (step === "payment") setPaySecondsLeft(secondsUntil(paymentDeadlineAt))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [isOpen, step, hostDeadlineAt, paymentDeadlineAt])

  // Bounded status polling while waiting / paying
  useEffect(() => {
    if (!isOpen) return
    if (step !== "waiting_host" && step !== "payment") return
    if (!serverBooking?.id) return

    pollCountRef.current = 0
    const id = window.setInterval(async () => {
      if (pollCountRef.current >= MAX_POLLS) {
        window.clearInterval(id)
        return
      }
      pollCountRef.current += 1
      await refreshBooking()
    }, POLL_MS)

    const onFocus = () => {
      void refreshBooking()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshBooking()
    })

    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [isOpen, step, serverBooking?.id, refreshBooking])

  // When countdown hits 0, refresh once (backend is SoT)
  useEffect(() => {
    if (step === "waiting_host" && hostDeadlineAt && hostSecondsLeft === 0) {
      void refreshBooking()
    }
    if (step === "payment" && paymentDeadlineAt && paySecondsLeft === 0) {
      void refreshBooking()
    }
  }, [step, hostSecondsLeft, paySecondsLeft, hostDeadlineAt, paymentDeadlineAt, refreshBooking])

  const handleClose = async () => {
    const canCancel =
      serverBooking?.id &&
      (accessToken || serverBooking.accessToken) &&
      UNPAID_STATUSES.has(serverBooking.status || serverBooking.bookingStatus || "") &&
      step !== "confirmed"

    if (canCancel && !abandonedRef.current) {
      abandonedRef.current = true
      try {
        await api.cancelBooking(
          serverBooking.id,
          accessToken || serverBooking.accessToken,
          "Guest closed booking modal before completing flow."
        )
      } catch {
        /* best-effort; expire job handles stale holds */
      }
    }
    resetLocal()
    onClose()
  }

  const handleCreateReservation = async () => {
    setErrorMessage(null)
    if (nights < minNights) {
      setErrorMessage(
        `Minimum stay for this property is ${minNights} night${minNights === 1 ? "" : "s"}.`
      )
      return
    }
    if (guests > (property.maxGuests || 16)) {
      setErrorMessage(`This stay allows up to ${property.maxGuests} guests.`)
      return
    }

    const parts = guestName.trim().split(/\s+/)
    const firstName = parts[0] || "Guest"
    const lastName = parts.slice(1).join(" ") || "User"

    setIsProcessing(true)
    try {
      const res = await api.createBooking({
        propertyId: property.id,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || "+2348000000000",
        guestCount: guests,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      })

      const booking = res.booking
      const token = res.accessToken || booking?.accessToken
      setAccessToken(token || null)
      const deadline =
        res.timers?.hostResponseDeadlineAt ||
        booking?.hostResponseDeadlineAt ||
        null
      if (deadline) setHostDeadlineAt(deadline)
      applyStatusFromBooking(booking, token)
    } catch (err: unknown) {
      const flow = guestFlowError(err, "request")
      setErrorMessage(`${flow.title}. ${flow.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePay = async () => {
    if (!serverBooking?.id) return
    setErrorMessage(null)
    setIsProcessing(true)

    try {
      // Re-check status before init — never pay on PENDING_HOST
      const latest = await api.getBooking(serverBooking.id, accessToken || undefined)
      const booking = latest.booking || latest
      const status = booking.status || booking.bookingStatus
      if (status === "PENDING_HOST") {
        setErrorMessage("Payment is not available until the host accepts this reservation.")
        applyStatusFromBooking(booking, accessToken)
        return
      }
      if (status !== "PAYMENT_PENDING") {
        applyStatusFromBooking(booking, accessToken)
        setErrorMessage(
          status === "PENDING_HOST" || status === "PENDING"
            ? "Payment opens after the host accepts your request."
            : "This booking is not ready for payment yet."
        )
        return
      }
      if (booking.paymentDeadlineAt) setPaymentDeadlineAt(booking.paymentDeadlineAt)

      const token = accessToken || booking.accessToken
      const initRes = await api.initializePayment(serverBooking.id, token)
      if (!initRes || !initRes.success) {
        throw new Error(initRes?.error || "Failed to initialize payment gateway.")
      }

      if (initRes.authorizationUrl && initRes.authorizationUrl.startsWith("http")) {
        try {
          const stored = JSON.parse(localStorage.getItem("ile_guest_bookings") || "[]")
          const merged = [
            { ...booking, accessToken: token },
            ...stored.filter((b: any) => b.id !== booking.id),
          ]
          localStorage.setItem("ile_guest_bookings", JSON.stringify(merged.slice(0, 20)))
        } catch {
          /* ignore */
        }
        window.location.href = initRes.authorizationUrl
        return
      }

      // Authoritative verify via backend (not client callback alone)
      const verifyRes = await api.verifyPayment(initRes.reference)
      if (!verifyRes || !verifyRes.verified) {
        throw new Error(verifyRes?.error || "Payment was not verified by Paystack gateway.")
      }

      const contactRes = await api.getBookingContact(serverBooking.id, token)
      const contact = contactRes.contact || contactRes

      setConfirmedData({
        id: serverBooking.id,
        reference:
          booking.referenceCode ||
          serverBooking.referenceCode ||
          `ILE-${serverBooking.id.slice(-6).toUpperCase()}`,
        totalPrice: booking.totalAmount || serverBooking.totalPrice || displayTotal,
        contactDetails: contact
          ? {
              exactAddress: contact.exactAddress || contact.address,
              unitNumber: contact.unitNumber,
              accessGateCode: contact.accessGateCode,
              checkInInstructions: contact.checkInInstructions,
              hostName: contact.hostName || contact.contactName,
              hostPhone: contact.hostPhone || contact.contactPhone,
              hostEmail: contact.hostEmail || contact.contactEmail,
            }
          : undefined,
      })
      setStep("confirmed")
    } catch (err: unknown) {
      const flow = guestFlowError(err, "payment")
      setErrorMessage(`${flow.title}. ${flow.message}`)
      await refreshBooking()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancelUnpaid = async () => {
    if (!serverBooking?.id) return
    const confirmed = window.confirm(
      `${GuestMessages.unpaidCancelTitle}\n\n${GuestMessages.unpaidCancelBody}`
    )
    if (!confirmed) return
    setIsProcessing(true)
    setErrorMessage(null)
    try {
      await api.cancelBooking(
        serverBooking.id,
        accessToken || serverBooking.accessToken,
        "Guest cancelled before payment."
      )
      abandonedRef.current = true
      setTerminalMessage("Booking request cancelled.")
      setStep("terminal")
    } catch (err: any) {
      setErrorMessage(err.message || "Could not cancel reservation.")
      await refreshBooking()
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  const stepLabel = (() => {
    switch (step) {
      case "review":
        return "Confirm your stay"
      case "guest":
        return "Guest information"
      case "waiting_host":
        return GuestMessages.confirmingStayHeadline
      case "payment":
        return GuestMessages.paymentWaitingHeadline
      case "confirmed":
        return "Reservation confirmed"
      case "terminal":
        return "Reservation closed"
      default:
        return GuestMessages.bookNow
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E7E5E0] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-[#E7E5E0] flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Request stay
            </span>
            <h3 className="font-display text-xl sm:text-2xl text-[#171717] font-normal">
              {stepLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-[#8B8B86] hover:text-[#171717] rounded-full hover:bg-[#FAFAF8] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <div
            className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700"
            role="alert"
          >
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6">
          {step === "review" && (
            <div className="space-y-6">
              <div className="flex gap-4 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0]/60">
                <div className="relative w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-[#E7E5E0]">
                  <Image
                    src={property.coverImage}
                    alt={property.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-[16px] font-medium text-[#171717]">{property.title}</h4>
                  <p className="text-[13px] text-[#6B6B67]">
                    {property.neighborhood}, {property.city}
                  </p>
                  <p className="text-[13px] text-[#171717] pt-1">
                    {property.bedrooms} bedrooms · {guests} guests
                  </p>
                </div>
              </div>

              <div className="border border-[#E7E5E0] rounded-xl p-4 divide-y divide-[#E7E5E0]/60 space-y-3">
                <div className="flex justify-between items-center text-[15px]">
                  <span className="text-[#6B6B67]">Dates</span>
                  <span className="font-medium text-[#171717]">
                    {new Date(checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    —{" "}
                    {new Date(checkOut).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="pt-3 flex justify-between items-center text-[15px]">
                  <span className="text-[#6B6B67]">Length of stay</span>
                  <span className="font-medium text-[#171717]">
                    {nights} {nights === 1 ? "night" : "nights"}
                    {minNights > 1 ? ` (min ${minNights})` : ""}
                  </span>
                </div>
                <div className="pt-3 flex justify-between items-center text-[15px]">
                  <span className="text-[#6B6B67]">Guests</span>
                  <span className="font-medium text-[#171717]">
                    {guests} {guests === 1 ? "guest" : "guests"}
                    {property.maxGuests ? ` / ${property.maxGuests} max` : ""}
                  </span>
                </div>
              </div>

              {nights < minNights && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  This listing requires at least {minNights} nights. Adjust your dates before continuing.
                </p>
              )}

              <div className="space-y-2.5 text-[15px]">
                <div className="flex justify-between text-[#6B6B67]">
                  <span>
                    {formatNaira(property.pricePerNight)} × {nights} nights
                  </span>
                  <span>{formatNaira(clientStayCost)}</span>
                </div>
                <div className="flex justify-between text-[#6B6B67]">
                  <span>Payment processing fee (Paystack)</span>
                  <span>{formatNaira(clientProcessingFee)}</span>
                </div>
                <div className="pt-3 border-t border-[#E7E5E0] flex justify-between font-semibold text-[17px] text-[#171717]">
                  <span>Estimated total (NGN)</span>
                  <span>{formatNaira(clientTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep("guest")}
                disabled={nights < minNights || guests < 1}
                className="w-full py-3.5 bg-[#065F46] text-white rounded-xl font-medium text-[15px] hover:bg-[#044E39] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                Continue to guest details →
              </button>
            </div>
          )}

          {step === "guest" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1" htmlFor="guest-name">
                  Full legal name
                </label>
                <input
                  id="guest-name"
                  type="text"
                  placeholder="e.g. Nnamdi Azikiwe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 text-[15px] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1" htmlFor="guest-email">
                  Email address
                </label>
                <input
                  id="guest-email"
                  type="email"
                  placeholder="nnamdi@example.ng"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#D1D5DB] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 text-[15px] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1" htmlFor="guest-phone">
                  Phone number (WhatsApp)
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3.5 rounded-xl border border-[#D1D5DB] bg-[#FAFAF8] text-[#171717] text-sm">
                    +234
                  </span>
                  <input
                    id="guest-phone"
                    type="tel"
                    placeholder="803 123 4567"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-[#D1D5DB] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 text-[15px] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("review")}
                  className="px-5 py-3 border border-[#D1D5DB] hover:border-[#9CA3AF] text-[#171717] rounded-xl hover:bg-[#FAFAF8] active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateReservation}
                  disabled={!guestName || !guestEmail || isProcessing}
                  className="flex-1 py-3 bg-[#065F46] disabled:opacity-50 text-white rounded-xl font-medium hover:bg-[#044E39] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Booking…</span>
                    </>
                  ) : (
                    <span>{GuestMessages.bookNow}</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "waiting_host" && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <Clock size={28} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-display text-2xl text-[#171717]">
                  {GuestMessages.confirmingStayHeadline}
                </h4>
                <p className="text-[14.5px] text-[#6B6B67]">
                  {GuestMessages.confirmingStayBody}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] inline-flex flex-col items-center gap-1 min-w-[160px] mx-auto">
                <span className="text-[11px] uppercase tracking-wider text-[#8B8B86] font-semibold">
                  Host reply window
                </span>
                <span className="font-mono text-2xl font-bold text-[#171717]" aria-live="polite">
                  {formatCountdown(hostSecondsLeft)}
                </span>
              </div>
              <p className="text-[13px] text-[#6B6B67]">
                We&apos;ll update this screen when the host responds. Ref:{" "}
                <span className="font-mono font-semibold text-[#171717]">
                  {serverBooking?.referenceCode || "—"}
                </span>
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void refreshBooking()}
                  className="w-full py-3 border border-[#D1D5DB] rounded-xl text-[14px] font-medium hover:bg-[#FAFAF8] min-h-[44px]"
                >
                  Refresh status
                </button>
                <button
                  type="button"
                  onClick={handleCancelUnpaid}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-[14px] font-medium text-[#6B6B67] hover:text-[#171717] min-h-[44px]"
                >
                  {GuestMessages.unpaidCancelConfirm}
                </button>
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-2">
                <Check size={16} className="shrink-0 mt-0.5" />
                <span>
                  <strong>{GuestMessages.acceptedHeadline}</strong>{" "}
                  {GuestMessages.paymentWaitingBody}
                </span>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0]/60">
                <div className="relative w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-[#E7E5E0]">
                  <Image
                    src={property.coverImage}
                    alt={property.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[15px] font-medium text-[#171717] truncate">{property.title}</h4>
                  <p className="text-[13px] text-[#6B6B67]">
                    {nights} {nights === 1 ? "night" : "nights"} · {guests}{" "}
                    {guests === 1 ? "guest" : "guests"}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl border border-[#E7E5E0]">
                <span className="text-[13px] text-[#6B6B67]">Payment window</span>
                <span className="font-mono font-bold text-[#171717]" aria-live="polite">
                  {formatCountdown(paySecondsLeft)}
                </span>
              </div>

              <div className="pt-2.5 border-t border-[#E7E5E0] flex justify-between font-semibold text-[17px] text-[#171717]">
                <span>Total due</span>
                <span>{formatNaira(displayTotal)}</span>
              </div>

              <div className="flex items-center gap-2.5 text-[12.5px] text-[#6B6B67]">
                <Lock size={14} className="text-[#065F46] shrink-0" />
                <span>Secure checkout. Your stay confirms after payment is verified.</span>
              </div>

              <div className="pt-1 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="w-full py-4 bg-[#065F46] text-white rounded-xl font-semibold text-[16px] hover:bg-[#044E39] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-sm disabled:opacity-60 cursor-pointer min-h-[44px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Connecting…</span>
                    </>
                  ) : (
                    <span>Pay {formatNaira(displayTotal)}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelUnpaid}
                  disabled={isProcessing}
                  className="w-full py-2.5 text-[14px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors cursor-pointer min-h-[44px]"
                >
                  {GuestMessages.unpaidCancelConfirm}
                </button>
              </div>
            </div>
          )}

          {step === "confirmed" && (
            <div className="text-center py-2 space-y-5">
              <div className="w-14 h-14 bg-[#EDF3F0] text-[#065F46] rounded-full flex items-center justify-center mx-auto">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-display text-2xl text-[#171717]">
                  Your stay is reserved &amp; confirmed
                </h4>
                <p className="text-[14.5px] text-[#6B6B67]">
                  Reservation reference:{" "}
                  <span className="font-mono font-bold text-[#171717]">
                    {confirmedData?.reference || serverBooking?.referenceCode || "ILE-CONFIRMED"}
                  </span>
                </p>
              </div>

              {confirmedData?.contactDetails && (
                <div className="p-4.5 rounded-xl bg-[#EDF3F0]/60 border border-[#065F46]/30 text-left space-y-3.5 text-[14px]">
                  <div className="flex items-center gap-2 text-[#065F46] font-semibold text-xs uppercase tracking-wider">
                    <Key size={14} />
                    <span>Your Arrival Details</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={16} className="text-[#065F46] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#171717]">Exact Property Address:</div>
                        <div className="text-[#4A4A45]">
                          {confirmedData.contactDetails.exactAddress}
                          {confirmedData.contactDetails.unitNumber
                            ? `, Unit ${confirmedData.contactDetails.unitNumber}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    {confirmedData.contactDetails.accessGateCode && (
                      <div className="flex items-start gap-2.5">
                        <Key size={16} className="text-[#065F46] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[#171717]">Estate Gate Pass Code:</div>
                          <div className="font-mono font-bold text-[#065F46] text-base">
                            {confirmedData.contactDetails.accessGateCode}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <Phone size={16} className="text-[#065F46] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#171717]">Host Direct Phone / WhatsApp:</div>
                        <div className="text-[#171717] font-medium">
                          {confirmedData.contactDetails.hostPhone} (
                          {confirmedData.contactDetails.hostName})
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[13px] text-[#8B8B86] flex items-center justify-center gap-1.5">
                <Mail size={14} />
                Confirmation emailed to{" "}
                <span className="font-medium text-[#171717]">{guestEmail || "your email"}</span>.
              </p>

              <button
                type="button"
                onClick={() => {
                  abandonedRef.current = true
                  resetLocal()
                  onClose()
                }}
                className="w-full py-3 bg-[#171717] text-white rounded-xl font-medium text-[15px] hover:bg-black active:scale-[0.99] transition-all cursor-pointer min-h-[44px]"
              >
                Done
              </button>
            </div>
          )}

          {step === "terminal" && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle size={28} className="mx-auto text-[#8B8B86]" />
              <p className="text-[15px] text-[#6B6B67]">{terminalMessage}</p>
              <button
                type="button"
                onClick={() => {
                  resetLocal()
                  onClose()
                }}
                className="w-full py-3 bg-[#171717] text-white rounded-xl font-medium min-h-[44px]"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
