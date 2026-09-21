"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  Calendar,
  Users,
  Tag,
  ChevronDown,
} from "lucide-react";

interface SearchBarProps {
  initialDestination?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  compact?: boolean;
}

export default function SearchBar({
  initialDestination = "Abuja",
  initialCheckIn = "2026-09-24",
  initialCheckOut = "2026-09-27",
  initialGuests = 2,
  compact = false,
}: SearchBarProps) {
  const router = useRouter();

  const [destination, setDestination] = useState(initialDestination);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);

  const [activeDropdown, setActiveDropdown] = useState<
    "destination" | "dates" | "guests" | null
  >(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveDropdown(null);
    const params = new URLSearchParams();
    if (destination && destination !== "All Nigeria") {
      params.set("destination", destination);
    }
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests.toString());

    router.push(`/search?${params.toString()}`);
  };

  const destinationsList = [
    { label: "All Nigeria", sub: "Abuja, Lagos, Port Harcourt" },
    { label: "Abuja", sub: "Maitama, Wuse 2, Asokoro, Guzape" },
    { label: "Lagos", sub: "Ikoyi, Victoria Island, Lekki Phase 1" },
  ];

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-5xl mx-auto transition-all ${
        compact ? "" : "shadow-2xl shadow-black/15"
      }`}
    >
      {/* Frosted Glass Light Search Container */}
      <div className="bg-white/85 sm:bg-white/90 backdrop-blur-xl border border-white/80 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 transition-all shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-1 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-black/10">
          {/* Segment 1: Location (Where) */}
          <div
            onClick={() =>
              setActiveDropdown(
                activeDropdown === "destination" ? null : "destination"
              )
            }
            className="sm:col-span-4 p-3 sm:px-5 hover:bg-black/5 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <MapPin size={19} className="text-[#0B5D45] shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">
                  Where
                </div>
                <div className="text-[16px] text-[#171717] font-semibold mt-0.5 truncate flex items-center justify-between">
                  <span>{destination || "Search destinations"}</span>
                  <ChevronDown size={14} className="text-[#6B6B67] ml-2 hidden sm:inline" />
                </div>
              </div>
            </div>
          </div>

          {/* Segment 2: Check in */}
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "dates" ? null : "dates")
            }
            className="sm:col-span-3 p-3 sm:px-4 hover:bg-black/5 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Calendar size={19} className="text-[#171717] shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">
                  Check in
                </div>
                <div className="text-[16px] text-[#171717] font-semibold mt-0.5">
                  {checkIn
                    ? new Date(checkIn).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "Add date"}
                </div>
              </div>
            </div>
          </div>

          {/* Segment 3: Check out */}
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "dates" ? null : "dates")
            }
            className="sm:col-span-2 p-3 sm:px-4 hover:bg-black/5 rounded-xl cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Tag size={19} className="text-[#171717] shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">
                  Check out
                </div>
                <div className="text-[16px] text-[#171717] font-semibold mt-0.5">
                  {checkOut
                    ? new Date(checkOut).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "Add date"}
                </div>
              </div>
            </div>
          </div>

          {/* Segment 4: Guests & Search Action */}
          <div className="sm:col-span-3 p-2 sm:pl-4 sm:pr-1.5 flex items-center justify-between">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "guests" ? null : "guests")
              }
              className="cursor-pointer hover:bg-black/5 rounded-xl p-2 flex-1 mr-2"
            >
              <div className="flex items-center gap-2">
                <Users size={19} className="text-[#171717] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">
                    Guests
                  </div>
                  <div className="text-[16px] text-[#171717] font-semibold mt-0.5 truncate">
                    {guests} {guests === 1 ? "guest" : "guests"}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary CTA: Forest Green (#0B5D45) */}
            <button
              type="button"
              onClick={() => handleSearch()}
              className="bg-[#0B5D45] hover:bg-[#084936] text-white px-5 sm:px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-[15px] shrink-0 shadow-md hover:shadow-lg"
              aria-label="Search stays"
            >
              <Search size={17} strokeWidth={2.5} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown Popovers (Clean light frosted glass / white theme) */}
      {activeDropdown === "destination" && (
        <div className="absolute top-full left-0 mt-3 w-full sm:w-88 bg-white/95 backdrop-blur-xl border border-[#EAE8E3] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] px-3 pb-2">
            Suggested Destinations
          </div>
          <div className="space-y-1">
            {destinationsList.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setDestination(item.label);
                  setActiveDropdown("dates");
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-start gap-3 transition-colors ${
                  destination === item.label
                    ? "bg-[#0B5D45]/10 text-[#0B5D45] border border-[#0B5D45]/30 font-semibold"
                    : "hover:bg-[#F7F6F3] text-[#171717]"
                }`}
              >
                <MapPin size={18} className="mt-0.5 text-[#0B5D45] shrink-0" />
                <div>
                  <div className="font-semibold text-[15px]">{item.label}</div>
                  <div className="text-[13px] text-[#6B6B67]">{item.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDropdown === "dates" && (
        <div className="absolute top-full left-0 sm:left-1/4 mt-3 w-full sm:w-96 bg-white/95 backdrop-blur-xl border border-[#EAE8E3] rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 text-[#171717]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] mb-3">
            Select Check-in & Check-out Dates
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#6B6B67] mb-1">
                Check In
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-[#F7F6F3] border border-[#E2E0DA] text-[#171717] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0B5D45] font-medium"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#6B6B67] mb-1">
                Check Out
              </label>
              <input
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-[#F7F6F3] border border-[#E2E0DA] text-[#171717] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0B5D45] font-medium"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveDropdown("guests")}
              className="text-xs font-semibold text-[#0B5D45] hover:text-[#084936] hover:underline"
            >
              Continue to guests →
            </button>
          </div>
        </div>
      )}

      {activeDropdown === "guests" && (
        <div className="absolute top-full right-0 mt-3 w-full sm:w-80 bg-white/95 backdrop-blur-xl border border-[#EAE8E3] rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 text-[#171717]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#8B8B86] mb-3">
            Guests
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-[15px] font-semibold text-[#171717]">Adults & Children</div>
              <div className="text-[12px] text-[#6B6B67]">Ages 13 or above</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-8 h-8 rounded-lg border border-[#E2E0DA] bg-[#F7F6F3] flex items-center justify-center text-[#171717] hover:border-[#171717] text-base font-semibold"
              >
                -
              </button>
              <span className="w-5 text-center font-bold text-[#171717]">
                {guests}
              </span>
              <button
                type="button"
                onClick={() => setGuests(Math.min(10, guests + 1))}
                className="w-8 h-8 rounded-lg border border-[#E2E0DA] bg-[#F7F6F3] flex items-center justify-center text-[#171717] hover:border-[#171717] text-base font-semibold"
              >
                +
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            className="w-full mt-4 py-2.5 bg-[#0B5D45] text-white text-sm font-semibold rounded-xl hover:bg-[#084936] transition-colors"
          >
            Apply & Search
          </button>
        </div>
      )}
    </div>
  );
}
