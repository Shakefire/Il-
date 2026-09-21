import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-24 sm:pb-32 space-y-24">
      {/* Hero */}
      <section className="pt-12 sm:pt-20 lg:pt-28">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 space-y-6 text-center">
          <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
            About Ilé
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#171717] font-normal leading-[1.08] tracking-tight">
            Hospitality rooted in calm, reliability, and human care.
          </h1>
          <p className="text-[18px] sm:text-[21px] text-[#6B6B67] leading-relaxed max-w-2xl mx-auto font-light">
            We started Ilé because finding a shortlet in Nigeria shouldn&apos;t require guessing if the generator will turn on, whether the water runs clear, or if the Wi-Fi actually works.
          </p>
        </div>
      </section>

      {/* Narrative Image */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8">
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-[#E7E5E0]">
          <Image
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80"
            alt="Warm architectural living space"
            fill
            className="object-cover"
          />
        </div>
      </section>

      {/* Our Standards */}
      <section id="standards" className="max-w-4xl mx-auto px-6 sm:px-8 space-y-12">
        <div className="space-y-4">
          <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
            Our Philosophy
          </span>
          <h2 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal">
            Simplicity over features.
          </h2>
          <p className="text-[17px] text-[#6B6B67] leading-relaxed">
            Most travel marketplaces bombard you with endless promotional popups, fake countdown timers, and hundreds of cluttered listings. We believe in curated restraint. Every home in our collection is personally inspected by an architect or interior specialist.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#24483A] flex items-center justify-center">
              <Zap size={20} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              Zero Power Downtime
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              We test inverter switchover speeds and generator fuel reserves before any stay is approved.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#24483A] flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              Real Security
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              Quiet gated closes, manned estate security posts, and respectful residential neighborhoods.
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF3F0] text-[#24483A] flex items-center justify-center">
              <Heart size={20} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              Warm Nigerian Hospitality
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              Authentic care from attentive hosts who respect privacy and respond within minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="max-w-4xl mx-auto px-6 sm:px-8 pt-8">
        <div className="p-8 sm:p-12 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl text-[#171717]">
              Have a question or custom inquiry?
            </h3>
            <p className="text-[15px] text-[#6B6B67] mt-1">
              Reach out to our concierge desk in Abuja or Lagos.
            </p>
          </div>
          <a
            href="mailto:concierge@ile.ng"
            className="inline-flex items-center gap-2 bg-[#24483A] text-white px-6 py-3.5 rounded-xl font-medium text-[15px] hover:bg-[#1B372C] transition-colors shrink-0"
          >
            <span>concierge@ile.ng</span>
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
