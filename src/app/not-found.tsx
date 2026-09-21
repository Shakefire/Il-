import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-24 text-center">
      <div className="max-w-md w-full space-y-6">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#EDF3F0] text-[#0B5D45]">
          404 · Page Not Found
        </span>

        <h1 className="font-display text-4xl sm:text-5xl text-[#171717] font-normal tracking-tight">
          Somewhere off the map.
        </h1>

        <p className="text-[16px] text-[#6B6B67] leading-relaxed font-light">
          The page or stay you are looking for has been moved, unlisted, or does not exist.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/search"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-[14px] font-medium transition-colors shadow-sm"
          >
            <Compass size={17} />
            <span>Browse Stays</span>
            <ArrowRight size={15} />
          </Link>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white border border-[#DDD9D1] text-[#171717] hover:bg-[#F6F5F2] text-[14px] font-medium transition-colors"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
