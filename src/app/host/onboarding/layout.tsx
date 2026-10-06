"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, ArrowRight, Home, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

const ONBOARDING_STEPS = [
  { path: "/host/onboarding/business-type", stepNum: 1, label: "Business Type", slug: "business-type" },
  { path: "/host/onboarding/profile", stepNum: 2, label: "Profile", slug: "profile" },
  { path: "/host/onboarding/identity", stepNum: 3, label: "Identity KYC", slug: "identity" },
  { path: "/host/onboarding/authority", stepNum: 4, label: "Authority & Payout", slug: "authority" },
  { path: "/host/onboarding/property-draft", stepNum: 5, label: "Property Draft", slug: "property-draft" },
  { path: "/host/onboarding/review", stepNum: 6, label: "Review & Submit", slug: "review" },
];

function OnboardingNavigation() {
  const pathname = usePathname();
  const { data } = useOnboarding();
  const currentStep = ONBOARDING_STEPS.find((s) => pathname.includes(s.slug)) || ONBOARDING_STEPS[0];
  const progressPercent = Math.round((currentStep.stepNum / ONBOARDING_STEPS.length) * 100);

  // If on status page, render simple status bar
  if (pathname.includes("/status")) {
    return (
      <header className="w-full max-w-4xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-[#171717] font-normal">
            Ilé
          </span>
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>
        <Link
          href="/host/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#E7E5E0] text-[13.5px] font-semibold text-[#171717] hover:border-[#0B5D45] transition-all shadow-xs"
        >
          <span>Host Dashboard</span>
          <ArrowRight size={15} />
        </Link>
      </header>
    );
  }

  return (
    <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
      {/* Left: Brand mark & Badge */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group focus:outline-none">
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-[#171717] font-normal">
            Ilé
          </span>
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0B5D45] uppercase tracking-wider">
          <ShieldCheck size={15} />
          <span>Partner Onboarding</span>
        </div>
      </div>

      {/* Center/Progress Counter: Step X of 6 */}
      <div className="flex items-center gap-2 text-xs text-[#6B6B67]">
        <div className="flex items-center gap-1">
          {ONBOARDING_STEPS.map((s) => {
            const isActive = s.stepNum === currentStep.stepNum;
            const isCompleted = s.stepNum < currentStep.stepNum;

            return (
              <Link
                key={s.stepNum}
                href={s.path}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? "w-7 bg-[#0B5D45]"
                    : isCompleted
                    ? "w-3 bg-[#0B5D45]/70 hover:bg-[#0B5D45]"
                    : "w-3 bg-[#E7E5E0] hover:bg-[#D5D3CE]"
                }`}
                title={`Step ${s.stepNum}: ${s.label}`}
              />
            );
          })}
        </div>
        <span className="font-medium ml-1">
          Step {currentStep.stepNum} of {ONBOARDING_STEPS.length}
        </span>
      </div>

      {/* Right: Direct "Skip to Dashboard" Button */}
      <div>
        <Link
          href="/host/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-[#6B6B67] hover:text-[#171717] hover:bg-black/5 transition-all"
        >
          <span>Skip to Dashboard</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </header>
  );
}

export default function HostOnboardingLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-[#FAFAF8] text-[#171717] relative flex flex-col justify-between selection:bg-[#EDF3F0] selection:text-[#0B5D45]">
        {/* Subtle Ambient Background Depth */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#0B5D45]/[0.035] rounded-full blur-3xl" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[580px] h-[320px] bg-[#0B5D45]/[0.02] rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.25]"
            style={{
              backgroundImage: "radial-gradient(#E7E5E0 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Top Header & Navigation Bar */}
        <OnboardingNavigation />

        {/* Step Page Content with Fast Animated Transition */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 z-10 flex flex-col justify-center">
          <div className="animate-in fade-in duration-150">
            {children}
          </div>
        </main>

        {/* Subtle platform footer */}
        <footer className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-[#8B8B86] z-10">
          <span>© 2026 Ilé Hospitality Ltd. All documentation is kept strictly confidential.</span>
        </footer>
      </div>
    </OnboardingProvider>
  );
}
