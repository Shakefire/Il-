"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PropertyCard from "@/components/PropertyCard";
import MapPanel from "@/components/MapPanel";
import SearchBar from "@/components/SearchBar";
import { PROPERTIES } from "@/data/properties";
import { SlidersHorizontal, Sun, RotateCcw, Map, List } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialDestination = searchParams.get("destination") || "";
  const initialGuests = Number(searchParams.get("guests")) || 1;
  const initialType = searchParams.get("type") || "All Types";

  const [selectedCity, setSelectedCity] = useState<string>(
    initialDestination === "Lagos" ? "Lagos" : initialDestination === "Abuja" ? "Abuja" : "All Nigeria"
  );
  const [selectedType, setSelectedType] = useState<string>(initialType);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | "any">("any");
  const [solarOnly, setSolarOnly] = useState<boolean>(false);
  const [maxPrice, setMaxPrice] = useState<number>(200000);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [showMobileMap, setShowMobileMap] = useState<boolean>(false);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return PROPERTIES.filter((property) => {
      // City filter
      if (selectedCity && selectedCity !== "All Nigeria") {
        if (property.city.toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }
      }

      // Property type filter
      if (selectedType && selectedType !== "All Types" && selectedType !== "all") {
        const normSelected = selectedType.toLowerCase();
        const propType = property.propertyType.toLowerCase();
        if (!propType.includes(normSelected) && !normSelected.includes(propType)) {
          return false;
        }
      }

      // Guests filter
      if (property.maxGuests < initialGuests) {
        return false;
      }

      // Bedrooms filter
      if (selectedBedrooms !== "any") {
        if (property.bedrooms < selectedBedrooms) {
          return false;
        }
      }

      // Solar / Continuous Power filter
      if (solarOnly) {
        if (!property.infrastructure.powerType.includes("Solar")) {
          return false;
        }
      }

      // Price filter
      if (property.pricePerNight > maxPrice) {
        return false;
      }

      return true;
    });
  }, [selectedCity, selectedType, initialGuests, selectedBedrooms, solarOnly, maxPrice]);

  const clearFilters = () => {
    setSelectedCity("All Nigeria");
    setSelectedType("All Types");
    setSelectedBedrooms("any");
    setSolarOnly(false);
    setMaxPrice(200000);
  };

  return (
    <div className="min-h-screen">
      {/* Compact Search Bar Header */}
      <div className="bg-white border-b border-[#E7E5E0] py-4 px-6 sm:px-8 lg:px-12 sticky top-20 z-30">
        <div className="max-w-7xl mx-auto">
          <SearchBar
            initialDestination={selectedCity !== "All Nigeria" ? selectedCity : "Abuja"}
            initialPropertyType={selectedType}
            initialGuests={initialGuests}
            compact
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border-b border-[#E7E5E0] bg-[#FAFAF8] py-4 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* City Selector Pills */}
          <div className="flex items-center gap-2">
            {["All Nigeria", "Abuja", "Lagos"].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 rounded-full text-[14px] font-medium transition-all ${
                  selectedCity === city
                    ? "bg-[#24483A] text-white shadow-sm"
                    : "bg-white text-[#6B6B67] border border-[#E7E5E0] hover:border-[#171717] hover:text-[#171717]"
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Apartment Type */}
            <div className="flex items-center gap-1.5 bg-white border border-[#E7E5E0] px-3 py-1.5 rounded-full text-[13px] text-[#6B6B67]">
              <span>Type:</span>
              {(["All Types", "Serviced Apartment", "Private Residence", "Penthouse", "Garden Villa"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    selectedType === t
                      ? "bg-[#171717] text-white"
                      : "text-[#6B6B67] hover:text-[#171717]"
                  }`}
                >
                  {t === "All Types" ? "All" : t.replace("Serviced ", "").replace("Private ", "").replace("Garden ", "")}
                </button>
              ))}
            </div>

            {/* Bedrooms */}
            <div className="flex items-center gap-1.5 bg-white border border-[#E7E5E0] px-3 py-1.5 rounded-full text-[13px] text-[#6B6B67]">
              <span>Bedrooms:</span>
              {(["any", 1, 2, 3] as const).map((b) => (
                <button
                  key={String(b)}
                  type="button"
                  onClick={() => setSelectedBedrooms(b)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    selectedBedrooms === b
                      ? "bg-[#171717] text-white"
                      : "text-[#6B6B67] hover:text-[#171717]"
                  }`}
                >
                  {b === "any" ? "Any" : `${b}+`}
                </button>
              ))}
            </div>

            {/* Solar Inverter Toggle */}
            <button
              type="button"
              onClick={() => setSolarOnly(!solarOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border transition-all ${
                solarOnly
                  ? "bg-[#EDF3F0] text-[#24483A] border-[#24483A]"
                  : "bg-white text-[#6B6B67] border-[#E7E5E0] hover:border-[#171717]"
              }`}
            >
              <Sun size={14} className={solarOnly ? "text-[#24483A]" : "text-[#8B8B86]"} />
              <span>Solar Backup Only</span>
            </button>

            {/* Clear filters button */}
            {(selectedCity !== "All Nigeria" ||
              selectedType !== "All Types" ||
              selectedBedrooms !== "any" ||
              solarOnly ||
              maxPrice < 200000) && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-[13px] text-[#8B8B86] hover:text-[#171717] transition-colors ml-1"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Mobile Map / List Toggle */}
          <div className="lg:hidden w-full flex justify-end">
            <button
              type="button"
              onClick={() => setShowMobileMap(!showMobileMap)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#171717] text-white text-[13px] font-medium shadow-md"
            >
              {showMobileMap ? (
                <>
                  <List size={14} />
                  <span>Show list view</span>
                </>
              ) : (
                <>
                  <Map size={14} />
                  <span>Show map</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Results Body */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
          {/* Left Column: Stays List */}
          <div
            className={`lg:col-span-7 space-y-8 ${
              showMobileMap ? "hidden lg:block" : "block"
            }`}
          >
            {/* Results metadata */}
            <div className="flex items-baseline justify-between border-b border-[#E7E5E0] pb-4">
              <h2 className="text-[17px] font-medium text-[#171717]">
                {filteredProperties.length}{" "}
                {filteredProperties.length === 1 ? "stay" : "stays"} available{" "}
                {selectedCity !== "All Nigeria" ? `in ${selectedCity}` : "across Nigeria"}
              </h2>
              <span className="text-[13px] text-[#8B8B86]">
                Verified infrastructure & 24/7 power
              </span>
            </div>

            {/* Results Grid */}
            {filteredProperties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-12">
                {filteredProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    onHover={(id) => setHoveredPropertyId(id)}
                    isHovered={hoveredPropertyId === property.id}
                  />
                ))}
              </div>
            ) : (
              /* Calm Empty State */
              <div className="text-center py-20 px-4 space-y-4 max-w-md mx-auto">
                <h3 className="font-display text-2xl text-[#171717]">
                  No stays match your criteria
                </h3>
                <p className="text-[15px] text-[#6B6B67] leading-relaxed">
                  Try adjusting your dates, expanding your bedroom requirements, or resetting your filters.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-6 py-2.5 bg-[#24483A] text-white text-sm font-medium rounded-xl hover:bg-[#1B372C] transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Quiet Map */}
          <div
            className={`lg:col-span-5 ${
              showMobileMap ? "block" : "hidden lg:block"
            }`}
          >
            <MapPanel
              properties={filteredProperties}
              hoveredPropertyId={hoveredPropertyId}
              onHoverProperty={(id) => setHoveredPropertyId(id)}
              selectedCity={selectedCity === "All Nigeria" ? "Abuja" : selectedCity}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#6B6B67]">
          Loading stays...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
