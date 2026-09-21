import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Lock, ArrowLeft, EyeOff, Server, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy & NDPR Compliance | Ilé",
  description:
    "Learn how Ilé protects your personal data, identity verification records, and payment information under the Nigeria Data Protection Act.",
};

export default function PrivacyPage() {
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
          <Lock size={14} />
          <span>Nigeria Data Protection Act (NDPA) Compliant</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#171717] font-normal tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-[17px] text-[#6B6B67] leading-relaxed max-w-2xl font-light">
          We treat your personal data with utmost discretion. Here is how we collect, safeguard, and utilize your information across Ilé.
        </p>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 sm:px-8 pt-12 space-y-16 text-[#171717]">
        {/* Section 1: Information We Collect */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              01
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Information We Collect
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            We only collect data strictly necessary to facilitate reservations, ensure property safety, and maintain uninterrupted service:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E3] space-y-2">
              <UserCheck size={18} className="text-[#0B5D45]" />
              <h3 className="font-semibold text-[15px] text-[#171717]">Account &amp; Identity</h3>
              <p className="text-xs sm:text-[13px] text-[#6B6B67] leading-normal">
                Name, verified email address, and active telephone number for reservation dispatches.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E3] space-y-2">
              <ShieldCheck size={18} className="text-[#0B5D45]" />
              <h3 className="font-semibold text-[15px] text-[#171717]">Estate Gate Pass Data</h3>
              <p className="text-xs sm:text-[13px] text-[#6B6B67] leading-normal">
                Vehicle registration plates and guest names required by gated communities for visitor entry codes.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white border border-[#EAE8E3] space-y-2">
              <Lock size={18} className="text-[#0B5D45]" />
              <h3 className="font-semibold text-[15px] text-[#171717]">Payment Data</h3>
              <p className="text-xs sm:text-[13px] text-[#6B6B67] leading-normal">
                Encrypted transaction tokens. Ilé does not store raw credit/debit card numbers or bank PINs on our servers.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: How We Use Your Data */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              02
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Purpose of Processing
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            Your data is processed strictly for:
          </p>
          <ul className="space-y-3 text-[14.5px] text-[#555552] pl-5 list-disc">
            <li>Securing reservations, sending check-in directions, and generating estate security clearances.</li>
            <li>Providing 24/7 concierge assistance in case of flight delays, power checks, or facility requests.</li>
            <li>Detecting fraudulent booking attempts, bot spam, and illegal shortlet sub-leasing.</li>
            <li>Complying with legal and tax reporting requirements in the Federal Republic of Nigeria.</li>
          </ul>
        </section>

        {/* Section 3: Data Protection & Sharing */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              03
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Data Protection &amp; Third Parties
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            We never sell, rent, or trade your personal information to marketing brokers or third-party advertisers. Information is only shared with:
          </p>
          <ul className="space-y-3 text-[14.5px] text-[#555552] pl-5 list-disc">
            <li>
              <strong className="text-[#171717]">Your Host:</strong> Only your verified name, guest count, and arrival time are disclosed upon confirmed booking.
            </li>
            <li>
              <strong className="text-[#171717]">Estate Security Officers:</strong> Vehicle registration and primary guest names are securely transmitted to gated security command posts to authorize barrier gate passage.
            </li>
          </ul>
        </section>

        {/* Section 4: Your Rights */}
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EDF3F0] text-[#0B5D45] flex items-center justify-center font-semibold text-sm">
              04
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Your Rights Under NDPA
            </h2>
          </div>
          <p className="text-[15.5px] text-[#555552] leading-relaxed">
            Under the Nigeria Data Protection Act, you maintain the right to access, rectify, or request deletion of your personal account data at any time by contacting our Data Protection Officer at{" "}
            <a href="mailto:privacy@ile.ng" className="text-[#0B5D45] font-medium hover:underline">
              privacy@ile.ng
            </a>.
          </p>
        </section>
      </main>
    </div>
  );
}
