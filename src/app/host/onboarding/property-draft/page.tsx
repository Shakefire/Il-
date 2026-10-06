"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowRight, ArrowLeft, Home, Zap, Shield, Wifi, Droplets, Check } from "lucide-react";

const PROPERTY_CATEGORIES = [
  "Apartment",
  "Serviced Apartment",
  "Duplex",
  "Penthouse",
  "Villa",
  "Studio",
  "Townhouse",
];

const POWER_TYPES = [
  "Solar + Inverter with Generator Backup",
  "24/7 Dedicated Estate Generator Power",
  "Automatic Inverter & Public Utility",
  "Dedicated Silent Generator",
];

export default function PropertyDraftStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.propertyTitle.trim()) {
      setError("Please provide a descriptive title for your first property listing draft.");
      return;
    }

    if (!data.nightlyRate || data.nightlyRate < 10000) {
      setError("Please enter a valid nightly rate (minimum ₦10,000).");
      return;
    }

    // Background save to backend
    saveStepData(5).catch(() => null);
    router.push("/host/onboarding/review");
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      <div className="mb-8">
        <span className="text-[11px] font-bold text-[#0B5D45] uppercase tracking-widest bg-[#EDF5F2] px-3 py-1 rounded-full border border-[#0B5D45]/15">
          Stage 5 of 6 • Property Draft
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
          Your initial property draft
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Create the draft for your first shortlet on Ilé. You will be able to add more photos and details before publishing live.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-[#171717]">Listing Headline / Title</label>
            <span className="text-[12px] text-[#8B8B86]">Catchy &amp; descriptive</span>
          </div>
          <input
            type="text"
            value={data.propertyTitle}
            onChange={(e) => updateData({ propertyTitle: e.target.value })}
            placeholder="e.g. Modern 2-Bedroom Luxury Suite in Central Maitama"
            required
            className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
          />
        </div>

        {/* Category & Neighborhood */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Property Category</label>
              <span className="text-[12px] text-[#8B8B86]">Space style</span>
            </div>
            <select
              value={data.propertyType}
              onChange={(e) => updateData({ propertyType: e.target.value })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all cursor-pointer"
            >
              {PROPERTY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Neighborhood / Area</label>
              <span className="text-[12px] text-[#8B8B86]">In {data.operatingCity || "Abuja"}</span>
            </div>
            <input
              type="text"
              value={data.neighborhood}
              onChange={(e) => updateData({ neighborhood: e.target.value })}
              placeholder="e.g. Maitama, Wuse 2, or Lekki Phase 1"
              required
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Bedrooms, Bathrooms & Price Per Night */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Bedrooms</label>
            <input
              type="number"
              min={1}
              max={20}
              value={data.bedrooms}
              onChange={(e) => updateData({ bedrooms: Number(e.target.value) })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-[13px] font-semibold text-[#171717] block mb-1.5">Bathrooms</label>
            <input
              type="number"
              min={1}
              max={20}
              value={data.bathrooms}
              onChange={(e) => updateData({ bathrooms: Number(e.target.value) })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Nightly Rate (₦)</label>
              <span className="text-[12px] text-[#8B8B86]">Naira</span>
            </div>
            <input
              type="number"
              min={10000}
              step={5000}
              value={data.nightlyRate}
              onChange={(e) => updateData({ nightlyRate: Number(e.target.value) })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] font-semibold focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Power Supply Specification */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-[#171717]">Primary Power Infrastructure</label>
            <span className="text-[12px] text-[#0B5D45] font-medium">Critical for guest satisfaction</span>
          </div>
          <select
            value={data.powerType}
            onChange={(e) => updateData({ powerType: e.target.value })}
            className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all cursor-pointer"
          >
            {POWER_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </div>

        {/* Quality Commitments */}
        <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-3">
          <h3 className="text-[14px] font-semibold text-[#171717]">Ilé Marketplace Standards Commitment</h3>
          <p className="text-[12.5px] text-[#6B6B67]">
            Please confirm your listing meets our core residential hosting standards:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E7E5E0] cursor-pointer">
              <input
                type="checkbox"
                checked={data.commitPower}
                onChange={(e) => updateData({ commitPower: e.target.checked })}
                className="w-4 h-4 rounded text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
              />
              <span className="text-[13px] text-[#171717] font-medium">24/7 Power Backup</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E7E5E0] cursor-pointer">
              <input
                type="checkbox"
                checked={data.commitSecurity}
                onChange={(e) => updateData({ commitSecurity: e.target.checked })}
                className="w-4 h-4 rounded text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
              />
              <span className="text-[13px] text-[#171717] font-medium">Estate Gate Security</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E7E5E0] cursor-pointer">
              <input
                type="checkbox"
                checked={data.commitInternet}
                onChange={(e) => updateData({ commitInternet: e.target.checked })}
                className="w-4 h-4 rounded text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
              />
              <span className="text-[13px] text-[#171717] font-medium">High-Speed Wi-Fi</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E7E5E0] cursor-pointer">
              <input
                type="checkbox"
                checked={data.commitWater}
                onChange={(e) => updateData({ commitWater: e.target.checked })}
                className="w-4 h-4 rounded text-[#0B5D45] focus:ring-[#0B5D45]/20 cursor-pointer accent-[#0B5D45]"
              />
              <span className="text-[13px] text-[#171717] font-medium">Treated Clean Water</span>
            </label>
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between gap-4">
          <Link
            href="/host/onboarding/authority"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Authority</span>
          </Link>

          <button
            type="submit"
            className="h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Continue to Review &amp; Submit</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
