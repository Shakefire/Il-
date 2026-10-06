import { Suspense } from "react";
import OwnerOnboardingWizard from "@/components/onboarding/OwnerOnboardingWizard";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Property Owner Onboarding & Verification — Ilé",
  description: "Join verified Nigerian property owners and managers. Progressive identity, authority, and listing onboarding.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      <Suspense
        fallback={
          <div className="min-h-[70vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B5D45]" />
          </div>
        }
      >
        <OwnerOnboardingWizard />
      </Suspense>
    </div>
  );
}
