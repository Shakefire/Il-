"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/OnboardingContext";
import { Loader2 } from "lucide-react";

export default function HostOnboardingIndexPage() {
  const router = useRouter();
  const { data } = useOnboarding();

  useEffect(() => {
    if (!data.isLoaded) return;

    if (data.isApplicationSubmitted || data.verificationStatus === "UNDER_REVIEW") {
      router.replace("/host/onboarding/status");
    } else {
      router.replace("/host/onboarding/business-type");
    }
  }, [data.isLoaded, data.isApplicationSubmitted, data.verificationStatus, router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#0B5D45] mb-3" />
      <p className="text-sm text-[#6B6B67] font-medium">Loading onboarding workspace...</p>
    </div>
  );
}
