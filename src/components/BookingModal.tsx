"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Check, ShieldCheck, CreditCard, Building2, Lock, Key, MapPin, Phone, Mail, Loader2, AlertCircle } from "lucide-react";
import { Property } from "@/types";
import { formatNaira, calculateNights } from "@/lib/utils";
import { api } from "@/lib/api";

interface BookingModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  checkIn: string;
  checkOut: string;
  guests: number;
}

interface ConfirmedBookingDetails {
  id: string;
  reference: string;
  totalPrice: number;
  contactDetails?: {
    exactAddress: string;
    unitNumber?: string;
    accessGateCode?: string;
    checkInInstructions?: string;
    hostName: string;
    hostPhone: string;
    hostEmail: string;
  };
}

export default function BookingModal({
  property,
  isOpen,
  onClose,
  checkIn,
  checkOut,
  guests,
}: BookingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "transfer">("transfer");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server state for booking
  const [serverBooking, setServerBooking] = useState<any>(null);
  const [confirmedData, setConfirmedData] = useState<ConfirmedBookingDetails | null>(null);

  if (!isOpen) return null;

  const nights = calculateNights(checkIn, checkOut);
  const clientStayCost = property.pricePerNight * nights;
  const clientServiceFee = Math.round(clientStayCost * 0.08);
  const clientTotal = clientStayCost + clientServiceFee;

  // Step 2 -> Step 3: Create server reservation
  const handleCreateReservation = async () => {
    setErrorMessage(null);
    const parts = guestName.trim().split(" ");
    const firstName = parts[0] || "Guest";
    const lastName = parts.slice(1).join(" ") || "User";

    setIsProcessing(true);
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
      });

      setServerBooking(res.booking);
      setStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reserve dates. Please check availability.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 3 -> Step 4: Pay & unlock quarantined details
  const handlePay = async (mode: "paystack" | "direct" = "paystack") => {
    if (!serverBooking) return;
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // 1. Initialize transaction on backend & Paystack
      const initRes = await api.initializePayment(serverBooking.id);
      if (!initRes || !initRes.success) {
        throw new Error(initRes?.error || "Failed to initialize payment gateway.");
      }

      // If user selected Paystack and an authorization URL was returned:
      if (mode === "paystack" && initRes.authorizationUrl && initRes.authorizationUrl.startsWith("http")) {
        window.location.href = initRes.authorizationUrl;
        return;
      }

      // 2. Direct / in-modal settlement for test sandbox verification
      try {
        await api.verifyPayment(initRes.reference);
      } catch {
        // Fallback to direct booking payment if Paystack webhook is pending
        await api.payBooking(
          serverBooking.id,
          {
            paymentMethod: paymentMethod === "card" ? "CARD" : "BANK_TRANSFER",
            paymentReference: initRes.reference,
          },
          serverBooking.accessToken
        );
      }

      // 3. Fetch confirmed quarantined details (Address, Gate Code, Host Contact)
      const contactRes = await api.getBookingContact(serverBooking.id, serverBooking.accessToken);

      setConfirmedData({
        id: serverBooking.id,
        reference: serverBooking.referenceCode || `ILE-${serverBooking.id.slice(-6).toUpperCase()}`,
        totalPrice: serverBooking.totalPrice,
        contactDetails: contactRes.contact,
      });

      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Payment verification failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E7E5E0] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E7E5E0] flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Step {step} of 4
            </span>
            <h3 className="font-display text-xl sm:text-2xl text-[#171717] font-normal">
              {step === 1 && "Confirm your stay"}
              {step === 2 && "Guest information"}
              {step === 3 && "Payment preference"}
              {step === 4 && "Reservation confirmed & verified"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#8B8B86] hover:text-[#171717] rounded-full hover:bg-[#FAFAF8] transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Step 1: Summary */}
          {step === 1 && (
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
                  <h4 className="text-[16px] font-medium text-[#171717]">
                    {property.title}
                  </h4>
                  <p className="text-[13px] text-[#6B6B67]">
                    {property.neighborhood}, {property.city}
                  </p>
                  <p className="text-[13px] text-[#171717] pt-1">
                    {property.bedrooms} bedrooms · {guests} guests
                  </p>
                </div>
              </div>

              {/* Trip dates */}
              <div className="border border-[#E7E5E0] rounded-xl p-4 divide-y divide-[#E7E5E0]/60 space-y-3">
                <div className="flex justify-between items-center text-[15px]">
                  <span className="text-[#6B6B67]">Dates</span>
                  <span className="font-medium text-[#171717]">
                    {new Date(checkIn).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
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
                  </span>
                </div>
                <div className="pt-3 flex justify-between items-center text-[15px]">
                  <span className="text-[#6B6B67]">Guests</span>
                  <span className="font-medium text-[#171717]">
                    {guests} {guests === 1 ? "guest" : "guests"}
                  </span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2.5 text-[15px]">
                <div className="flex justify-between text-[#6B6B67]">
                  <span>
                    {formatNaira(property.pricePerNight)} × {nights} nights
                  </span>
                  <span>{formatNaira(clientStayCost)}</span>
                </div>
                <div className="flex justify-between text-[#6B6B67]">
                  <span>Service &amp; infrastructure verification</span>
                  <span>{formatNaira(clientServiceFee)}</span>
                </div>
                <div className="pt-3 border-t border-[#E7E5E0] flex justify-between font-semibold text-[17px] text-[#171717]">
                  <span>Total (NGN)</span>
                  <span>{formatNaira(clientTotal)}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 bg-[#24483A] text-white rounded-xl font-medium text-[15px] hover:bg-[#1B372C] transition-colors"
                >
                  Continue to guest details →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Guest Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1">
                  Full legal name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nnamdi Azikiwe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="nnamdi@example.ng"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                />
                <p className="text-[12px] text-[#8B8B86] mt-1">
                  No account required to reserve. If you later create an account with this email, your booking will automatically appear in your trips.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#171717] mb-1">
                  Phone number (WhatsApp)
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3.5 rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] text-[#171717] text-sm">
                    +234
                  </span>
                  <input
                    type="tel"
                    placeholder="803 123 4567"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 text-[13px] text-[#6B6B67]">
                <ShieldCheck size={18} className="text-[#24483A] shrink-0" />
                <span>Exact address &amp; gate access code are strictly quarantined until payment confirmation.</span>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 border border-[#E7E5E0] text-[#171717] rounded-xl hover:bg-[#FAFAF8]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateReservation}
                  disabled={!guestName || !guestEmail || isProcessing}
                  className="flex-1 py-3 bg-[#24483A] disabled:opacity-50 text-white rounded-xl font-medium hover:bg-[#1B372C] transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Checking availability...</span>
                    </>
                  ) : (
                    <span>Continue to payment</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E0]">
                <div className="text-[14px] text-[#6B6B67]">
                  Total Reservation Amount:{" "}
                  <span className="font-bold text-base text-[#171717]">
                    {formatNaira(serverBooking ? serverBooking.totalPrice : clientTotal)}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EDF3F0] text-[#0B5D45]">
                  <ShieldCheck size={13} />
                  <span>Secured by Paystack</span>
                </span>
              </div>

              <div className="space-y-3">
                {/* Paystack Card / Transfer Option */}
                <div
                  onClick={() => setPaymentMethod("card")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "card"
                      ? "border-[#24483A] bg-[#EDF3F0]/40 ring-1 ring-[#24483A]"
                      : "border-[#E7E5E0] hover:border-[#171717]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <CreditCard size={20} className="text-[#24483A] mt-0.5" />
                      <div>
                        <div className="text-[15px] font-medium text-[#171717]">
                          Paystack Checkout (Card, Transfer, USSD, Apple Pay)
                        </div>
                        <div className="text-[13px] text-[#6B6B67]">
                          Mastercard, Visa, Verve &amp; dynamic Nigerian virtual bank accounts.
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === "card"
                          ? "border-[#24483A] bg-[#24483A]"
                          : "border-[#8B8B86]"
                      }`}
                    >
                      {paymentMethod === "card" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Bank Transfer Option */}
                <div
                  onClick={() => setPaymentMethod("transfer")}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === "transfer"
                      ? "border-[#24483A] bg-[#EDF3F0]/40 ring-1 ring-[#24483A]"
                      : "border-[#E7E5E0] hover:border-[#171717]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <Building2 size={20} className="text-[#24483A] mt-0.5" />
                      <div>
                        <div className="text-[15px] font-medium text-[#171717]">
                          Instant Bank Transfer (Nigerian Bank Accounts)
                        </div>
                        <div className="text-[13px] text-[#6B6B67]">
                          Direct transfer via GTBank, Access, Zenith, or Kuda virtual accounts.
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === "transfer"
                          ? "border-[#24483A] bg-[#24483A]"
                          : "border-[#8B8B86]"
                      }`}
                    >
                      {paymentMethod === "transfer" && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quarantined detail notice */}
              <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[#E7E5E0] flex items-center gap-2.5 text-[12.5px] text-[#6B6B67]">
                <Lock size={15} className="text-[#0B5D45] shrink-0" />
                <span>Exact address and gate code unlock immediately upon payment confirmation.</span>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-3 border border-[#E7E5E0] text-[#171717] rounded-xl hover:bg-[#FAFAF8]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handlePay("paystack")}
                  disabled={isProcessing}
                  className="flex-1 py-3.5 bg-[#0B5D45] text-white rounded-xl font-medium hover:bg-[#084936] transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Connecting to Paystack...</span>
                    </>
                  ) : (
                    <span>Pay with Paystack {formatNaira(serverBooking ? serverBooking.totalPrice : clientTotal)}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handlePay("direct")}
                  disabled={isProcessing}
                  className="px-4 py-3.5 border border-[#E7E5E0] text-[#6B6B67] hover:text-[#171717] rounded-xl text-xs font-medium hover:bg-[#FAFAF8] transition-colors"
                >
                  Instant Test Pay
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation with Quarantined Access Details Unlocked */}
          {step === 4 && (
            <div className="text-center py-2 space-y-5">
              <div className="w-14 h-14 bg-[#EDF3F0] text-[#24483A] rounded-full flex items-center justify-center mx-auto">
                <Check size={28} strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h4 className="font-display text-2xl text-[#171717]">
                  Your stay is reserved &amp; confirmed
                </h4>
                <p className="text-[14.5px] text-[#6B6B67]">
                  Reservation reference:{" "}
                  <span className="font-mono font-bold text-[#171717]">
                    {confirmedData?.reference || "ILE-CONFIRMED"}
                  </span>
                </p>
              </div>

              {/* Unlocked Private Details Card */}
              {confirmedData?.contactDetails && (
                <div className="p-4.5 rounded-xl bg-[#EDF3F0]/60 border border-[#24483A]/30 text-left space-y-3.5 text-[14px]">
                  <div className="flex items-center gap-2 text-[#0B5D45] font-semibold text-xs uppercase tracking-wider">
                    <Key size={14} />
                    <span>Quarantined Access Details (Unlocked)</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={16} className="text-[#0B5D45] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#171717]">Exact Property Address:</div>
                        <div className="text-[#4A4A45]">
                          {confirmedData.contactDetails.exactAddress}
                          {confirmedData.contactDetails.unitNumber ? `, Unit ${confirmedData.contactDetails.unitNumber}` : ""}
                        </div>
                      </div>
                    </div>

                    {confirmedData.contactDetails.accessGateCode && (
                      <div className="flex items-start gap-2.5">
                        <Key size={16} className="text-[#0B5D45] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[#171717]">Estate Gate Pass Code:</div>
                          <div className="font-mono font-bold text-[#0B5D45] text-base">
                            {confirmedData.contactDetails.accessGateCode}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <Phone size={16} className="text-[#0B5D45] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[#171717]">Host Direct Phone / WhatsApp:</div>
                        <div className="text-[#171717] font-medium">
                          {confirmedData.contactDetails.hostPhone} ({confirmedData.contactDetails.hostName})
                        </div>
                      </div>
                    </div>

                    {confirmedData.contactDetails.checkInInstructions && (
                      <div className="pt-2 border-t border-[#24483A]/20 text-[13px] text-[#4A4A45]">
                        <span className="font-medium text-[#171717]">Check-in Note: </span>
                        {confirmedData.contactDetails.checkInInstructions}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[13px] text-[#8B8B86]">
                A receipt and digital gate pass have been dispatched to{" "}
                <span className="font-medium text-[#171717]">{guestEmail || "your email"}</span>.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-[#171717] text-white rounded-xl font-medium text-[15px] hover:bg-black transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
