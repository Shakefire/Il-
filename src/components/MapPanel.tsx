"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Property } from "@/types";
import { formatNaira } from "@/lib/utils";
import { Navigation, X, Plus, Minus, RotateCcw, MapPin, ExternalLink } from "lucide-react";

interface MapPanelProps {
  properties: Property[];
  hoveredPropertyId: string | null;
  onHoverProperty: (id: string | null) => void;
  selectedCity?: string;
}

export default function MapPanel({
  properties,
  hoveredPropertyId,
  onHoverProperty,
  selectedCity = "Abuja",
}: MapPanelProps) {
  // Current active map view: "Abuja" or "Lagos"
  const [activeCity, setActiveCity] = useState<"Abuja" | "Lagos">(
    selectedCity.toLowerCase() === "lagos" ? "Lagos" : "Abuja"
  );
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);

  // Sync with selectedCity prop when it changes from outside
  useEffect(() => {
    if (selectedCity.toLowerCase() === "lagos") {
      setActiveCity("Lagos");
    } else if (selectedCity.toLowerCase() === "abuja") {
      setActiveCity("Abuja");
    }
  }, [selectedCity]);

  // Auto-switch map city when a property from another city is hovered in the list!
  useEffect(() => {
    if (hoveredPropertyId) {
      const hovered = properties.find((p) => p.id === hoveredPropertyId);
      if (hovered) {
        if (hovered.city.toLowerCase() === "lagos" && activeCity !== "Lagos") {
          setActiveCity("Lagos");
        } else if (hovered.city.toLowerCase() === "abuja" && activeCity !== "Abuja") {
          setActiveCity("Abuja");
        }
      }
    }
  }, [hoveredPropertyId, properties, activeCity]);

  // Filter properties for the currently active city map
  const cityFiltered = properties.filter(
    (p) => p.city.toLowerCase() === activeCity.toLowerCase()
  );

  const abujaCount = properties.filter((p) => p.city.toLowerCase() === "abuja").length;
  const lagosCount = properties.filter((p) => p.city.toLowerCase() === "lagos").length;

  const abujaNeighborhoods = ["Maitama", "Wuse 2", "Asokoro", "Guzape", "Jabi"];
  const lagosNeighborhoods = ["Ikoyi", "Victoria Island", "Lekki Phase 1", "Ikeja GRA"];

  const currentNeighborhoods =
    activeCity === "Abuja" ? abujaNeighborhoods : lagosNeighborhoods;

  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.5, z + 0.15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.85, z - 0.15));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setActiveNeighborhood(null);
  };

  return (
    <div className="relative w-full h-[620px] lg:h-[calc(100vh-180px)] rounded-2xl overflow-hidden border border-[#E2E0DA] bg-[#F4F3F0] shadow-sm select-none flex flex-col">
      {/* 1. Top Controls Bar: City Switcher Tabs & Live Count */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-3 pointer-events-none">
        {/* City Switcher Pill Tabs */}
        <div className="inline-flex items-center p-1 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E0DA] shadow-md pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setActiveCity("Abuja");
              setActiveProperty(null);
              setActiveNeighborhood(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
              activeCity === "Abuja"
                ? "bg-[#0B5D45] text-white shadow-xs"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <MapPin size={13} />
            <span>Abuja</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
              activeCity === "Abuja" ? "bg-white/20 text-white" : "bg-black/5 text-[#6B6B67]"
            }`}>
              {abujaCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCity("Lagos");
              setActiveProperty(null);
              setActiveNeighborhood(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${
              activeCity === "Lagos"
                ? "bg-[#0B5D45] text-white shadow-xs"
                : "text-[#6B6B67] hover:text-[#171717]"
            }`}
          >
            <Navigation size={13} />
            <span>Lagos</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${
              activeCity === "Lagos" ? "bg-white/20 text-white" : "bg-black/5 text-[#6B6B67]"
            }`}>
              {lagosCount}
            </span>
          </button>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="inline-flex items-center p-1 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E0DA] shadow-md pointer-events-auto gap-0.5">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-[#171717] hover:bg-black/5 transition-colors"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-[#171717] hover:bg-black/5 transition-colors"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg text-[#6B6B67] hover:text-[#171717] hover:bg-black/5 transition-colors"
            title="Reset View"
            aria-label="Reset view"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* 2. Neighborhood Filter Pills directly beneath top bar */}
      <div className="absolute top-18 left-4 right-4 z-20 flex flex-wrap gap-1.5 pointer-events-none">
        {currentNeighborhoods.map((nb) => (
          <button
            key={nb}
            type="button"
            onClick={() => setActiveNeighborhood(activeNeighborhood === nb ? null : nb)}
            className={`pointer-events-auto text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-xs transition-all ${
              activeNeighborhood === nb
                ? "bg-[#171717] text-white border-[#171717]"
                : "bg-white/90 backdrop-blur-md text-[#555552] border-[#E2E0DA] hover:border-[#171717]"
            }`}
          >
            {nb}
          </button>
        ))}
      </div>

      {/* 3. Scalable SVG Map Canvas */}
      <div
        className="w-full h-full relative overflow-hidden flex items-center justify-center transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          className="w-full h-full object-cover"
          viewBox="0 0 800 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base Landmass */}
          <rect width="800" height="900" fill="#F4F3F0" />

          {activeCity === "Lagos" ? (
            /* LAGOS WATERWAYS & LANDMARKS */
            <>
              {/* Atlantic Ocean */}
              <path
                d="M0 690 C 240 680, 520 710, 800 690 L 800 900 L 0 900 Z"
                fill="#D8E4E9"
                opacity="0.95"
              />
              {/* Lagos Lagoon (Upper) */}
              <path
                d="M0 230 C 260 190, 480 250, 800 220 L 800 410 C 580 430, 260 390, 0 420 Z"
                fill="#D8E4E9"
                opacity="0.9"
              />
              {/* Five Cowries Creek / Lekki Waterway */}
              <path
                d="M80 520 C 260 500, 540 530, 800 510 L 800 545 C 540 565, 260 535, 80 555 Z"
                fill="#D8E4E9"
                opacity="0.8"
              />
              {/* Arterial Bridges & Roadways */}
              <g stroke="#E2DFD8" strokeWidth="4" strokeLinecap="round">
                {/* Third Mainland Bridge */}
                <path d="M120 220 C 200 320, 260 420, 310 500" stroke="#DDD9D0" strokeWidth="4.5" />
                {/* Lekki-Ikoyi Link Bridge */}
                <path d="M430 480 L 460 540" stroke="#0B5D45" strokeWidth="2.5" strokeDasharray="4 2" />
                {/* Lekki-Epe Expressway */}
                <path d="M350 560 L 780 580" />
                {/* Ozumba Mbadiwe Avenue */}
                <path d="M280 515 L 430 510" />
                {/* Bourdillon Road (Ikoyi) */}
                <path d="M330 460 L 440 450" />
              </g>
              {/* Typographic Labels */}
              <g fill="#999790" fontSize="13" fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="0.08em">
                <text x="350" y="450">OLD IKOYI</text>
                <text x="290" y="590">VICTORIA ISLAND</text>
                <text x="510" y="550">LEKKI PHASE 1</text>
                <text x="180" y="270">IKEJA GRA</text>
                <text x="280" y="660">EKO ATLANTIC</text>
              </g>
            </>
          ) : (
            /* ABUJA LAKES & LANDMARKS */
            <>
              {/* Jabi Lake */}
              <path
                d="M170 350 C 230 330, 310 360, 320 420 C 300 480, 200 490, 160 440 C 130 400, 140 360, 170 350 Z"
                fill="#D8E4E9"
                opacity="0.95"
              />
              {/* Aso Rock Landmark Contour */}
              <path
                d="M620 180 C 660 140, 750 170, 770 230 C 780 290, 700 330, 640 300 C 590 270, 580 220, 620 180 Z"
                fill="#EAE8E2"
                stroke="#DDD9D0"
                strokeWidth="2"
              />
              {/* Arterial Roadways */}
              <g stroke="#E2DFD8" strokeWidth="4" strokeLinecap="round">
                {/* Shehu Shagari Way */}
                <path d="M420 160 L 450 780" />
                {/* Ahmadu Bello Way */}
                <path d="M280 180 L 320 800" />
                {/* Nnamdi Azikiwe Ring Road */}
                <path d="M90 260 C 260 210, 520 220, 740 280" />
                {/* Outer Southern Expressway */}
                <path d="M120 620 C 340 590, 560 630, 760 650" />
              </g>
              {/* Typographic Labels */}
              <g fill="#999790" fontSize="13" fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="0.08em">
                <text x="430" y="310">MAITAMA</text>
                <text x="290" y="420">WUSE 2</text>
                <text x="520" y="440">ASOKORO</text>
                <text x="450" y="520">GUZAPE</text>
                <text x="210" y="400">JABI</text>
                <text x="650" y="240" fill="#B0ADA6" fontSize="11">ASO ROCK</text>
              </g>
            </>
          )}
        </svg>

        {/* 4. Interactive Property Pins Placed on Map */}
        {cityFiltered.map((prop) => {
          const isHovered = hoveredPropertyId === prop.id;
          const isSelected = activeProperty?.id === prop.id;
          const isNeighborhoodMatch = activeNeighborhood
            ? prop.neighborhood.toLowerCase().includes(activeNeighborhood.toLowerCase())
            : true;

          const coords = prop.mapCoordinatesPercent || { x: 50, y: 50 };
          const shortPrice = Math.round(prop.pricePerNight / 1000) + "k";

          return (
            <div
              key={prop.id}
              style={{
                left: `${coords.x}%`,
                top: `${coords.y}%`,
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 ${
                isHovered || isSelected ? "z-40 scale-110" : "z-20"
              } ${!isNeighborhoodMatch ? "opacity-30 scale-90" : "opacity-100"}`}
              onMouseEnter={() => onHoverProperty(prop.id)}
              onMouseLeave={() => onHoverProperty(null)}
              onClick={() => setActiveProperty(prop)}
            >
              <div
                className={`px-3 py-1.5 rounded-full font-bold text-[13px] transition-all shadow-md flex items-center gap-1 ${
                  isHovered || isSelected
                    ? "bg-[#0B5D45] text-white ring-4 ring-[#0B5D45]/30 scale-105 shadow-lg"
                    : "bg-white text-[#171717] border border-[#D5D3CC] hover:border-[#171717] hover:scale-105"
                }`}
              >
                <span className="text-[11px] opacity-80">₦</span>
                <span>{shortPrice}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. Active Property Popup Card (Positioned neatly over the bottom right) */}
      {activeProperty && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-84 bg-white rounded-2xl shadow-2xl border border-[#E2E0DA] p-3.5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            type="button"
            onClick={() => setActiveProperty(null)}
            className="absolute top-2.5 right-2.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
            aria-label="Close"
          >
            <X size={14} />
          </button>

          <Link href={`/stay/${activeProperty.slug}`} className="block group">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#E7E5E0] mb-2.5">
              <Image
                src={activeProperty.coverImage}
                alt={activeProperty.title}
                fill
                sizes="340px"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {activeProperty.verified && (
                <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-full text-[11px] font-semibold text-[#171717]">
                  Verified stay
                </div>
              )}
            </div>

            <div className="px-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-[#171717] group-hover:text-[#0B5D45] transition-colors truncate">
                  {activeProperty.title}
                </h4>
                <div className="flex items-center gap-1 text-[12px] font-semibold text-[#171717]">
                  <span>★</span>
                  <span>{activeProperty.rating.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[13px] text-[#6B6B67] truncate">
                {activeProperty.neighborhood}, {activeProperty.city}
              </p>

              <div className="pt-1.5 flex items-baseline justify-between border-t border-[#F0EFEB]">
                <div className="text-[#171717]">
                  <span className="font-bold text-[16px]">{formatNaira(activeProperty.pricePerNight)}</span>
                  <span className="text-[#6B6B67] text-[12px] font-medium"> / night</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[12px] text-[#0B5D45] font-semibold group-hover:underline">
                  <span>Details</span>
                  <ExternalLink size={12} />
                </span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
