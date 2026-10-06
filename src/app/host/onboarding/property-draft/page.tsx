"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PropertyDraftRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/host/onboarding/review");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-8 h-8 border-2 border-[#0B5D45] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-[#6B6B67]">Redirecting to verification review...</p>
    </div>
  );
}
