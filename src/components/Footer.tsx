"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Zap, Lock } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();

  const isAuthPage = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  if (isAuthPage) return null;

  return (
    <footer className="bg-[#141414] border-t border-[#242424] text-[#8F8F8B] text-[14px]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-14">
        {/* Main Content Grid: Tight & Professional */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-10 border-b border-[#242424]">
          {/* Brand & Value Statement (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="font-display text-2xl tracking-tight text-white font-normal">
                Ilé
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45]" />
            </Link>
            <p className="text-[14px] leading-relaxed text-[#9E9E9A] max-w-sm">
              Thoughtfully curated accommodations across Abuja and Lagos. Every stay is verified in person for continuous power, high-speed fiber internet, and gated perimeter security.
            </p>
            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#8A8A85]">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-[#0B5D45]" />
                <span>24/7 Power Verified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[#0B5D45]" />
                <span>In-Person Vetted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock size={13} className="text-[#0B5D45]" />
                <span>Secure Payments</span>
              </div>
            </div>
          </div>

          {/* Stays Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Stays
            </div>
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/search?destination=Abuja" className="hover:text-white transition-colors">
                  Abuja Portfolio
                </Link>
              </li>
              <li>
                <Link href="/search?destination=Lagos" className="hover:text-white transition-colors">
                  Lagos Residences
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-white transition-colors">
                  All 10 Stays
                </Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-white transition-colors">
                  Serviced Villas
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Column (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Platform
            </div>
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Ilé
                </Link>
              </li>
              <li>
                <Link href="/about#standards" className="hover:text-white transition-colors">
                  Infrastructure Standards
                </Link>
              </li>
              <li>
                <Link href="/host" className="hover:text-white transition-colors">
                  Host Your Residence
                </Link>
              </li>
              <li>
                <Link href="/about#contact" className="hover:text-white transition-colors">
                  Concierge &amp; Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Legal
            </div>
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms#guest-guarantee" className="hover:text-white transition-colors">
                  Guest Guarantee
                </Link>
              </li>
              <li>
                <Link href="/terms#cancellations" className="hover:text-white transition-colors">
                  Cancellation Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Tight, Single Line */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7A7A76]">
          <p>© 2026 Ilé Hospitality Ltd. Abuja · Lagos, Nigeria.</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45]" />
              Verified Hospitality Network
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
