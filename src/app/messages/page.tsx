import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, ArrowRight, Compass, Sparkles, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Messages — Coming Soon | Ilé",
  description:
    "Direct guest-to-host messaging is coming soon to Ilé. In the meantime, our concierge team is available around the clock.",
};

export default function MessagesComingSoonPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center py-20 px-6 sm:px-8">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Visual Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#EDF3F0] text-[#0B5D45] border border-[#D5E5DC]">
          <span className="w-2 h-2 rounded-full bg-[#0B5D45] animate-pulse" />
          <span>In Development</span>
        </div>

        {/* Icon & Heading */}
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white border border-[#E8E6E1] shadow-sm mx-auto flex items-center justify-center text-[#0B5D45]">
            <MessageSquare size={30} strokeWidth={1.75} />
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#171717] font-normal tracking-tight">
            Messages is coming soon
          </h1>

          <p className="text-[16px] sm:text-[18px] text-[#6B6B67] leading-relaxed max-w-md mx-auto font-light">
            We are crafting a calm, direct messaging experience connecting guests and verified hosts across Abuja and Lagos.
          </p>
        </div>

        {/* Interim Concierge Card */}
        <div className="bg-white border border-[#EAE8E3] rounded-2xl p-6 sm:p-7 text-left space-y-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#F6F5F2] flex items-center justify-center text-[#171717] flex-shrink-0 mt-0.5">
              <Mail size={18} />
            </div>
            <div className="space-y-1">
              <h2 className="text-[15px] font-semibold text-[#171717]">
                Need immediate booking assistance?
              </h2>
              <p className="text-[13.5px] text-[#6B6B67] leading-normal">
                Our dedicated guest concierge is available 24/7 to answer property questions, verify generator specs, or arrange airport escorts.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#F0EFEB] flex items-center justify-between text-xs sm:text-sm text-[#8B8B86]">
            <span>Guest Desk:</span>
            <a
              href="mailto:concierge@ile.ng"
              className="text-[#0B5D45] hover:text-[#084936] font-medium transition-colors"
            >
              concierge@ile.ng
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/search"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0B5D45] text-white hover:bg-[#084936] text-[14px] font-medium transition-colors shadow-sm"
          >
            <Compass size={17} />
            <span>Explore Curated Stays</span>
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
