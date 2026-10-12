"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function StayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Stay] page error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#FAFAF8]">
      <div className="max-w-md w-full bg-white border border-[#E7E5E0] rounded-2xl p-8 space-y-4 shadow-sm">
        <AlertTriangle size={40} className="mx-auto text-amber-500" />
        <h2 className="text-2xl font-display font-medium text-[#171717]">
          Something went wrong
        </h2>
        <p className="text-sm text-[#6B6B67] leading-relaxed">
          We couldn&apos;t load this listing. Please try again.
        </p>
        <div className="flex gap-3 pt-2 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[#0B5D45] text-white rounded-xl text-sm font-semibold hover:bg-[#084936] transition-colors"
          >
            Try again
          </button>
          <Link
            href="/search"
            className="px-5 py-2.5 border border-[#E7E5E0] text-[#171717] rounded-xl text-sm font-semibold hover:border-[#171717] transition-colors"
          >
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
