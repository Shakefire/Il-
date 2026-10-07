"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingProvider } from "@/context/OnboardingContext";

const STEP_PROGRESS_MAP: Record<string, number> = {
  "business-type": 25,
  profile: 50,
  identity: 75,
  authority: 100,
  review: 100,
  status: 100,
};

function OnboardingHeader() {
  const pathname = usePathname();

  // Determine current progress percentage
  const currentKey = Object.keys(STEP_PROGRESS_MAP).find((key) => pathname?.includes(key));
  const progressPercentage = currentKey ? STEP_PROGRESS_MAP[currentKey] : 25;

  return (
    <>
      {/* Global Top-Edge Linear Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 bg-[#E7E5E0] z-50 overflow-hidden"
        role="progressbar"
        aria-valuenow={progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="h-full bg-[#0B5D45]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Distraction-Free Focus Mode Header */}
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2 group focus:outline-none">
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-[#171717] font-normal">
            Ilé
          </span>
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>

        <Link
          href="/host/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-[#E7E5E0] bg-white hover:bg-[#FAFAF8] text-[13px] font-semibold text-[#6B6B67] hover:text-[#171717] transition-all shadow-xs"
        >
          <span>Save & Exit</span>
        </Link>
      </header>
    </>
  );
}

export default function HostOnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-[#FAFAF8] text-[#171717] relative flex flex-col justify-between selection:bg-[#EDF3F0] selection:text-[#0B5D45]">
        {/* Subtle Ambient Background Depth & Bespoke Ilé Watermark */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#0B5D45]/[0.035] rounded-full blur-3xl" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[580px] h-[320px] bg-[#0B5D45]/[0.02] rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.25]"
            style={{
              backgroundImage: "radial-gradient(#E7E5E0 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Oversized transparent brand watermark */}
          <div className="absolute -bottom-10 -right-10 font-display text-[200px] sm:text-[280px] font-normal tracking-tighter text-[#0B5D45]/[0.025] leading-none pointer-events-none select-none">
            Ilé
          </div>
        </div>

        {/* Focus Mode Navigation Bar */}
        <OnboardingHeader />

        {/* Step Page Content with Framer Motion AnimatePresence Transitions */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 z-10 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Subtle platform footer */}
        <footer className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-[#8B8B86] z-10">
          <span>© 2026 Ilé Hospitality Ltd. All documentation is kept strictly confidential.</span>
        </footer>
      </div>
    </OnboardingProvider>
  );
}
