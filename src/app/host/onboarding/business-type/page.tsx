"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/context/OnboardingContext";
import StepMotion from "@/components/onboarding/StepMotion";
import {
  Home,
  Building2,
  Users,
  ArrowRight,
  Phone,
  Check,
  AlertCircle,
  Shield,
  Loader2,
} from "lucide-react";

interface HostTypeOption {
  id: "individual_owner" | "property_manager" | "company";
  title: string;
  description: string;
  icon: typeof Home;
}

const HOST_TYPE_OPTIONS: HostTypeOption[] = [
  {
    id: "individual_owner",
    title: "Individual Host",
    description: "I host a home or apartment I own or live in.",
    icon: Home,
  },
  {
    id: "property_manager",
    title: "Co-host / Manager",
    description: "I manage properties on behalf of owners.",
    icon: Users,
  },
  {
    id: "company",
    title: "Registered Business",
    description: "I operate under a registered Nigerian business or company.",
    icon: Building2,
  },
];

export default function BusinessTypeStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();

  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Phone validation: supports local 11-digit (080...) and international format (234...)
  const validatePhone = (phoneStr: string): string | null => {
    const cleaned = phoneStr.replace(/\D/g, "");
    if (!cleaned) return "Phone number is required.";
    if (cleaned.length < 10 || cleaned.length > 14) {
      return "Please enter a valid Nigerian phone number (e.g. 0803 123 4567 or +234 803 123 4567).";
    }
    return null;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === "companyName" && data.hostType === "company") {
      if (!data.companyName.trim()) {
        newErrors.companyName = "Registered business or company name is required.";
      } else {
        delete newErrors.companyName;
      }
    }

    if (field === "phone") {
      const phoneErr = validatePhone(data.phone || "");
      if (phoneErr) {
        newErrors.phone = phoneErr;
      } else {
        delete newErrors.phone;
      }
    }

    setErrors(newErrors);
  };

  const handleSelectHostType = (type: "individual_owner" | "property_manager" | "company") => {
    updateData({ hostType: type });
    if (type !== "company") {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.companyName;
        return next;
      });
    }
  };

  // Keyboard navigation for accessible radiogroup
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % HOST_TYPE_OPTIONS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + HOST_TYPE_OPTIONS.length) % HOST_TYPE_OPTIONS.length;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleSelectHostType(HOST_TYPE_OPTIONS[index].id);
      return;
    }

    if (nextIndex !== -1) {
      const nextOption = HOST_TYPE_OPTIONS[nextIndex];
      handleSelectHostType(nextOption.id);
      optionRefs.current[nextIndex]?.focus();
    }
  };

  const handleSaveAndExit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveStepData(1);
    } catch {
      // background save
    } finally {
      setIsSaving(false);
      router.push("/host/dashboard");
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      companyName: true,
      phone: true,
    });

    const currentErrors: Record<string, string> = {};

    if (data.hostType === "company" && !data.companyName.trim()) {
      currentErrors.companyName = "Please provide your registered business or company name.";
    }

    const phoneErr = validatePhone(data.phone || "");
    if (phoneErr) {
      currentErrors.phone = phoneErr;
    }

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    setIsNavigating(true);
    try {
      await saveStepData(1);
    } catch {
      // proceed if local storage is preserved
    }
    router.push("/host/onboarding/profile");
  };

  return (
    <StepMotion>
      <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 md:p-10 shadow-xs">
        {/* 2. Progress Indicator: Restrained five-step progress indicator */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#065F46]">
              Step 1 of 5
            </span>
            <span className="text-xs text-[#9CA3AF]">•</span>
            <span className="text-xs font-medium text-[#4B5563]">
              Host Setup
            </span>
          </div>

          {/* 5-Step Segmented Bar */}
          <div className="flex items-center gap-1.5" aria-label="Step 1 of 5 completed">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  stepNum === 1
                    ? "w-8 bg-[#065F46]"
                    : "w-4 bg-[#E5E7EB]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 3. Page Introduction */}
        <div className="mb-8 max-w-2xl">
          <h1 className="font-serif text-[28px] sm:text-[32px] md:text-[36px] font-normal tracking-tight text-[#111827] leading-[1.15]">
            How will you host on Ilé?
          </h1>
          <p className="mt-2.5 text-[14px] sm:text-[15px] text-[#4B5563] leading-relaxed">
            Choose the option that best describes how you host. This helps us set up your verification and payout details.
          </p>
        </div>

        <form onSubmit={handleContinue} noValidate className="space-y-8">
          {/* 4. Horizontal Host-Type Selector (Three equal-width options on desktop) */}
          <fieldset>
            <legend className="sr-only">Host Type Selection</legend>

            <div
              role="radiogroup"
              aria-label="How will you host on Ilé?"
              className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4"
            >
              {HOST_TYPE_OPTIONS.map((opt, idx) => {
                const isSelected = data.hostType === opt.id;
                const Icon = opt.icon;

                return (
                  <div
                    key={opt.id}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => handleSelectHostType(opt.id)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    className={`relative p-5 rounded-xl border text-left cursor-pointer flex flex-col justify-between transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065F46] focus-visible:ring-offset-2 ${
                      isSelected
                        ? "border-[#065F46] bg-[#F4F7F5] ring-1 ring-[#065F46] shadow-xs"
                        : "border-[#E5E7EB] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAF8]"
                    }`}
                  >
                    <div>
                      {/* Top Row: Subtle Icon and Selection Indicator */}
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                            isSelected
                              ? "bg-[#065F46] text-white"
                              : "bg-[#F5F5F3] text-[#4B5563]"
                          }`}
                        >
                          <Icon size={18} />
                        </div>

                        {/* Selection Radio Indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors duration-150 ${
                            isSelected
                              ? "border-[#065F46] bg-[#065F46] text-white"
                              : "border-[#D1D5DB] bg-white"
                          }`}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="text-[15px] font-semibold text-[#111827]">
                        {opt.title}
                      </h2>

                      {/* Description */}
                      <p className="text-[13px] text-[#4B5563] leading-relaxed mt-1.5">
                        {opt.description}
                      </p>
                    </div>

                    {/* Accessible status tag */}
                    {isSelected && (
                      <div className="mt-4 pt-3 border-t border-[#065F46]/10 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#065F46]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#065F46]" />
                        <span>Selected</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* Corporate Details: Appears when Registered Business is selected */}
          <AnimatePresence>
            {data.hostType === "company" && (
              <motion.div
                initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-5 rounded-xl bg-[#F9F9F8] border border-[#E5E7EB] space-y-4"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#065F46]">
                  <Shield size={14} />
                  <span>Registered business details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="companyName" className="block text-[13px] font-medium text-[#111827]">
                        Registered Business Name <span className="text-rose-600">*</span>
                      </label>
                    </div>
                    <input
                      id="companyName"
                      type="text"
                      value={data.companyName}
                      onChange={(e) => {
                        updateData({ companyName: e.target.value });
                        if (errors.companyName) validateField("companyName");
                      }}
                      onBlur={() => handleBlur("companyName")}
                      placeholder="e.g. Haven Stays & Residences Ltd"
                      className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out ${
                        touched.companyName && errors.companyName
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                          : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                      }`}
                    />
                    {touched.companyName && errors.companyName && (
                      <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{errors.companyName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="companyRegNumber" className="block text-[13px] font-medium text-[#111827]">
                        CAC Registration Number
                      </label>
                      <span className="text-[11px] text-[#6B7280] bg-stone-100 px-2 py-0.5 rounded font-medium">Optional</span>
                    </div>
                    <input
                      id="companyRegNumber"
                      type="text"
                      value={data.companyRegNumber}
                      onChange={(e) => updateData({ companyRegNumber: e.target.value })}
                      placeholder="e.g. RC 1928374 or BN 482910"
                      className="w-full h-11 px-3.5 rounded-lg text-sm bg-white border border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 5. Contact Phone Number */}
          <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <label htmlFor="phone" className="block text-[13px] font-medium text-[#111827]">
                Phone number <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-[#4B5563] bg-[#FAFAF8] border border-[#E5E7EB] px-2 py-0.5 rounded font-medium">
                Calls &amp; WhatsApp
              </span>
            </div>

            <div className={`flex rounded-lg border bg-white overflow-hidden transition-[border-color,box-shadow] duration-150 ease-out ${
              touched.phone && errors.phone
                ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/15"
                : "border-[#D1D5DB] hover:border-[#9CA3AF] focus-within:border-[#065F46] focus-within:ring-2 focus-within:ring-[#065F46]/15"
            }`}>
              {/* Nigerian Country Code Indicator */}
              <div className="inline-flex items-center gap-1.5 px-3.5 bg-[#F9F9F8] border-r border-[#E5E7EB] text-xs font-semibold text-[#111827] select-none shrink-0">
                <span aria-hidden="true">🇳🇬</span>
                <span>+234</span>
              </div>

              {/* Phone Number Input Field */}
              <div className="relative flex-1">
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={data.phone}
                  onChange={(e) => {
                    updateData({ phone: e.target.value });
                    if (errors.phone) validateField("phone");
                  }}
                  onBlur={() => handleBlur("phone")}
                  placeholder="0803 123 4567 or 803 123 4567"
                  aria-required="true"
                  aria-invalid={Boolean(touched.phone && errors.phone)}
                  className={`w-full h-11 pl-3.5 pr-10 text-sm bg-transparent outline-none text-[#111827] placeholder:text-[#9CA3AF] tabular-nums ${
                    touched.phone && errors.phone ? "text-rose-900" : ""
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none">
                  <Phone size={16} />
                </div>
              </div>
            </div>

            {/* Validation Feedback & Short Privacy Explanation */}
            {touched.phone && errors.phone ? (
              <p role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle size={13} className="shrink-0" />
                <span>{errors.phone}</span>
              </p>
            ) : (
              <p className="text-[12px] text-[#4B5563] leading-relaxed pt-0.5">
                Used for booking updates and guest check-in. Kept private and never shared publicly.
              </p>
            )}
          </div>

          {/* 6. Footer Actions: "Save & Exit" (secondary) and "Continue to Personal Details" (primary) */}
          <div className="pt-6 border-t border-[#E5E7EB] flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={isSaving}
              className="w-full sm:w-auto h-11 px-5 rounded-lg border border-[#E5E7EB] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAF8] text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-[border-color,background-color,color,transform] duration-150 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065F46]/25 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save & exit"}
            </button>

            <button
              type="submit"
              disabled={isNavigating}
              className="w-full sm:w-auto h-11 px-6 rounded-lg bg-[#065F46] hover:bg-[#044E39] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#065F46]/25 focus-visible:ring-offset-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isNavigating ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white/80" />
                  <span>Saving details...</span>
                </>
              ) : (
                <>
                  <span>Continue to personal details</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </StepMotion>
  );
}
