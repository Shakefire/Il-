"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";

function OnboardingHeader() {
  const router = useRouter();
  const { saveStepData } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndExit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveStepData(1);
    } catch {
      // background save attempt
    } finally {
      setIsSaving(false);
      router.push("/host/dashboard");
    }
  };

  return (
    <header className="w-full bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
      <div className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Ilé Wordmark: Serif typeface with brand color period block */}
        <Link href="/" className="inline-flex items-baseline group focus:outline-none" aria-label="Ilé Home">
          <span className="font-serif text-[24px] sm:text-[26px] font-normal tracking-tight text-[#111827]">
            Ilé
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1C3D32] ml-1 mb-0.5 group-hover:scale-125 transition-transform" />
          <span className="text-xs text-[#4B5563] font-medium ml-2.5 pl-2.5 border-l border-[#E5E7EB] hidden sm:inline">
            Host Verification
          </span>
        </Link>

        {/* Host Dashboard Navigation Action */}
        <Link
          href="/host/dashboard"
          className="text-xs sm:text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-colors py-1.5 px-3 rounded-lg hover:bg-[#F5F5F3]"
        >
          Host Dashboard
        </Link>
      </div>
    </header>
  );
}

function OnboardingLockoutGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useOnboarding();

  React.useEffect(() => {
    if (data.isLoaded && (data.verificationStatus === "UNDER_REVIEW" || data.verificationStatus === "APPROVED")) {
      if (pathname && !pathname.endsWith("/status")) {
        router.replace("/host/onboarding/status");
      }
    }
  }, [data.isLoaded, data.verificationStatus, pathname, router]);

  return <>{children}</>;
}

export default function HostOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <OnboardingLockoutGuard>
        <div className="min-h-screen bg-[#FAFAF8] text-[#111827] flex flex-col justify-between selection:bg-[#EDF5F2] selection:text-[#1C3D32]">
          {/* Compact Header with Subtle Divider */}
          <OnboardingHeader />

          {/* Main Step Page Content */}
          <main className="flex-1 w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 z-10 flex flex-col justify-start">
            <div className="w-full">
              {children}
            </div>
          </main>

          {/* Understated, confident footer */}
          <footer className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-[#8B8B86] border-t border-[#E5E7EB]">
            <span>© 2026 Ilé Hospitality Ltd. Verified Nigerian Stays &amp; Shortlets.</span>
          </footer>
        </div>
      </OnboardingLockoutGuard>
    </OnboardingProvider>
  );
}
