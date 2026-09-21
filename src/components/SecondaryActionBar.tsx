"use client";

import { useState } from "react";
import {
  SlidersHorizontal,
  ArrowDownWideNarrow,
  LayoutGrid,
  Map as MapIcon,
  Check,
  ChevronDown,
} from "lucide-react";

export type ViewMode = "grid" | "map";
export type SortOption = "newest" | "price_asc" | "price_desc" | "rating";

interface SecondaryActionBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterCount?: number;
  onOpenFilters?: () => void;
}

export default function SecondaryActionBar({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  filterCount = 0,
  onOpenFilters,
}: SecondaryActionBarProps) {
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const sortOptions = [
    { value: "newest", label: "New first" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "rating", label: "Highest Rated" },
  ];

  const currentSortLabel =
    sortOptions.find((opt) => opt.value === sortBy)?.label || "New first";

  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
      {/* 1. Sliders for Filters / View Details */}
      <button
        type="button"
        onClick={onOpenFilters}
        className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-[10px] border border-[#E2E0DA] hover:border-[#171717] bg-white text-[#171717] transition-colors text-[14px] font-medium shadow-xs hover:shadow-sm"
        aria-label="Filter stays or view details"
      >
        <SlidersHorizontal size={15} className="text-[#171717]" />
        <span>Filters</span>
        {filterCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-[#0B5D45] text-white text-[11px] font-semibold flex items-center justify-center">
            {filterCount}
          </span>
        )}
      </button>

      {/* 2. Sort Dropdown (New first) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          className="inline-flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-[10px] border border-[#E2E0DA] hover:border-[#171717] bg-white text-[#171717] text-[14px] font-medium transition-colors shadow-xs hover:shadow-sm"
          aria-label="Sort options"
        >
          <ArrowDownWideNarrow size={15} className="text-[#6B6B67]" />
          <span className="text-[#6B6B67] hidden xs:inline">Sort:</span>
          <span className="font-semibold">{currentSortLabel}</span>
          <ChevronDown size={14} className="text-[#6B6B67]" />
        </button>

        {sortDropdownOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-[10px] border border-[#E2E0DA] shadow-xl py-1.5 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onSortChange(opt.value as SortOption);
                  setSortDropdownOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors ${
                  sortBy === opt.value
                    ? "bg-[#0B5D45]/10 text-[#0B5D45] font-semibold"
                    : "text-[#171717] hover:bg-[#F7F6F3]"
                }`}
              >
                <span>{opt.label}</span>
                {sortBy === opt.value && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. View Switch: Grid vs Map */}
      <div className="inline-flex items-center p-1 rounded-[10px] bg-[#F4F3F0] border border-[#E2E0DA]">
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${
            viewMode === "grid"
              ? "bg-white text-[#171717] shadow-xs font-semibold"
              : "text-[#6B6B67] hover:text-[#171717]"
          }`}
          aria-label="Grid view"
        >
          <LayoutGrid size={15} />
          <span className="hidden sm:inline">Grid</span>
        </button>

        <button
          type="button"
          onClick={() => onViewModeChange("map")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all ${
            viewMode === "map"
              ? "bg-[#0B5D45] text-white shadow-xs font-semibold"
              : "text-[#6B6B67] hover:text-[#171717]"
          }`}
          aria-label="Map view"
        >
          <MapIcon size={15} />
          <span className="hidden sm:inline">Map</span>
        </button>
      </div>
    </div>
  );
}
