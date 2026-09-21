"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Check, ShieldCheck, CreditCard, Building2, Phone } from "lucide-react";
import { Property } from "@/types";
import { formatNaira, calculateNights } from "@/lib/utils";

interface BookingModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  checkIn: string;
  checkOut: string;
  guests: number;
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

  if (!isOpen) return null;

  const nights = calculateNights(checkIn, checkOut);
  const stayCost = property.pricePerNight * nights;
  const serviceFee = Math.round(stayCost * 0.08); // 8% fee
  const total = stayCost + serviceFee;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(4);
    }, 1200);
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
              {step === 4 && "Reservation confirmed"}
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
                  <span>{formatNaira(stayCost)}</span>
                </div>
                <div className="flex justify-between text-[#6B6B67]">
                  <span>Service & security verification</span>
                  <span>{formatNaira(serviceFee)}</span>
                </div>
                <div className="pt-3 border-t border-[#E7E5E0] flex justify-between font-semibold text-[17px] text-[#171717]">
                  <span>Total (NGN)</span>
                  <span>{formatNaira(total)}</span>
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
                  Booking confirmation & gate entry pass will be sent here.
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
                <span>Your contact info is strictly used for estate security clearance.</span>
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
                  onClick={() => setStep(3)}
                  disabled={!guestName || !guestEmail}
                  className="flex-1 py-3 bg-[#24483A] disabled:opacity-50 text-white rounded-xl font-medium hover:bg-[#1B372C] transition-colors"
                >
                  Continue to payment
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-[14px] text-[#6B6B67]">
                Choose how you would like to complete your reservation of{" "}
                <span className="font-semibold text-[#171717]">{formatNaira(total)}</span>:
              </div>

              <div className="space-y-3">
                {/* Bank Transfer Option */}
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
                          Direct Bank Transfer (Instant NGN)
                        </div>
                        <div className="text-[13px] text-[#6B6B67]">
                          Generate a dedicated Nigerian virtual account to transfer via GTBank, Access, Zenith, or Kuda.
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

                {/* Card Option */}
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
                          Debit / Credit Card
                        </div>
                        <div className="text-[13px] text-[#6B6B67]">
                          Mastercard, Visa, Verve (Nigeria & International cards supported)
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
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-3 border border-[#E7E5E0] text-[#171717] rounded-xl hover:bg-[#FAFAF8]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isProcessing}
                  className="flex-1 py-3.5 bg-[#24483A] text-white rounded-xl font-medium hover:bg-[#1B372C] transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <span>Processing payment...</span>
                  ) : (
                    <span>Confirm & Pay {formatNaira(total)}</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="text-center py-4 space-y-5">
              <div className="w-14 h-14 bg-[#EDF3F0] text-[#24483A] rounded-full flex items-center justify-center mx-auto">
                <Check size={28} strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h4 className="font-display text-2xl text-[#171717]">
                  Your stay is reserved
                </h4>
                <p className="text-[15px] text-[#6B6B67]">
                  Reservation code: <span className="font-mono font-semibold text-[#171717]">ILE-88429</span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0]/70 text-left space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6B6B67]">Property</span>
                  <span className="font-medium text-[#171717]">{property.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B67]">Location</span>
                  <span className="font-medium text-[#171717]">{property.neighborhood}, {property.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B67]">Host</span>
                  <span className="font-medium text-[#171717]">{property.host.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B6B67]">Estate Access</span>
                  <span className="font-medium text-[#24483A]">Gate Pass Code generated</span>
                </div>
              </div>

              <p className="text-[13px] text-[#8B8B86]">
                Check-in instructions and the host&apos;s direct WhatsApp contact have been dispatched to {guestEmail || "your email"}.
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
