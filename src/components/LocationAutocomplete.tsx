"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, X } from "lucide-react";

export interface SelectedLocation {
  displayName: string;
  name: string;
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
}

interface LocationAutocompleteProps {
  placeholder?: string;
  initialValue?: string;
  onSelect: (location: SelectedLocation) => void;
  className?: string;
  inputClassName?: string;
  required?: boolean;
}

export default function LocationAutocomplete({
  placeholder = "Search location, landmark or neighborhood...",
  initialValue = "",
  onSelect,
  className = "",
  inputClassName = "",
  required = false,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SelectedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchLocations = async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(trimmed)}`);
      const result = await res.json();

      if (result.success && Array.isArray(result.data)) {
        setSuggestions(result.data);
      } else {
        setSuggestions([]);
        if (result.error) setError(result.error);
      }
    } catch {
      setError("Unable to search locations right now. Please try again.");
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchLocations(val);
    }, 350);
  };

  const handleSelect = (loc: SelectedLocation) => {
    // Pick the most concise meaningful display text for input
    const display = loc.name || loc.neighborhood || loc.city || loc.displayName;
    setQuery(display);
    setIsOpen(false);
    onSelect(loc);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setHasSearched(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <MapPin size={18} className="absolute left-3.5 text-[#0B5D45] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0 || query.length >= 2) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className={`w-full pl-10 pr-10 py-3 rounded-xl border border-[#E7E5E0] bg-white text-[#171717] placeholder-[#8B8B86] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#0B5D45] focus:border-transparent transition-all ${inputClassName}`}
        />
        {isLoading ? (
          <Loader2 size={16} className="absolute right-3.5 text-[#8B8B86] animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-[#8B8B86] hover:text-[#171717] hover:bg-neutral-100 transition-colors"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (query.trim().length >= 2 || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E7E5E0] rounded-xl shadow-xl max-h-72 overflow-y-auto z-50 divide-y divide-[#F2F0EB]">
          {isLoading && suggestions.length === 0 ? (
            <div className="p-4 text-center text-sm text-[#8B8B86] flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[#0B5D45]" />
              <span>Searching real places across Nigeria...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((loc, idx) => (
              <button
                key={`${loc.latitude}-${loc.longitude}-${idx}`}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full text-left p-3.5 hover:bg-[#F7F6F2] transition-colors flex items-start gap-3 group"
              >
                <div className="mt-0.5 w-6 h-6 rounded-md bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <MapPin size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#171717] truncate group-hover:text-[#0B5D45] transition-colors">
                    {loc.name || loc.neighborhood || loc.city}
                  </p>
                  <p className="text-[12px] text-[#6B6B67] truncate mt-0.5">
                    {loc.displayName}
                  </p>
                </div>
              </button>
            ))
          ) : hasSearched && !isLoading ? (
            <div className="p-4 text-center text-sm text-[#8B8B86]">
              {error || `No locations found for "${query}". Try a landmark or neighborhood.`}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
