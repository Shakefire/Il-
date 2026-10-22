"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboarding } from "@/context/OnboardingContext";
import StepMotion from "@/components/onboarding/StepMotion";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "lucide-react";

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
  "Asaba",
  "Uyo",
];

export default function ProfileStepPage() {
  const router = useRouter();
  const { data, updateData, saveStepData } = useOnboarding();

  const [isNavigating, setIsNavigating] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Field validation errors and touched states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateAge = (dobString: string): string | null => {
    if (!dobString) return "Date of birth is required.";
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return "Please enter a valid date of birth.";

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return "You must be at least 18 years old to host accommodations on Ilé.";
    }
    if (age > 100) {
      return "Please enter a valid date of birth.";
    }
    return null;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field: string) => {
    const newErrors = { ...errors };

    if (field === "firstName") {
      if (!data.firstName.trim() || data.firstName.trim().length < 2) {
        newErrors.firstName = "Legal first name is required (minimum 2 letters).";
      } else {
        delete newErrors.firstName;
      }
    }

    if (field === "lastName") {
      if (!data.lastName.trim() || data.lastName.trim().length < 2) {
        newErrors.lastName = "Legal last name is required (minimum 2 letters).";
      } else {
        delete newErrors.lastName;
      }
    }

    if (field === "dateOfBirth") {
      const ageErr = validateAge(data.dateOfBirth);
      if (ageErr) {
        newErrors.dateOfBirth = ageErr;
      } else {
        delete newErrors.dateOfBirth;
      }
    }

    if (field === "residentialAddress") {
      if (!data.residentialAddress.trim() || data.residentialAddress.trim().length < 6) {
        newErrors.residentialAddress = "Please provide your residential street address (at least 6 characters).";
      } else {
        delete newErrors.residentialAddress;
      }
    }

    if (field === "operatingCity") {
      if (!data.operatingCity) {
        newErrors.operatingCity = "Please select your primary operating city.";
      } else {
        delete newErrors.operatingCity;
      }
    }

    setErrors(newErrors);
  };

  const handleSkipToDashboard = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSavingDraft(true);
    try {
      await saveStepData(2);
    } catch {
      // background save
    } finally {
      setIsSavingDraft(false);
      router.push("/host/dashboard");
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      residentialAddress: true,
      operatingCity: true,
    });

    const currentErrors: Record<string, string> = {};

    if (!data.firstName.trim() || data.firstName.trim().length < 2) {
      currentErrors.firstName = "Legal first name is required (minimum 2 letters).";
    }

    if (!data.lastName.trim() || data.lastName.trim().length < 2) {
      currentErrors.lastName = "Legal last name is required (minimum 2 letters).";
    }

    const ageErr = validateAge(data.dateOfBirth);
    if (ageErr) {
      currentErrors.dateOfBirth = ageErr;
    }

    if (!data.residentialAddress.trim() || data.residentialAddress.trim().length < 6) {
      currentErrors.residentialAddress = "Please provide your residential street address in Nigeria.";
    }

    if (!data.operatingCity) {
      currentErrors.operatingCity = "Please select your primary operating city.";
    }

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    setIsNavigating(true);
    try {
      await saveStepData(2);
    } catch {
      // background save
    }
    router.push("/host/onboarding/identity");
  };

  return (
    <StepMotion>
      <div className="w-full">
        {/* Restrained Progress Indicator */}
        <div className="flex items-center justify-between mb-8 pb-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider uppercase text-[#065F46]">
              Step 2 of 5
            </span>
            <span className="text-xs text-[#9CA3AF]">•</span>
            <span className="text-xs font-medium text-[#4B5563]">
              Host Profile
            </span>
          </div>

          {/* 5-Step Segmented Bar */}
          <div className="flex items-center gap-1.5" aria-label="Step 2 of 5 in progress">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  stepNum <= 2
                    ? "w-7 sm:w-8 bg-[#065F46]"
                    : "w-3.5 sm:w-4 bg-[#E5E7EB]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Spacious Asymmetric Two-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 xl:gap-16 items-start">
          {/* Left Column — Editorial Introduction (approx 40% width) */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 space-y-7">
            <div>
              {/* Eyebrow Label */}
              <div className="inline-block text-[11px] font-semibold uppercase tracking-wider text-[#065F46] mb-3">
                Host profile
              </div>

              {/* Editorial Headline */}
              <h1 className="font-serif text-[32px] sm:text-[38px] xl:text-[42px] font-normal tracking-tight text-[#111827] leading-[1.12]">
                Your details
              </h1>

              {/* Concise Supporting Copy */}
              <p className="mt-3.5 text-[15px] sm:text-[16px] text-[#4B5563] leading-relaxed">
                Enter your personal details and the areas where you host.
              </p>
            </div>

            {/* Two Short Explanatory Sections */}
            <div className="pt-6 border-t border-[#E5E7EB] space-y-6">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827] mb-1.5">
                  Personal details
                </h2>
                <p className="text-[13px] text-[#4B5563] leading-relaxed">
                  Your legal name, date of birth, and home address. Your name must match the name on your payout bank account.
                </p>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB]/60">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827] mb-1.5">
                  Operating areas
                </h2>
                <p className="text-[13px] text-[#4B5563] leading-relaxed">
                  Your primary city and the neighbourhoods where you host guests.
                </p>
              </div>
            </div>

            {/* Quiet Trust / Compliance Indicator */}
            <div className="pt-6 border-t border-[#E5E7EB]/60 flex items-center gap-2 text-[12px] text-[#6B7280]">
              <ShieldCheck size={16} className="text-[#065F46] shrink-0" />
              <span>Your personal details are used to verify your host account and are kept private.</span>
            </div>
          </aside>

          {/* Right Column — Functional Form (approx 60% width, presented directly on page) */}
          <div className="lg:col-span-7 w-full">
            <form onSubmit={handleContinue} noValidate className="space-y-8">
              {/* 1. Personal details Group */}
              <section aria-labelledby="section-personal-identity" className="space-y-4">
                <div className="pb-2.5 border-b border-[#E5E7EB]">
                  <h2 id="section-personal-identity" className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                    1. Personal details
                  </h2>
                </div>

                {/* Legal Names: 2-column inline grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Legal First Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="firstName" className="block text-[13px] font-medium text-[#111827]">
                        Legal First Name <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                        Private
                      </span>
                    </div>
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={data.firstName}
                      onChange={(e) => {
                        updateData({ firstName: e.target.value });
                        if (errors.firstName) validateField("firstName");
                      }}
                      onBlur={() => handleBlur("firstName")}
                      placeholder="e.g. Chukwuma"
                      aria-required="true"
                      aria-invalid={Boolean(touched.firstName && errors.firstName)}
                      aria-describedby={touched.firstName && errors.firstName ? "firstName-error" : "firstName-hint"}
                      className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out ${
                        touched.firstName && errors.firstName
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                          : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                      }`}
                    />
                    {touched.firstName && errors.firstName ? (
                      <p id="firstName-error" role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{errors.firstName}</span>
                      </p>
                    ) : (
                      <p id="firstName-hint" className="mt-1 text-[11px] text-[#6B7280]">
                        Your first name as it appears on your ID.
                      </p>
                    )}
                  </div>

                  {/* Legal Last Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="lastName" className="block text-[13px] font-medium text-[#111827]">
                        Legal Last Name <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                        Private
                      </span>
                    </div>
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={data.lastName}
                      onChange={(e) => {
                        updateData({ lastName: e.target.value });
                        if (errors.lastName) validateField("lastName");
                      }}
                      onBlur={() => handleBlur("lastName")}
                      placeholder="e.g. Adeleke"
                      aria-required="true"
                      aria-invalid={Boolean(touched.lastName && errors.lastName)}
                      aria-describedby={touched.lastName && errors.lastName ? "lastName-error" : "lastName-hint"}
                      className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out ${
                        touched.lastName && errors.lastName
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                          : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                      }`}
                    />
                    {touched.lastName && errors.lastName ? (
                      <p id="lastName-error" role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{errors.lastName}</span>
                      </p>
                    ) : (
                      <p id="lastName-hint" className="mt-1 text-[11px] text-[#6B7280]">
                        Must match the surname on your bank account.
                      </p>
                    )}
                  </div>
                </div>

                {/* Date of Birth & Residential Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Date of Birth */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="dateOfBirth" className="block text-[13px] font-medium text-[#111827]">
                        Date of Birth <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                        Private
                      </span>
                    </div>
                    <input
                      id="dateOfBirth"
                      type="date"
                      value={data.dateOfBirth}
                      onChange={(e) => {
                        updateData({ dateOfBirth: e.target.value });
                        if (errors.dateOfBirth) validateField("dateOfBirth");
                      }}
                      onBlur={() => handleBlur("dateOfBirth")}
                      aria-required="true"
                      aria-invalid={Boolean(touched.dateOfBirth && errors.dateOfBirth)}
                      aria-describedby={touched.dateOfBirth && errors.dateOfBirth ? "dateOfBirth-error" : "dateOfBirth-hint"}
                      className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out ${
                        touched.dateOfBirth && errors.dateOfBirth
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                          : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                      }`}
                    />
                    {touched.dateOfBirth && errors.dateOfBirth ? (
                      <p id="dateOfBirth-error" role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{errors.dateOfBirth}</span>
                      </p>
                    ) : (
                      <p id="dateOfBirth-hint" className="mt-1 text-[11px] text-[#6B7280]">
                        You must be at least 18 years old to host on Ilé.
                      </p>
                    )}
                  </div>

                  {/* Residential Address: Full width on tablet/desktop */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="residentialAddress" className="block text-[13px] font-medium text-[#111827]">
                        Residential Address <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                        Private
                      </span>
                    </div>
                    <input
                      id="residentialAddress"
                      type="text"
                      autoComplete="street-address"
                      value={data.residentialAddress}
                      onChange={(e) => {
                        updateData({ residentialAddress: e.target.value });
                        if (errors.residentialAddress) validateField("residentialAddress");
                      }}
                      onBlur={() => handleBlur("residentialAddress")}
                      placeholder="e.g. 14 Danube Street, Maitama, Abuja"
                      aria-required="true"
                      aria-invalid={Boolean(touched.residentialAddress && errors.residentialAddress)}
                      aria-describedby={touched.residentialAddress && errors.residentialAddress ? "residentialAddress-error" : "residentialAddress-hint"}
                      className={`w-full h-11 px-3.5 rounded-lg text-sm bg-white border outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out ${
                        touched.residentialAddress && errors.residentialAddress
                          ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 text-rose-900"
                          : "border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                      }`}
                    />
                    {touched.residentialAddress && errors.residentialAddress ? (
                      <p id="residentialAddress-error" role="alert" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{errors.residentialAddress}</span>
                      </p>
                    ) : (
                      <p id="residentialAddress-hint" className="mt-1 text-[11px] text-[#6B7280]">
                        Your home address. This is kept private.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* 2. Operating areas Group */}
              <section aria-labelledby="section-operating-locations" className="space-y-4 pt-2">
                <div className="pb-2.5 border-b border-[#E5E7EB]">
                  <h2 id="section-operating-locations" className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                    2. Operating areas
                  </h2>
                </div>

                {/* Balanced Two-Column Row on Desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Operating City */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="operatingCity" className="block text-[13px] font-medium text-[#111827]">
                        Primary Operating City <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        Public
                      </span>
                    </div>
                    <select
                      id="operatingCity"
                      value={data.operatingCity}
                      onChange={(e) => {
                        updateData({ operatingCity: e.target.value });
                        if (errors.operatingCity) validateField("operatingCity");
                      }}
                      onBlur={() => handleBlur("operatingCity")}
                      aria-required="true"
                      aria-invalid={Boolean(touched.operatingCity && errors.operatingCity)}
                      aria-describedby="operatingCity-hint"
                      className="w-full h-11 px-3.5 rounded-lg text-sm bg-white border border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out cursor-pointer"
                    >
                      <option value="" disabled>Select your primary city</option>
                      {NIGERIAN_CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                    <p id="operatingCity-hint" className="mt-1 text-[11px] text-[#6B7280]">
                      The city where your properties are located.
                    </p>
                  </div>

                  {/* Operating Neighbourhoods */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="operatingAreas" className="block text-[13px] font-medium text-[#111827]">
                        Operating Neighbourhoods
                      </label>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                        Public
                      </span>
                    </div>
                    <input
                      id="operatingAreas"
                      type="text"
                      value={data.operatingAreas}
                      onChange={(e) => updateData({ operatingAreas: e.target.value })}
                      placeholder="e.g. Maitama, Wuse 2, Ikoyi, Victoria Island"
                      className="w-full h-11 px-3.5 rounded-lg text-sm bg-white border border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-[#9CA3AF]"
                    />
                    <p className="mt-1 text-[11px] text-[#6B7280]">
                      Districts or neighbourhoods where you host (e.g. Maitama, Ikoyi).
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Host bio Group */}
              <section aria-labelledby="section-hosting-practice" className="space-y-4 pt-2">
                <div className="pb-2.5 border-b border-[#E5E7EB]">
                  <h2 id="section-hosting-practice" className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
                    3. Host bio
                  </h2>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="bio" className="block text-[13px] font-medium text-[#111827]">
                      About your hosting practice
                    </label>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Public on listing
                    </span>
                  </div>
                  <textarea
                    id="bio"
                    rows={4}
                    value={data.bio}
                    onChange={(e) => updateData({ bio: e.target.value })}
                    placeholder="e.g. Hi, I host apartments in Abuja and focus on comfortable, quiet stays with reliable 24/7 power and fast internet."
                    className="w-full p-3.5 rounded-lg text-sm bg-white border border-[#D1D5DB] text-[#111827] hover:border-[#9CA3AF] focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15 outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out resize-y leading-relaxed placeholder:text-[#9CA3AF]"
                  />
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    This appears on your public profile to introduce yourself to guests.
                  </p>
                </div>
              </section>

              {/* Navigation Actions Hierarchy */}
              <div className="pt-6 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Secondary Navigation Actions */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                  <Link
                    href="/host/onboarding/business-type"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-colors py-2 active:scale-[0.99]"
                  >
                    <ArrowLeft size={16} />
                    <span>Back to host type</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleSkipToDashboard}
                    disabled={isSavingDraft}
                    className="text-xs text-[#6B7280] hover:text-[#111827] transition-colors py-2 underline underline-offset-2 active:scale-[0.99] cursor-pointer"
                  >
                    {isSavingDraft ? "Saving..." : "Skip to dashboard"}
                  </button>
                </div>

                {/* Primary Navigation Action */}
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
                      <span>Continue to identity verification</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </StepMotion>
  );
}
