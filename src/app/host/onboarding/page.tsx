"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import OwnerOnboardingWizard from "@/components/onboarding/OwnerOnboardingWizard";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

function OnboardingContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?next=/host/onboarding");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0B5D45] mb-3" />
        <p className="text-sm text-[#6B6B67] font-medium">Verifying authentication session...</p>
      </div>
    );
  }

  return <OwnerOnboardingWizard />;
}

export default function HostOnboardingPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFB] py-6 sm:py-10">
      <Suspense
        fallback={
          <div className="min-h-[70vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B5D45]" />
          </div>
        }
      >
        <OnboardingContent />
      </Suspense>
    </div>
  );
}
