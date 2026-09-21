"use client";

import { useState } from "react";
import { Property } from "@/types";
import { formatNaira, calculateNights } from "@/lib/utils";
import BookingModal from "./BookingModal";
import { Shield, Sparkles } from "lucide-react";

interface BookingPanelProps {
  property: Property;
}

export default function BookingPanel({ property }: BookingPanelProps) {
  const [checkIn, setCheckIn] = useState("2026-09-24");
  const [checkOut, setCheckOut] = useState("2026-09-27");
  const [guests, setGuests] = useState(2);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const nights = calculateNights(checkIn, checkOut);
  const stayCost = property.pricePerNight * nights;
  const serviceFee = Math.round(stayCost * 0.08);
  const total = stayCost + serviceFee;

  return (
    <>
      {/* Desktop Sticky Booking Panel */}
      <div className="hidden lg:block sticky top-28 bg-white rounded-2xl border border-[#E7E5E0] p-6 shadow-sm">
        {/* Header price */}
        <div className="flex items-baseline justify-between pb-6 border-b border-[#E7E5E0]">
          <div>
            <span className="font-semibold text-2xl text-[#171717]">
              {formatNaira(property.pricePerNight)}
            </span>
            <span className="text-[#6B6B67] text-[15px]"> / night</span>
          </div>
          <div className="text-[13px] text-[#24483A] font-medium bg-[#EDF3F0] px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles size={12} />
            <span>Direct rate</span>
          </div>
        </div>

        {/* Date & Guest Selectors */}
        <div className="mt-6 border border-[#E7E5E0] rounded-xl overflow-hidden divide-y divide-[#E7E5E0]">
          <div className="grid grid-cols-2 divide-x divide-[#E7E5E0]">
            <div className="p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86]">
                Check-in
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full text-[14px] text-[#171717] font-medium bg-transparent focus:outline-none pt-0.5"
              />
            </div>
            <div className="p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86]">
                Check-out
              </label>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-[14px] text-[#171717] font-medium bg-transparent focus:outline-none pt-0.5"
              />
            </div>
          </div>

          <div className="p-3 flex items-center justify-between">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86]">
                Guests
              </label>
              <div className="text-[14px] text-[#171717] font-medium">
                {guests} {guests === 1 ? "guest" : "guests"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-7 h-7 rounded-full border border-[#E7E5E0] flex items-center justify-center text-[#171717] hover:border-[#171717] text-sm"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setGuests(Math.min(property.maxGuests, guests + 1))}
                className="w-7 h-7 rounded-full border border-[#E7E5E0] flex items-center justify-center text-[#171717] hover:border-[#171717] text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-4 bg-[#24483A] text-white rounded-xl font-medium text-[16px] hover:bg-[#1B372C] transition-all shadow-sm"
          >
            Reserve stay
          </button>
          <p className="text-center text-[12px] text-[#8B8B86] mt-2.5">
            You won&apos;t be charged immediately
          </p>
        </div>

        {/* Price Breakdown */}
        <div className="mt-6 pt-6 border-t border-[#E7E5E0] space-y-3 text-[14px]">
          <div className="flex justify-between text-[#6B6B67]">
            <span>
              {formatNaira(property.pricePerNight)} × {nights} nights
            </span>
            <span>{formatNaira(stayCost)}</span>
          </div>
          <div className="flex justify-between text-[#6B6B67]">
            <span>Ilé verification fee</span>
            <span>{formatNaira(serviceFee)}</span>
          </div>
          <div className="pt-3 border-t border-[#E7E5E0]/60 flex justify-between font-semibold text-[16px] text-[#171717]">
            <span>Total</span>
            <span>{formatNaira(total)}</span>
          </div>
        </div>

        {/* Guarantee */}
        <div className="mt-6 pt-4 border-t border-[#E7E5E0]/60 flex items-start gap-2.5 text-[12px] text-[#6B6B67]">
          <Shield size={16} className="text-[#24483A] shrink-0 mt-0.5" />
          <span>
            Backed by Ilé Hospitality Guarantee: Verified 24/7 power, gate clearance, and instant host response.
          </span>
        </div>
      </div>

      {/* Mobile Bottom Booking Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E5E0] px-6 py-4 shadow-lg flex items-center justify-between">
        <div>
          <div className="text-[17px] font-semibold text-[#171717]">
            {formatNaira(property.pricePerNight)}
            <span className="text-[#6B6B67] text-[13px] font-normal"> / night</span>
          </div>
          <div className="text-[12px] text-[#6B6B67]">
            {nights} nights · {guests} guests
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#24483A] text-white px-6 py-3 rounded-xl font-medium text-[15px] hover:bg-[#1B372C] transition-colors"
        >
          Reserve
        </button>
      </div>

      {/* Booking Modal */}
      <BookingModal
        property={property}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
      />
    </>
  );
}
