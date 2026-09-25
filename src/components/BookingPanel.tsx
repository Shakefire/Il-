"use client";

import { useState } from "react";
import { Property } from "@/types";
import { formatNaira, calculateNights, getDefaultDates, getTodayISO } from "@/lib/utils";
import BookingModal from "./BookingModal";
import { Shield, Sparkles, ChevronLeft, ChevronRight, Calendar, Users } from "lucide-react";

interface BookingPanelProps {
  property: Property;
}

export default function BookingPanel({ property }: BookingPanelProps) {
  const defaultDates = getDefaultDates(3);
  const [checkIn, setCheckIn] = useState(defaultDates.checkIn);
  const [checkOut, setCheckOut] = useState(defaultDates.checkOut);
  const [guests, setGuests] = useState(2);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayISO = getTodayISO();
  const nights = calculateNights(checkIn, checkOut);
  const stayCost = property.pricePerNight * nights;
  const serviceFee = Math.round(stayCost * 0.08);
  const total = stayCost + serviceFee;

  // Fluid Date Step Adjusters (+/- 1 day)
  const shiftDate = (dateStr: string, days: number): string => {
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    } catch {
      return dateStr;
    }
  };

  const handleShiftCheckIn = (days: number) => {
    const nextDate = shiftDate(checkIn, days);
    if (nextDate >= todayISO) {
      setCheckIn(nextDate);
      if (nextDate >= checkOut) {
        setCheckOut(shiftDate(nextDate, 1));
      }
    }
  };

  const handleShiftCheckOut = (days: number) => {
    const nextDate = shiftDate(checkOut, days);
    if (nextDate > checkIn) {
      setCheckOut(nextDate);
    }
  };

  return (
    <>
      {/* ── Main Booking Card (Visible on Both Mobile & Desktop) ── */}
      <div className="bg-white rounded-2xl border border-[#E7E5E0] p-5 sm:p-6 shadow-sm sticky lg:top-28">
        {/* Header price */}
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

        {/* Date & Guest Selectors */}
        <div className="mt-5 border border-[#E7E5E0] rounded-xl overflow-hidden divide-y divide-[#E7E5E0]">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E7E5E0]">
            {/* Check-in Picker with fluid arrows */}
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
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors"
                    title="Previous day"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftCheckIn(1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors"
                    title="Next day"
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
                  setCheckIn(e.target.value);
                  if (e.target.value >= checkOut) {
                    setCheckOut(shiftDate(e.target.value, 1));
                  }
                }}
                className="w-full text-[14px] text-[#171717] font-semibold bg-transparent focus:outline-none pt-0.5 cursor-pointer"
              />
            </div>

            {/* Check-out Picker with fluid arrows */}
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
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors"
                    title="Previous day"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftCheckOut(1)}
                    className="p-1 rounded text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-200/60 transition-colors"
                    title="Next day"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={checkOut}
                min={checkIn ? shiftDate(checkIn, 1) : todayISO}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-[14px] text-[#171717] font-semibold bg-transparent focus:outline-none pt-0.5 cursor-pointer"
              />
            </div>
          </div>

          {/* Guest Count Selector */}
          <div className="p-3.5 flex items-center justify-between bg-white">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B67] flex items-center gap-1">
                <Users size={12} className="text-[#0B5D45]" />
                <span>Guests</span>
              </label>
              <div className="text-[14px] text-[#171717] font-semibold mt-0.5">
                {guests} {guests === 1 ? "guest" : "guests"}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-8 h-8 rounded-full border border-[#D5D3CC] flex items-center justify-center text-[#171717] hover:border-[#171717] active:scale-95 transition-all text-sm font-bold"
              >
                -
              </button>
              <span className="font-semibold text-sm min-w-[14px] text-center">{guests}</span>
              <button
                type="button"
                onClick={() => setGuests(Math.min(property.maxGuests || 6, guests + 1))}
                className="w-8 h-8 rounded-full border border-[#D5D3CC] flex items-center justify-center text-[#171717] hover:border-[#171717] active:scale-95 transition-all text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Primary CTA Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-4 bg-[#0B5D45] text-white rounded-xl font-semibold text-[15px] sm:text-[16px] hover:bg-[#084936] active:scale-[0.99] transition-all shadow-md"
          >
            Reserve stay · {formatNaira(total)}
          </button>
          <p className="text-center text-[12px] text-[#8B8B86] mt-2">
            Instant booking confirmation with Paystack secure checkout
          </p>
        </div>

        {/* Price Breakdown */}
        <div className="mt-5 pt-5 border-t border-[#E7E5E0] space-y-2.5 text-[14px]">
          <div className="flex justify-between text-[#6B6B67]">
            <span>
              {formatNaira(property.pricePerNight)} × {nights} {nights === 1 ? "night" : "nights"}
            </span>
            <span>{formatNaira(stayCost)}</span>
          </div>
          <div className="flex justify-between text-[#6B6B67]">
            <span>Verification &amp; platform service fee</span>
            <span>{formatNaira(serviceFee)}</span>
          </div>
          <div className="pt-2.5 border-t border-[#E7E5E0]/70 flex justify-between font-bold text-[16px] text-[#171717]">
            <span>Total stay price</span>
            <span className="text-[#0B5D45]">{formatNaira(total)}</span>
          </div>
        </div>

        {/* Hospitality Guarantee */}
        <div className="mt-5 pt-4 border-t border-[#E7E5E0]/70 flex items-start gap-2.5 text-[12px] text-[#6B6B67]">
          <Shield size={16} className="text-[#0B5D45] shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            Backed by the Ilé Verified Guarantee: Tested 24/7 continuous power, gated security clearance, and direct host WhatsApp access upon payment.
          </span>
        </div>
      </div>

      {/* ── Mobile Sticky Bottom Floating Action Bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E7E5E0] px-5 py-3.5 shadow-xl flex items-center justify-between">
        <div>
          <div className="text-[16px] font-bold text-[#171717]">
            {formatNaira(property.pricePerNight)}
            <span className="text-[#6B6B67] text-[13px] font-normal"> / night</span>
          </div>
          <div className="text-[12px] text-[#0B5D45] font-medium flex items-center gap-1">
            <span>{nights} nights</span>
            <span>·</span>
            <span>{guests} {guests === 1 ? "guest" : "guests"}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#0B5D45] text-white px-6 py-3 rounded-xl font-semibold text-[14px] hover:bg-[#084936] transition-all shadow-md"
        >
          Reserve stay
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
