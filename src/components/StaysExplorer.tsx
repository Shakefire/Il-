"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Property } from "@/types";
import PropertyCard from "@/components/PropertyCard";
import SecondaryActionBar, { ViewMode, SortOption } from "@/components/SecondaryActionBar";
import MapPanel from "@/components/MapPanel";
import { ArrowRight, X } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface StaysExplorerProps {
  initialProperties: Property[];
}

export default function StaysExplorer({ initialProperties }: StaysExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState<number>(500000);

  // Filter & Sort properties
  const filteredAndSortedProperties = useMemo(() => {
    let result = [...initialProperties];

    if (selectedCity !== "All") {
      result = result.filter(
        (p) => p.city.toLowerCase() === selectedCity.toLowerCase()
      );
    }

    result = result.filter((p) => p.pricePerNight <= maxPrice);

    result.sort((a, b) => {
      // 1. Availability ranking: Available stays first, reserved stays lower down
      const aReserved = Boolean(a.isReserved);
      const bReserved = Boolean(b.isReserved);
      if (aReserved !== bReserved) {
        return aReserved ? 1 : -1;
      }

      // 2. User selected sort within each tier
      if (sortBy === "price_asc") {
        return a.pricePerNight - b.pricePerNight;
      } else if (sortBy === "price_desc") {
        return b.pricePerNight - a.pricePerNight;
      } else if (sortBy === "rating") {
        return b.rating - a.rating;
      }
      return 0;
    });

    return result;
  }, [initialProperties, selectedCity, maxPrice, sortBy]);

  const activeFilterCount =
    (selectedCity !== "All" ? 1 : 0) + (maxPrice < 500000 ? 1 : 0);

  return (
    <div className="w-full space-y-8">
      {/* Consolidated Header & Unified Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#EAE8E3]">
        {/* Title & Context */}
        <div>
          <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
            Curated stays
          </span>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#171717] font-normal mt-1">
            Top picks for you
          </h2>
          <p className="text-[14px] text-[#6B6B67] pt-1">
            Showing <strong className="text-[#171717] font-semibold">{filteredAndSortedProperties.length}</strong> stays in Abuja & Lagos
          </p>
        </div>

        {/* Consolidated Action Bar: Filters, Sort (New first), View Toggles uniformly aligned to the right edge */}
        <div className="flex flex-wrap items-center gap-3">
          <SecondaryActionBar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterCount={activeFilterCount}
            onOpenFilters={() => setFilterModalOpen(true)}
          />

          <Link
            href="/search"
            className="hidden sm:inline-flex items-center gap-1.5 text-[14px] font-medium text-[#0B5D45] hover:text-[#084936] transition-colors ml-1"
          >
            <span>All {initialProperties.length}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Filter Modal Drawer */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#EAEAEA] space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0EFEB]">
              <h3 className="text-lg font-medium text-[#171717]">
                Filter Stays
              </h3>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F4F3F0] text-[#6B6B67] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* City selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B67] mb-2">
                City
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["All", "Abuja", "Lagos"].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors border ${
                      selectedCity === city
                        ? "bg-[#0B5D45] text-white border-[#0B5D45]"
                        : "bg-[#F7F6F3] text-[#171717] border-transparent hover:border-[#D1CEC7]"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Price slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B6B67]">
                  Max Price per Night
                </label>
                <span className="text-sm font-semibold text-[#171717]">
                  {formatNaira(maxPrice)}
                </span>
              </div>
              <input
                type="range"
                min={80000}
                max={500000}
                step={20000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#0B5D45] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#8B8B86] mt-1">
                <span>₦80,000</span>
                <span>₦500,000+</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0EFEB] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedCity("All");
                  setMaxPrice(500000);
                }}
                className="text-sm text-[#6B6B67] hover:text-[#171717] underline py-2"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="px-5 py-2.5 bg-[#0B5D45] hover:bg-[#084936] text-white font-medium rounded-lg text-sm transition-colors"
              >
                Show {filteredAndSortedProperties.length} Stays
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Grid vs Map */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 sm:gap-y-16">
          {filteredAndSortedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onHover={setHoveredId}
              isHovered={hoveredId === property.id}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Stays List in Map View */}
          <div className="lg:col-span-5 xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 max-h-[720px] overflow-y-auto pr-2 pb-6 custom-scrollbar">
            {filteredAndSortedProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onHover={setHoveredId}
                isHovered={hoveredId === property.id}
              />
            ))}
          </div>

          {/* Interactive Map Canvas */}
          <div className="lg:col-span-7 xl:col-span-7 sticky top-28">
            <MapPanel
              properties={filteredAndSortedProperties}
              hoveredPropertyId={hoveredId}
              onHoverProperty={setHoveredId}
              selectedCity={selectedCity === "All" ? "Abuja" : selectedCity}
            />
          </div>
        </div>
      )}
    </div>
  );
}
