"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import { ArrowRight, ArrowLeft, MapPin, User, Calendar } from "lucide-react";

const NIGERIAN_CITIES = [
  "Abuja",
  "Lagos",
  "Port Harcourt",
  "Ibadan",
  "Enugu",
  "Calabar",
  "Kaduna",
  "Benin City",
  "Owerri",
  "Kano",
];

export default function ProfileStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!data.firstName.trim() || !data.lastName.trim()) {
      setError("Please provide your legal first and last name matching your government ID.");
      return;
    }

    // Background save to backend
    saveStepData(2).catch(() => null);
    router.push("/host/onboarding/identity");
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      <div className="mb-8">
        <span className="text-[11px] font-bold text-[#0B5D45] uppercase tracking-widest bg-[#EDF5F2] px-3 py-1 rounded-full border border-[#0B5D45]/15">
          Stage 2 of 6 • Host Profile
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
          About you &amp; your locations
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Provide your legal identity and the cities where you manage or host accommodations.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* Name Fields (2 cols) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Legal First Name</label>
              <span className="text-[12px] text-[#8B8B86]">As on Govt ID</span>
            </div>
            <input
              type="text"
              value={data.firstName}
              onChange={(e) => updateData({ firstName: e.target.value })}
              placeholder="e.g. Chukwuma"
              required
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Legal Last Name</label>
              <span className="text-[12px] text-[#8B8B86]">Surname</span>
            </div>
            <input
              type="text"
              value={data.lastName}
              onChange={(e) => updateData({ lastName: e.target.value })}
              placeholder="e.g. Adeleke"
              required
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Date of Birth & Residential Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Date of Birth</label>
              <span className="text-[12px] text-[#8B8B86]">Must be 18+</span>
            </div>
            <input
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => updateData({ dateOfBirth: e.target.value })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Residential Address</label>
              <span className="text-[12px] text-[#8B8B86]">Personal address</span>
            </div>
            <input
              type="text"
              value={data.residentialAddress}
              onChange={(e) => updateData({ residentialAddress: e.target.value })}
              placeholder="e.g. 14 Danube Street, Maitama, Abuja"
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Operating City & Neighborhoods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Primary Operating City</label>
              <span className="text-[12px] text-[#8B8B86]">Key market</span>
            </div>
            <select
              value={data.operatingCity}
              onChange={(e) => updateData({ operatingCity: e.target.value })}
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all cursor-pointer"
            >
              {NIGERIAN_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-semibold text-[#171717]">Operating Neighborhoods</label>
              <span className="text-[12px] text-[#8B8B86]">E.g. Maitama, Wuse 2</span>
            </div>
            <input
              type="text"
              value={data.operatingAreas}
              onChange={(e) => updateData({ operatingAreas: e.target.value })}
              placeholder="e.g. Maitama, Guzape, Lekki Phase 1"
              className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Short Bio */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-[#171717]">About Your Hosting Practice</label>
            <span className="text-[12px] text-[#8B8B86]">Visible on your partner profile</span>
          </div>
          <textarea
            rows={3}
            value={data.bio}
            onChange={(e) => updateData({ bio: e.target.value })}
            placeholder="Introduce yourself or your hospitality brand to potential guests..."
            className="w-full p-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all resize-none"
          />
        </div>

        {/* Action Row */}
        <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between gap-4">
          <Link
            href="/host/onboarding/business-type"
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Business Type</span>
          </Link>

          <button
            type="submit"
            className="h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Continue to Identity KYC</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
