"use client"

import { useState, useEffect } from "react"
import { Property } from "@/types"
import { formatNaira, calculateNights, getDefaultDates, getTodayISO, calculatePaystackFee } from "@/lib/utils"
import BookingModal from "./BookingModal"
import { Shield, Sparkles, ChevronLeft, ChevronRight, Calendar, Users, Zap, CheckCircle2, Sliders } from "lucide-react"

interface BookingPanelProps {
  property: Property
}

interface SearchContext {
  destination?: string
  apartmentType?: string
  powerPreference?: string
  bedrooms?: number
}

export default function BookingPanel({ property }: BookingPanelProps) {
  const minNights = Math.max(1, property.minimumNights ?? 1)
  const maxGuests = Math.max(1, property.maxGuests || 6)
  const defaultDates = getDefaultDates(Math.max(3, minNights))
  const [checkIn, setCheckIn] = useState(defaultDates.checkIn)
  const [checkOut, setCheckOut] = useState(defaultDates.checkOut)
  // Guest selection only — never substitute listing maxGuests as booked count
  const [guests, setGuests] = useState(Math.min(2, maxGuests))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchContext, setSearchContext] = useState<SearchContext>({})

  const todayISO = getTodayISO()

  // Inherit marketplace search criteria from URL query parameters or sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const urlParams = new URLSearchParams(window.location.search)
      let stored: Partial<SearchContext & { checkIn?: string; checkOut?: string; guests?: number }> = {}
      try {
        const raw = sessionStorage.getItem("ile_search_session")
        if (raw) stored = JSON.parse(raw)
      } catch {
        // ignore parse error
      }

      const paramCheckIn = urlParams.get("checkIn") || stored.checkIn
      const paramCheckOut = urlParams.get("checkOut") || stored.checkOut
      const paramGuests = urlParams.get("guests") || (stored.guests ? String(stored.guests) : null)
      const paramDest = urlParams.get("destination") || urlParams.get("location") || stored.destination
      const paramType = urlParams.get("type") || stored.apartmentType
      const paramPower = urlParams.get("power") || stored.powerPreference
      const paramBedrooms = urlParams.get("bedrooms") || (stored.bedrooms ? String(stored.bedrooms) : null)

      if (paramCheckIn && paramCheckIn >= todayISO) {
        setCheckIn(paramCheckIn)
        if (paramCheckOut && paramCheckOut > paramCheckIn) {
          setCheckOut(paramCheckOut)
        } else {
          const d = new Date(paramCheckIn)
          d.setDate(d.getDate() + minNights)
          setCheckOut(d.toISOString().split("T")[0])
        }
      }

      if (paramGuests) {
        const parsedG = parseInt(paramGuests, 10)
        if (!isNaN(parsedG) && parsedG >= 1) {
          setGuests(Math.min(maxGuests, parsedG))
        }
      }

      setSearchContext({
        destination: paramDest || undefined,
        apartmentType: paramType || undefined,
        powerPreference: paramPower || undefined,
        bedrooms: paramBedrooms ? parseInt(paramBedrooms, 10) : undefined,
      })
    } catch {
      // safe fallback
    }
  }, [maxGuests, minNights, todayISO])
  const nights = calculateNights(checkIn, checkOut)
  const stayCost = property.pricePerNight * nights
  const processingFee = calculatePaystackFee(stayCost)
  const total = stayCost + processingFee
  const nightsValid = nights >= minNights
  const guestsValid = guests >= 1 && guests <= maxGuests
  const canOpenModal = !property.isReserved && nightsValid && guestsValid

  const shiftDate = (dateStr: string, days: number): string => {
    try {
      const d = new Date(dateStr)
      d.setDate(d.getDate() + days)
      return d.toISOString().split("T")[0]
    } catch {
      return dateStr
    }
  }

  const handleShiftCheckIn = (days: number) => {
    const nextDate = shiftDate(checkIn, days)
    if (nextDate >= todayISO) {
      setCheckIn(nextDate)
      if (nextDate >= checkOut) {
        setCheckOut(shiftDate(nextDate, minNights))
      }
    }
  }

  const handleShiftCheckOut = (days: number) => {
    const nextDate = shiftDate(checkOut, days)
    if (nextDate > checkIn) {
      setCheckOut(nextDate)
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E7E5E0] p-5 sm:p-6 shadow-sm sticky lg:top-28">
        <div className="flex items-baseline justify-between pb-5 border-b border-[#E7E5E0]">
          <div>
            <span className="font-semibold text-2xl sm:text-3xl text-[#171717]">
              {formatNaira(property.pricePerNight)}
            </span>
            <span className="text-[#6B6B67] text-[15px]"> / night</span>
          </div>
          <div className="text-[12px] sm:text-[13px] text-[#0B5D45] font-semibold bg-[#EDF3F0] px-3 py-1 rounded-full flex items-center gap-1.5 border border-[#0B5D45]/15">
            <Sparkles size={13} />
            <span>Direct booking rate</span>
          </div>
        </div>

        <div className="mt-5 border border-[#E7E5E0] rounded-xl overflow-hidden divide-y divide-[#E7E5E0]">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E7E5E0]">
            <div className="p-3 bg-[#FAFAF8]/50">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B67] flex items-center gap-1">
                  <Calendar size={12} className="text-[#0B5D45]" />
                  <span>Check-in</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleShiftCheckIn(-1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Previous check-in day"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftCheckIn(1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Next check-in day"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={checkIn}
                min={todayISO}
                onChange={(e) => {
                  setCheckIn(e.target.value)
                  if (e.target.value >= checkOut) {
                    setCheckOut(shiftDate(e.target.value, minNights))
                  }
                }}
                className="w-full text-[14px] text-[#171717] font-semibold bg-transparent focus:outline-none pt-0.5 cursor-pointer"
              />
            </div>

            <div className="p-3 bg-[#FAFAF8]/50">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B6B67] flex items-center gap-1">
                  <Calendar size={12} className="text-[#0B5D45]" />
                  <span>Check-out</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleShiftCheckOut(-1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Previous check-out day"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftCheckOut(1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Next check-out day"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={checkOut}
                min={checkIn ? shiftDate(checkIn, minNights) : todayISO}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-[14px] text-[#171717] font-semibold bg-transparent focus:outline-none pt-0.5 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3.5 flex items-center justify-between bg-white">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B67] flex items-center gap-1">
                <Users size={12} className="text-[#0B5D45]" />
                <span>Guests</span>
              </label>
              <div className="text-[14px] text-[#171717] font-semibold mt-0.5">
                {guests} {guests === 1 ? "guest" : "guests"}
                <span className="text-[12px] font-normal text-[#8B8B86]"> · max {maxGuests}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-8 h-8 rounded-full border border-[#D5D3CC] flex items-center justify-center text-[#171717] hover:border-[#171717] active:scale-95 transition-all text-sm font-bold"
                aria-label="Decrease guests"
              >
                -
              </button>
              <span className="font-semibold text-sm min-w-[14px] text-center">{guests}</span>
              <button
                type="button"
                onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                className="w-8 h-8 rounded-full border border-[#D5D3CC] flex items-center justify-center text-[#171717] hover:border-[#171717] active:scale-95 transition-all text-sm font-bold"
                aria-label="Increase guests"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {!nightsValid && (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Minimum stay is {minNights} night{minNights === 1 ? "" : "s"}. You selected {nights}.
          </p>
        )}

        {/* Inherited Search Context & Compatibility Feedback */}
        <div className="mt-4 p-3 bg-[#F4F8F6] border border-[#0B5D45]/15 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-[#0B5D45]">
            <span className="flex items-center gap-1.5">
              <Sliders size={13} />
              <span>Search Criteria Inherited</span>
            </span>
            <span className="text-[11px] bg-white px-2 py-0.5 rounded-full border border-[#0B5D45]/20 text-[#0B5D45] font-medium">
              {searchContext.destination ? `Search: ${searchContext.destination}` : `${property.neighborhood}, ${property.city}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11.5px] text-[#2C4A3E]">
            <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-md border border-[#0B5D45]/10">
              <CheckCircle2 size={12} className="text-[#0B5D45] shrink-0" />
              <span className="truncate">{property.propertyType}</span>
            </div>
            {property.infrastructure?.powerType ? (
              <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-md border border-[#0B5D45]/10">
                <Zap size={12} className="text-[#D4AF37] shrink-0" />
                <span className="truncate">{property.infrastructure.powerType}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-md border border-[#0B5D45]/10">
              <CheckCircle2 size={12} className="text-[#0B5D45] shrink-0" />
              <span className="truncate">{property.bedrooms} Bed · {property.bathrooms || 1} Bath</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 px-2 py-1 rounded-md border border-[#0B5D45]/10">
              <CheckCircle2 size={12} className="text-[#0B5D45] shrink-0" />
              <span className="truncate">Up to {maxGuests} guests</span>
            </div>
          </div>
        </div>

        {property.isReserved && (
          <div className="p-3.5 mb-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 font-medium">
            <Shield size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Currently Reserved</span>
              This residence has an active reservation and is unavailable for booking.
            </div>
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            disabled={!canOpenModal}
            onClick={() => canOpenModal && setIsModalOpen(true)}
            className={`w-full py-4 rounded-xl font-semibold text-[15px] sm:text-[16px] transition-all shadow-md min-h-[44px] ${
              !canOpenModal
                ? "bg-stone-200 text-stone-500 cursor-not-allowed shadow-none"
                : "bg-[#0B5D45] text-white hover:bg-[#084936] active:scale-[0.99]"
            }`}
          >
            {property.isReserved
              ? "Already Reserved · Unavailable"
              : `Request stay · ${formatNaira(total)}`}
          </button>
          <p className="text-center text-[12px] text-[#8B8B86] mt-2">
            {property.isReserved
              ? "Check back later or browse other verified stays"
              : "Host accepts first, then you pay via Paystack — estimate only until request is created"}
          </p>
        </div>

        <div className="mt-5 pt-5 border-t border-[#E7E5E0] space-y-2.5 text-[14px]">
          <div className="flex justify-between text-[#6B6B67]">
            <span>
              {formatNaira(property.pricePerNight)} × {nights} {nights === 1 ? "night" : "nights"}
            </span>
            <span>{formatNaira(stayCost)}</span>
          </div>
          <div className="flex justify-between text-[#6B6B67]">
            <span>Payment processing (Paystack 1.5% + ₦100)</span>
            <span>{formatNaira(processingFee)}</span>
          </div>
          <div className="pt-2.5 border-t border-[#E7E5E0]/70 flex justify-between font-bold text-[16px] text-[#171717]">
            <span>Estimated total</span>
            <span className="text-[#0B5D45]">{formatNaira(total)}</span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#E7E5E0]/70 flex items-start gap-2.5 text-[12px] text-[#6B6B67]">
          <Shield size={16} className="text-[#0B5D45] shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            Backed by the Ilé Verified Guarantee: address and gate details unlock after host accept
            and verified payment.
          </span>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E5E0] px-5 py-3.5 shadow-xl flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-[#171717]">
            {formatNaira(property.pricePerNight)}
            <span className="text-[#6B6B67] text-[13px] font-normal"> / night</span>
          </div>
          <div className="text-[12px] text-[#0B5D45] font-medium flex items-center gap-1">
            <span>{nights} nights</span>
            <span>·</span>
            <span>
              {guests} {guests === 1 ? "guest" : "guests"}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={!canOpenModal}
          onClick={() => canOpenModal && setIsModalOpen(true)}
          className={`px-6 py-3 rounded-xl font-semibold text-[14px] transition-all shadow-md min-h-[44px] ${
            !canOpenModal
              ? "bg-stone-200 text-stone-500 cursor-not-allowed shadow-none"
              : "bg-[#0B5D45] text-white hover:bg-[#084936]"
          }`}
        >
          {property.isReserved ? "Already Reserved" : "Request stay"}
        </button>
      </div>

      <BookingModal
        property={property}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        searchCriteria={searchContext}
      />
    </>
  )
}
