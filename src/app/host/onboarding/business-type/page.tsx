"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import { Home, Building2, ArrowRight, Phone, Check } from "lucide-react";

const HOST_OPTIONS = [
  {
    id: "individual_owner",
    title: "I directly own the property",
    subtitle: "Individual Property Owner",
    desc: "You own the apartment or residence and hold the title deed, C of O, or utility records.",
    icon: Home,
  },
  {
    id: "property_manager",
    title: "I manage property for an owner",
    subtitle: "Authorized Property Manager",
    desc: "You are an agent or hospitality manager with written authority or contract to host.",
    icon: Building2,
  },
  {
    id: "company",
    title: "I represent a registered corporate entity",
    subtitle: "Corporate Entity / Hospitality Brand",
    desc: "The properties are owned or leased under a registered Nigerian business (CAC).",
    icon: Building2,
  },
];

export default function BusinessTypeStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectHostType = (type: "individual_owner" | "property_manager" | "company") => {
    updateData({ hostType: type });
    setError(null);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (data.hostType === "company" && !data.companyName.trim()) {
      setError("Please provide your registered company or business name.");
      return;
    }

    setIsNavigating(true);
    // Background save to backend
    saveStepData(1).catch(() => null);
    router.push("/host/onboarding/profile");
  };

  return (
    <div className="bg-white border border-[#E7E5E0] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_12px_24px_-4px_rgba(0,0,0,0.05),0_24px_48px_-12px_rgba(0,0,0,0.07)]">
      <div className="mb-8">
        <span className="text-[11px] font-bold text-[#0B5D45] uppercase tracking-widest bg-[#EDF5F2] px-3 py-1 rounded-full border border-[#0B5D45]/15">
          Stage 1 of 6 • Qualification
        </span>
        <h1 className="font-display text-2xl sm:text-3xl text-[#171717] font-normal tracking-tight mt-3 mb-2">
          How will you list on Ilé?
        </h1>
        <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
          Select your operational structure. This helps us customize your verification requirements and payout settings.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleContinue} className="space-y-6">
        {/* Host Type Selection Cards */}
        <div className="space-y-3">
          {HOST_OPTIONS.map((opt) => {
            const isSelected = data.hostType === opt.id;
            const Icon = opt.icon;

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectHostType(opt.id as any)}
                className={`relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                  isSelected
                    ? "border-[#0B5D45] bg-[#F4F7F5] shadow-xs ring-1 ring-[#0B5D45]"
                    : "border-[#E7E5E0] bg-white hover:border-[#D1CEC7] hover:bg-[#FAFAF8]"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-[#0B5D45] text-white" : "bg-[#F0EFEA] text-[#171717]"
                  }`}
                >
                  <Icon size={20} />
                </div>

                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-[#171717]">{opt.title}</h3>
                    <span className="text-[11px] font-medium text-[#6B6B67] bg-white border border-[#E7E5E0] px-2 py-0.5 rounded-md hidden sm:inline">
                      {opt.subtitle}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#6B6B67] mt-1 leading-snug">{opt.desc}</p>
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? "border-[#0B5D45] bg-[#0B5D45] text-white"
                        : "border-[#D1CEC7] bg-white"
                    }`}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Corporate Details if Corporate or Manager */}
        {(data.hostType === "company" || data.hostType === "property_manager") && (
          <div className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-4 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-[#171717]">
                  {data.hostType === "company" ? "Registered Company Name" : "Management Agency / Brand"}
                </label>
                <span className="text-[12px] text-[#8B8B86]">As registered with CAC</span>
              </div>
              <input
                type="text"
                value={data.companyName}
                onChange={(e) => updateData({ companyName: e.target.value })}
                placeholder="e.g. Maitama Executive Suites Ltd."
                className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
              />
            </div>

            {data.hostType === "company" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-[#171717]">
                    CAC Registration Number (RC / BN)
                  </label>
                  <span className="text-[12px] text-[#8B8B86]">Optional for preliminary draft</span>
                </div>
                <input
                  type="text"
                  value={data.companyRegNumber}
                  onChange={(e) => updateData({ companyRegNumber: e.target.value })}
                  placeholder="e.g. RC 1928374"
                  className="w-full h-[50px] px-4 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
                />
              </div>
            )}
          </div>
        )}

        {/* Direct Contact / WhatsApp Phone */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-[#171717]">
              Primary Host / Operations Phone
            </label>
            <span className="text-[12px] text-[#8B8B86]">WhatsApp or direct Nigerian line</span>
          </div>
          <div className="relative">
            <input
              type="tel"
              value={data.phone}
              onChange={(e) => updateData({ phone: e.target.value })}
              placeholder="e.g. +234 803 123 4567"
              className="w-full h-[50px] px-4 pr-10 bg-white border border-[#E7E5E0] rounded-xl text-[14.5px] text-[#171717] placeholder:text-[#9E9E9A] focus:border-[#0B5D45] focus:ring-2 focus:ring-[#0B5D45]/10 outline-none transition-all"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8B8B86]">
              <Phone size={17} />
            </div>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div className="pt-4 border-t border-[#E7E5E0] flex items-center justify-between gap-4">
          <Link
            href="/host/dashboard"
            className="text-[13.5px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors"
          >
            Skip to Dashboard
          </Link>

          <button
            type="submit"
            disabled={isNavigating}
            className="h-[50px] px-7 rounded-xl bg-[#0B5D45] hover:bg-[#084936] text-white text-[14.5px] font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow cursor-pointer"
          >
            <span>Continue to Profile</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
