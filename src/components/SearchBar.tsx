"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, MapPin, Calendar, CalendarCheck, Users, ChevronDown,
  Check, ChevronLeft, ChevronRight, Loader2, ArrowRight,
} from "lucide-react";
import { getDefaultDates, getTodayISO } from "@/lib/utils";

/* ─── House Type Iconography System (20x20, 1.5px stroke, rounded) ──────── */

/** All Types: Layered overlapping cards representing diversity / all categories */
const AllTypesIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="7" width="13" height="13" rx="2" />
    <path d="M8 4.5A1.5 1.5 0 0 1 9.5 3h10A1.5 1.5 0 0 1 21 4.5v10a1.5 1.5 0 0 1-1.5 1.5H18" />
    <path d="M7 11h5M7 15h3" />
  </svg>
);

/** Serviced Apartment: Multi-unit building entrance with concierge service bell */
const ServicedApartmentIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="3.5" width="11" height="17" rx="1.5" />
    <path d="M6.5 7h1M9.5 7h1M6.5 11h1M9.5 11h1M7 16.5v4" />
    <path d="M18 10a3 3 0 0 0-3 3v2.5h6V13a3 3 0 0 0-3-3z" />
    <path d="M18 7.5v2.5M14 17.5h8" />
  </svg>
);

/** Private Residence: Detached pitched roof home with front door & gated boundary lines */
const PrivateResidenceIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 11l8-6 8 6" />
    <path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5" />
    <rect x="10.5" y="14" width="3" height="6" rx="0.5" />
    <path d="M2 19.5h2M20 19.5h2M3 16.5v3M21 16.5v3" />
  </svg>
);

/** Penthouse: Top-tier terrace high-rise with skyline canopy & terrace railings */
const PenthouseIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 21V10a1 1 0 0 1 1-1h7v12" />
    <path d="M4 14.5h8M8 10v11" />
    <path d="M12 14.5h8v6.5h-8" />
    <path d="M15 14.5v6.5M18 14.5v6.5" />
    <path d="M11 6l4.5-3 4.5 3" />
    <path d="M15.5 3v5" />
  </svg>
);

/** Garden Villa: Villa facade flanked by landscaped botanical palm frond */
const GardenVillaIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="9.5" width="11" height="10.5" rx="1" />
    <path d="M2 9.5h13" />
    <path d="M6 13.5h4v6.5H6z" />
    <path d="M19 20c0-6 2-9 2-9s-3 1-5 4c-1.5 2.2-1 4.5-1 5" />
    <path d="M18 12c-1.5-1-3.5-1-5 0" />
    <path d="M19 15c2-1 3.5-.5 4.5 1" />
  </svg>
);

/* ─── Calendar helpers ─────────────────────────────────────────────────────── */
const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const getCalDays = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* ─── SearchBar Props ──────────────────────────────────────────────────────── */
interface SearchBarProps {
  initialDestination?: string;
  initialPropertyType?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  compact?: boolean;
}

export default function SearchBar({
  initialDestination = "Abuja",
  initialPropertyType = "All Types",
  initialCheckIn,
  initialCheckOut,
  initialGuests = 2,
  compact = false,
}: SearchBarProps) {
  const router = useRouter();
  const defaultDates = getDefaultDates();

  const [destination, setDestination] = useState(initialDestination);
  const [propertyType, setPropertyType] = useState(initialPropertyType);
  const [checkIn, setCheckIn] = useState(initialCheckIn || defaultDates.checkIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut || defaultDates.checkOut);
  const [guests, setGuests] = useState(initialGuests);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const locationDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleDestinationInput = (val: string) => {
    setDestination(val);
    setSelectedCoords(null);

    if (locationDebounceTimer.current) clearTimeout(locationDebounceTimer.current);

    if (val.trim().length >= 2) {
      setIsSearchingLocation(true);
      locationDebounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/locations/search?q=${encodeURIComponent(val.trim())}`);
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setLocationSuggestions(data.data);
          } else {
            setLocationSuggestions([]);
          }
        } catch {
          setLocationSuggestions([]);
        } finally {
          setIsSearchingLocation(false);
        }
      }, 350);
    } else {
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
    }
  };

  const selectRealLocation = (loc: any) => {
    const name = loc.name || loc.neighborhood || loc.city || loc.displayName;
    setDestination(name);
    setSelectedCoords({ lat: loc.latitude, lng: loc.longitude });
    setLocationSuggestions([]);
    setActiveDropdown("propertyType");
  };

  const [activeDropdown, setActiveDropdown] = useState<
    "destination" | "propertyType" | "dates" | "guests" | null
  >(null);

  /* Calendar state — single month view */
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [calSelectingField, setCalSelectingField] = useState<"checkIn" | "checkOut">("checkIn");

  /* Open calendar on the checkIn month if present */
  useEffect(() => {
    if (activeDropdown === "dates") {
      const base = checkIn ? parseISO(checkIn) : today;
      setCalYear(base.getFullYear());
      setCalMonth(base.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDropdown]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleDayClick = (iso: string) => {
    if (calSelectingField === "checkIn") {
      setCheckIn(iso);
      setCheckOut("");
      setCalSelectingField("checkOut");
    } else {
      if (iso <= checkIn) {
        setCheckIn(iso);
        setCheckOut("");
        setCalSelectingField("checkOut");
      } else {
        setCheckOut(iso);
        setCalSelectingField("checkIn");
        setActiveDropdown("guests");
      }
    }
  };

  const openDates = (preferField: "checkIn" | "checkOut") => {
    setCalSelectingField(preferField);
    setActiveDropdown(activeDropdown === "dates" ? null : "dates");
  };

  /* Quick-select presets */
  const handleQuickSelect = (type: "thisWeekend" | "nextWeekend" | "next7Days" | "flexible") => {
    const now = new Date();
    if (type === "flexible") {
      setCheckIn("");
      setCheckOut("");
      setCalSelectingField("checkIn");
      return;
    }

    if (type === "thisWeekend") {
      const day = now.getDay();
      const diffToFriday = (5 - day + 7) % 7 || 7;
      const fri = new Date(now);
      fri.setDate(now.getDate() + (day === 5 ? 0 : diffToFriday));
      const sun = new Date(fri);
      sun.setDate(fri.getDate() + 2);
      setCheckIn(toISO(fri));
      setCheckOut(toISO(sun));
      setActiveDropdown("guests");
      return;
    }

    if (type === "nextWeekend") {
      const day = now.getDay();
      const diffToFriday = ((5 - day + 7) % 7 || 7) + 7;
      const fri = new Date(now);
      fri.setDate(now.getDate() + (day === 5 ? 7 : diffToFriday));
      const sun = new Date(fri);
      sun.setDate(fri.getDate() + 2);
      setCheckIn(toISO(fri));
      setCheckOut(toISO(sun));
      setActiveDropdown("guests");
      return;
    }

    if (type === "next7Days") {
      const start = new Date(now);
      start.setDate(now.getDate() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      setCheckIn(toISO(start));
      setCheckOut(toISO(end));
      setActiveDropdown("guests");
      return;
    }
  };

  /* Click-outside to close */
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = () => {
    setActiveDropdown(null);
    const params = new URLSearchParams();
    if (destination && destination !== "All Nigeria") {
      params.set("destination", destination);
      params.set("location", destination);
      if (selectedCoords) {
        params.set("lat", selectedCoords.lat.toString());
        params.set("lng", selectedCoords.lng.toString());
      }
    }
    if (propertyType && propertyType !== "All Types") params.set("type", propertyType);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", guests.toString());
    router.push(`/search?${params.toString()}`);
  };

  const fmtDate = (iso: string) =>
    iso
      ? parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "Add date";

  const destinationsList = [
    { label: "All Nigeria", sub: "Abuja, Lagos, Port Harcourt" },
    { label: "Abuja",       sub: "Maitama, Wuse 2, Asokoro, Guzape" },
    { label: "Lagos",       sub: "Ikoyi, Victoria Island, Lekki Phase 1" },
  ];

  const propertyTypesList = [
    {
      label: "All Types",
      sub: "Any apartment, villa, or residence",
      icon: AllTypesIcon,
    },
    {
      label: "Serviced Apartment",
      sub: "Curated flats with continuous power & fiber",
      icon: ServicedApartmentIcon,
    },
    {
      label: "Private Residence",
      sub: "Gated detached homes with private grounds",
      icon: PrivateResidenceIcon,
    },
    {
      label: "Penthouse",
      sub: "Elevated luxury with skyline & terrace views",
      icon: PenthouseIcon,
    },
    {
      label: "Garden Villa",
      sub: "Hillside or landscaped villas with outdoor spaces",
      icon: GardenVillaIcon,
    },
  ];

  /* Active property icon for bar segment */
  const ActivePropertyIcon =
    propertyTypesList.find((p) => p.label === propertyType)?.icon || AllTypesIcon;

  /* Standardized popover base sitting flush beneath the search bar */
  const popoverBase =
    "absolute top-full left-0 mt-2 bg-white border border-[#E5E3DC] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.22),0_10px_20px_-5px_rgba(0,0,0,0.08)] z-50 animate-in fade-in slide-in-from-top-1 duration-150";

  /* Calendar calculations for current single month */
  const todayISO = toISO(today);
  const currentMonthDays = getCalDays(calYear, calMonth);
  const effectiveEnd =
    calSelectingField === "checkOut" && hoverDate ? hoverDate : checkOut;

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-5xl mx-auto transition-all ${
        compact ? "" : "shadow-2xl shadow-black/15"
      }`}
    >
      {/* Search Bar Container */}
      <div className="bg-white border border-[#E8E6E0] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-1 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-black/10">

          {/* ── 1. Where ─────────────────────────────────────────────────── */}
          <div className="md:col-span-3 relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "destination" ? null : "destination")
              }
              className={`p-3 md:px-4 rounded-xl cursor-pointer transition-colors ${
                activeDropdown === "destination" ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin size={18} className="text-[#0B5D45] shrink-0 mt-0.5" />
                <div className="overflow-hidden w-full">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">Where</div>
                  <div className="text-[15px] text-[#171717] font-semibold mt-0.5 truncate flex items-center justify-between">
                    <span className="truncate">{destination || "Search destinations"}</span>
                    <ChevronDown size={14} className="text-[#6B6B67] ml-1.5 shrink-0 hidden md:inline" />
                  </div>
                </div>
              </div>
            </div>

            {/* Destination Popover — aligned width to parent field */}
            {activeDropdown === "destination" && (
              <div className={`${popoverBase} w-full min-w-[300px] sm:w-[350px] p-3 text-[#171717]`}>
                {/* Freeform Search Input with Real Geocoding */}
                <div className="mb-3 px-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={destination === "All Nigeria" ? "" : destination}
                      onChange={(e) => handleDestinationInput(e.target.value)}
                      placeholder="Type district, hotel or landmark..."
                      className="w-full pl-8 pr-8 py-2 text-[14px] bg-[#F7F6F3] border border-[#E7E5E0] rounded-xl focus:outline-none focus:border-[#0B5D45] text-[#171717] placeholder:text-[#9B9B97]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setActiveDropdown("propertyType");
                        }
                      }}
                      autoFocus
                    />
                    <Search size={14} className="absolute left-2.5 top-3 text-[#8B8B86]" />
                    {isSearchingLocation && (
                      <Loader2 size={14} className="absolute right-2.5 top-3 text-[#0B5D45] animate-spin" />
                    )}
                  </div>
                </div>

                {/* Real Geocoded Suggestions Dropdown */}
                {locationSuggestions.length > 0 && (
                  <div className="mb-3 px-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#0B5D45] mb-1.5 flex items-center gap-1">
                      <span>Matching Locations</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto divide-y divide-[#F2F0EB] bg-[#FAF9F6] rounded-xl border border-[#E7E5E0] p-1">
                      {locationSuggestions.map((loc, idx) => (
                        <button
                          key={`${loc.latitude}-${loc.longitude}-${idx}`}
                          type="button"
                          onClick={() => selectRealLocation(loc)}
                          className="w-full text-left p-2 hover:bg-white rounded-lg transition-colors flex items-start gap-2.5 group"
                        >
                          <div className="mt-0.5 w-5 h-5 rounded bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <MapPin size={12} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[#171717] truncate group-hover:text-[#0B5D45] transition-colors">
                              {loc.name || loc.neighborhood || loc.city}
                            </p>
                            <p className="text-[11px] text-[#6B6B67] truncate">
                              {loc.displayName}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Nigerian Areas Quick Chips */}
                <div className="px-1 mb-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8B8B86] mb-1.5">
                    Popular Areas &amp; Landmarks
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Maitama", "Wuse 2", "Jabi Lake", "Nicon Luxury", "Ikoyi", "Victoria Island"].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setDestination(chip);
                          setActiveDropdown("propertyType");
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          destination === chip
                            ? "bg-[#0B5D45] text-white border-[#0B5D45]"
                            : "bg-[#F7F6F3] text-[#4A4A45] border-[#E7E5E0] hover:border-[#171717]"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B86] px-2 pt-1 pb-1.5 border-t border-[#E7E5E0]">
                  Suggested Regions
                </div>
                <div className="space-y-1">
                  {destinationsList.map((item) => {
                    const isSelected = destination === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setDestination(item.label);
                          setActiveDropdown("propertyType");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors ${
                          isSelected
                            ? "bg-[#0B5D45]/10 text-[#0B5D45]"
                            : "hover:bg-[#F7F6F3] text-[#171717]"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-[#0B5D45]/15 text-[#0B5D45]"
                              : "bg-[#F0EFEB] text-[#6B6B67]"
                          }`}
                        >
                          <MapPin size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={`font-semibold text-[13.5px] ${
                              isSelected ? "text-[#0B5D45]" : "text-[#171717]"
                            }`}
                          >
                            {item.label}
                          </div>
                          <div
                            className={`text-[11px] truncate ${
                              isSelected ? "text-[#0B5D45]/80" : "text-[#6B6B67]"
                            }`}
                          >
                            {item.sub}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={15} className="text-[#0B5D45] shrink-0 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 2. Apartment Type ────────────────────────────────────────── */}
          <div className="md:col-span-3 lg:col-span-2 relative">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "propertyType" ? null : "propertyType")
              }
              className={`p-3 md:px-4 rounded-xl cursor-pointer transition-colors ${
                activeDropdown === "propertyType" ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ActivePropertyIcon size={18} className="text-[#0B5D45] shrink-0 mt-0.5" />
                <div className="overflow-hidden w-full">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">Apartment Type</div>
                  <div className="text-[15px] text-[#171717] font-semibold mt-0.5 truncate flex items-center justify-between">
                    <span className="truncate">{propertyType || "All Types"}</span>
                    <ChevronDown size={14} className="text-[#6B6B67] ml-1 shrink-0 hidden md:inline" />
                  </div>
                </div>
              </div>
            </div>

            {/* Property Type Popover — with strict max-height & clean inner scroll */}
            {activeDropdown === "propertyType" && (
              <div className={`${popoverBase} w-full min-w-[300px] sm:w-[340px] max-h-[380px] flex flex-col text-[#171717]`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B86] px-4 pt-3.5 pb-2.5 shrink-0 border-b border-[#F0EFEB]">
                  Select Property Type
                </div>
                <div className="p-2.5 space-y-1 overflow-y-auto max-h-[310px] pr-1.5">
                  {propertyTypesList.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = (propertyType || "All Types") === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setPropertyType(item.label);
                          setActiveDropdown("dates");
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                          isSelected
                            ? "bg-[#0B5D45]/10 text-[#0B5D45]"
                            : "hover:bg-[#F7F6F3] text-[#171717]"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-[#0B5D45]/15 text-[#0B5D45]"
                              : "bg-[#F0EFEB] text-[#6B6B67]"
                          }`}
                        >
                          <IconComp size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-semibold text-[14px] ${
                              isSelected ? "text-[#0B5D45]" : "text-[#171717]"
                            }`}
                          >
                            {item.label}
                          </div>
                          <div
                            className={`text-[12px] leading-snug mt-0.5 truncate ${
                              isSelected ? "text-[#0B5D45]/80" : "text-[#6B6B67]"
                            }`}
                          >
                            {item.sub}
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-[#0B5D45] shrink-0 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Check In (Single-Month Focused Calendar Popover) ───────── */}
          <div className="md:col-span-2 relative">
            <div
              onClick={() => openDates(checkIn && !checkOut ? "checkOut" : "checkIn")}
              className={`p-3 md:px-5 rounded-xl cursor-pointer transition-colors ${
                activeDropdown === "dates" && calSelectingField === "checkIn"
                  ? "bg-black/5"
                  : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-[#0B5D45] shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">Check in</div>
                  <div className={`text-[15px] font-semibold mt-0.5 truncate ${checkIn ? "text-[#171717]" : "text-[#9B9B97]"}`}>
                    {fmtDate(checkIn)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Single-Month Focused Minimalist Calendar ───────────────── */}
            {activeDropdown === "dates" && (
              <div className={`${popoverBase} w-[340px] p-4 sm:p-4.5 text-[#171717]`}>
                {/* Header with Month / Year and High-Affordance Navigation */}
                <div className="flex items-center justify-between mb-3.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6B67] hover:text-[#171717] hover:bg-[#F2F1ED] transition-colors"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <div className="text-[14.5px] font-semibold text-[#171717]">
                    {MONTH_NAMES[calMonth]} {calYear}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6B67] hover:text-[#171717] hover:bg-[#F2F1ED] transition-colors"
                    aria-label="Next month"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 mb-1 text-center">
                  {DAY_HEADERS.map((d) => (
                    <div
                      key={d}
                      className="h-7 flex items-center justify-center text-[11px] font-medium text-[#9B9B97]"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid with Continuous Ribbon Highlight */}
                <div className="grid grid-cols-7 gap-y-1">
                  {currentMonthDays.map((date, i) => {
                    if (!date) {
                      return <div key={`empty-${i}`} className="h-9" />;
                    }

                    const iso = toISO(date);
                    const isPast = iso < todayISO;
                    const isStart = iso === checkIn;
                    const isEnd = iso === checkOut;
                    const hasRange =
                      Boolean(checkIn) &&
                      Boolean(effectiveEnd) &&
                      effectiveEnd > checkIn;
                    const inRange =
                      hasRange && iso > checkIn && iso < effectiveEnd && !isPast;

                    return (
                      <div
                        key={iso}
                        className="h-9 flex items-center justify-center relative select-none"
                      >
                        {/* Connecting Ribbon Background Pill */}
                        {hasRange && (
                          <>
                            {isStart && (
                              <div className="absolute inset-y-0 right-0 left-1/2 bg-[#0B5D45]/12 z-0" />
                            )}
                            {isEnd && (
                              <div className="absolute inset-y-0 left-0 right-1/2 bg-[#0B5D45]/12 z-0" />
                            )}
                            {inRange && (
                              <div className="absolute inset-0 bg-[#0B5D45]/12 z-0" />
                            )}
                          </>
                        )}

                        {/* Date Button with Active Circular Highlight */}
                        <button
                          type="button"
                          disabled={isPast}
                          onClick={() => handleDayClick(iso)}
                          onMouseEnter={() => setHoverDate(iso)}
                          onMouseLeave={() => setHoverDate(null)}
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all ${
                            isPast
                              ? "text-[#C8C8C4] cursor-not-allowed"
                              : isStart || isEnd
                              ? "bg-[#0B5D45] text-white font-bold shadow-md ring-2 ring-[#0B5D45]/25 scale-105"
                              : inRange
                              ? "text-[#0B5D45] font-semibold hover:bg-[#0B5D45]/20"
                              : "text-[#171717] font-medium hover:bg-[#F2F1ED]"
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Quick-Select Chips (One-Click Options) — compact bottom padding */}
                <div className="mt-3 pt-3 border-t border-[#F0EFEB]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86] mb-1.5 px-0.5">
                    Quick Select
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                    <button
                      type="button"
                      onClick={() => handleQuickSelect("thisWeekend")}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F7F6F3] text-[#555] hover:bg-[#0B5D45]/10 hover:text-[#0B5D45] transition-colors"
                    >
                      This Weekend
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSelect("nextWeekend")}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F7F6F3] text-[#555] hover:bg-[#0B5D45]/10 hover:text-[#0B5D45] transition-colors"
                    >
                      Next Weekend
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSelect("next7Days")}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F7F6F3] text-[#555] hover:bg-[#0B5D45]/10 hover:text-[#0B5D45] transition-colors"
                    >
                      Next 7 Days
                    </button>
                    {(checkIn || checkOut) && (
                      <button
                        type="button"
                        onClick={() => handleQuickSelect("flexible")}
                        className="ml-auto text-xs text-[#8B8B86] hover:text-[#171717] hover:underline transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {checkIn && (
                  <div className="mt-3 pt-2.5 border-t border-[#F0EFEB] flex items-center justify-between">
                    <span className="text-xs text-[#6B6B67]">
                      {checkIn && checkOut ? `${checkIn} → ${checkOut}` : "Select check-out date"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveDropdown("guests")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B5D45] text-white hover:bg-[#084936] text-xs font-semibold transition-colors shadow-xs"
                    >
                      <span>Continue to Guests</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 4. Check Out ─────────────────────────────────────────────── */}
          <div className="md:col-span-2">
            <div
              onClick={() => openDates("checkOut")}
              className={`p-3 md:px-5 rounded-xl cursor-pointer transition-colors ${
                activeDropdown === "dates" && calSelectingField === "checkOut"
                  ? "bg-black/5"
                  : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarCheck size={18} className="text-[#0B5D45] shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">Check out</div>
                  <div className={`text-[15px] font-semibold mt-0.5 truncate ${checkOut ? "text-[#171717]" : "text-[#9B9B97]"}`}>
                    {fmtDate(checkOut)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. Guests + Search ───────────────────────────────────────── */}
          <div className="md:col-span-2 lg:col-span-3 relative p-2 md:pl-3 md:pr-1.5 flex items-center justify-between">
            <div
              onClick={() =>
                setActiveDropdown(activeDropdown === "guests" ? null : "guests")
              }
              className={`cursor-pointer rounded-xl p-2 flex-1 mr-1.5 min-w-0 transition-colors ${
                activeDropdown === "guests" ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#171717] shrink-0 mt-0.5" />
                <div className="overflow-hidden">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67]">Guests</div>
                  <div className="text-[15px] text-[#171717] font-semibold mt-0.5 truncate">
                    {guests} {guests === 1 ? "guest" : "guests"}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={handleSearch}
              className="bg-[#0B5D45] hover:bg-[#084936] text-white px-4 lg:px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-[14px] lg:text-[15px] shrink-0 shadow-md hover:shadow-lg"
              aria-label="Search stays"
            >
              <Search size={16} strokeWidth={2.5} />
              <span className="hidden lg:inline">Search</span>
            </button>

            {/* Guests Popover */}
            {activeDropdown === "guests" && (
              <div className={`${popoverBase} w-72 right-0 left-auto p-4.5 text-[#171717]`}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B86] mb-3.5 px-0.5">
                  Guests
                </div>
                <div className="flex items-center justify-between px-0.5">
                  <div>
                    <div className="text-[15px] font-semibold text-[#171717]">Adults &amp; Children</div>
                    <div className="text-[12px] text-[#6B6B67] mt-0.5">Ages 13 or above</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      className="w-8 h-8 rounded-lg border border-[#E2E0DA] bg-[#F7F6F3] flex items-center justify-center text-[#171717] hover:border-[#171717] text-base font-semibold transition-colors"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-bold text-[#171717] text-[15px]">
                      {guests}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGuests(Math.min(10, guests + 1))}
                      className="w-8 h-8 rounded-lg border border-[#E2E0DA] bg-[#F7F6F3] flex items-center justify-center text-[#171717] hover:border-[#171717] text-base font-semibold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
