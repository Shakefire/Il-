import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Zap, ArrowLeft, Lock, FileText, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service & Guest Guarantee | Ilé",
  description:
    "Review Ilé's Terms of Service, 24/7 infrastructure guarantee, cancellation policies, and guest protection standards across Nigeria.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen pb-24 sm:pb-32">
      {/* Back Link */}
      <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-8 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#6B6B67] hover:text-[#171717] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Homepage</span>
        </Link>
      </div>

      {/* Hero Section */}
      <header className="max-w-4xl mx-auto px-6 sm:px-8 pt-6 pb-12 space-y-4 border-b border-[#E7E5E0]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#EDF3F0] text-[#0B5D45] border border-[#D5E5DC]">
          <ShieldCheck size={14} />
          <span>Last updated: September 2026</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#171717] font-normal tracking-tight">
          Terms of Service &amp; Guest Guarantee
        </h1>
        <p className="text-[17px] text-[#6B6B67] leading-relaxed max-w-2xl font-light">
          Clear, honest terms designed to protect guests, verified property hosts, and uphold continuous living standards across Abuja and Lagos.
        </p>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 sm:px-8 pt-12 space-y-16 text-[#171717]">
        {/* Section 1: The Ilé Infrastructure Guarantee */}
        <section id="guest-guarantee" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              01
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              The 24/7 Infrastructure Guarantee
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            Every stay on Ilé is personally vetted by an architectural or hospitality inspector before listing. We hold our hosts to strict standards:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E3] space-y-2">
              <div className="flex items-center gap-2 text-[#0B5D45] font-semibold text-sm">
                <Zap size={16} />
                <span>Continuous Power Backup</span>
              </div>
              <p className="text-xs sm:text-[13.5px] text-[#6B6B67] leading-normal">
                If inverter switchover or generator maintenance fails for more than 60 consecutive minutes, our concierge will immediately intervene and issue prorated credits or relocate your party.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E3] space-y-2">
              <div className="flex items-center gap-2 text-[#0B5D45] font-semibold text-sm">
                <CheckCircle2 size={16} />
                <span>High-Speed Wi-Fi Fidelity</span>
              </div>
              <p className="text-xs sm:text-[13.5px] text-[#6B6B67] leading-normal">
                All advertised bandwidth (Fiber or Starlink) must match actual in-unit speed tests. Dedicated work spaces must include stable desk ergonomics and power strips.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Bookings, Rates & Escrow Protection */}
        <section id="payments" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              02
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Bookings &amp; Escrow Payments
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            All payments are processed in Nigerian Naira (₦) through verified banking channels and encrypted debit gateways. When you book a stay:
          </p>
          <ul className="space-y-3 text-[14.5px] text-[#555552] pl-5 list-disc">
            <li>
              <strong className="text-[#171717]">Escrow Hold:</strong> Your payment is held safely in escrow and is only released to the host 24 hours after successful check-in, verifying that the property matches all specifications.
            </li>
            <li>
              <strong className="text-[#171717]">Transparent Pricing:</strong> The price per night shown includes all utilities, electricity generator fuel, and estate security levies. No surprise fuel surcharges upon arrival.
            </li>
            <li>
              <strong className="text-[#171717]">Service Fee:</strong> An 8% platform facilitation fee covers round-the-clock concierge support, estate gate pass coordination, and property inspection audits.
            </li>
          </ul>
        </section>

        {/* Section 3: Cancellations & Refund Policies */}
        <section id="cancellations" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              03
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Cancellation &amp; Refund Policy
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            We provide clear, fair cancellation tiers to protect both traveling guests and property hosts:
          </p>
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#EAE8E3]">
              <span className="text-xs uppercase font-bold text-[#0B5D45] tracking-wide">
                Flexible (Up to 48 hours prior)
              </span>
              <p className="text-[14px] text-[#6B6B67] mt-1">
                Full 100% refund of accommodation fees when cancelled at least 48 hours before official check-in time (2:00 PM West Africa Time).
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#EAE8E3]">
              <span className="text-xs uppercase font-bold text-[#8B8B86] tracking-wide">
                Within 48 hours of Check-in
              </span>
              <p className="text-[14px] text-[#6B6B67] mt-1">
                First night is non-refundable; 50% refund on remaining reserved nights to compensate the host for reserved dates.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#EAE8E3]">
              <span className="text-xs uppercase font-bold text-[#171717] tracking-wide">
                Infrastructure Failure Override
              </span>
              <p className="text-[14px] text-[#6B6B67] mt-1">
                If a residence suffers substantial power, water, or access outage upon arrival that cannot be rectified within 2 hours, guests receive a 100% refund regardless of notice period.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Estate Conduct & Gate Pass Logistics */}
        <section id="estate-rules" className="space-y-5 scroll-mt-28">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              04
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Estate Access &amp; Community Rules
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            Most Ilé properties reside within premium gated enclaves (e.g. Maitama, Asokoro, Ikoyi, Banana Island, Victoria Island). Guests agree to observe:
          </p>
          <ul className="space-y-3 text-[14.5px] text-[#555552] pl-5 list-disc">
            <li>
              <strong className="text-[#171717]">Security Registration:</strong> Legitimate full names and vehicle plate numbers must be supplied 12 hours prior to arrival to generate digital gate pass codes.
            </li>
            <li>
              <strong className="text-[#171717]">Quiet Hours:</strong> Residential quiet hours are enforced between 10:00 PM and 7:00 AM. Unauthorized commercial parties or raves are strictly prohibited and result in immediate termination without refund.
            </li>
            <li>
              <strong className="text-[#171717]">Guest Capacities:</strong> Properties may not exceed maximum advertised guest limits without prior written authorization from the host.
            </li>
          </ul>
        </section>

        {/* Section 5: Governing Law & Concierge Desk */}
        <section className="pt-8 border-t border-[#E7E5E0] space-y-4">
          <h3 className="font-display text-xl text-[#171717]">
            Governing Law &amp; Inquiries
          </h3>
          <p className="text-[14.5px] text-[#6B6B67] leading-relaxed">
            These terms are governed by and construed in accordance with the laws of the Federal Republic of Nigeria. For questions regarding your booking, dispute mediation, or host policies, reach out directly to our concierge team at{" "}
            <a href="mailto:concierge@ile.ng" className="text-[#0B5D45] font-medium hover:underline">
              concierge@ile.ng
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
}
