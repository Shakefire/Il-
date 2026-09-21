"use client";

import { useState } from "react";
import Image from "next/image";
import { formatNaira } from "@/lib/utils";
import { ShieldCheck, Zap, Wifi, CheckCircle2, ArrowRight } from "lucide-react";

export default function HostPage() {
  const [city, setCity] = useState<"Abuja" | "Lagos">("Abuja");
  const [bedrooms, setBedrooms] = useState<number>(3);
  const [submitted, setSubmitted] = useState(false);

  // Estimator math: average rate * 20 occupied nights
  const baseRate = city === "Abuja" ? 75000 : 95000;
  const estimatedMonthly = baseRate * bedrooms * 0.75 * 20;

  return (
    <div className="min-h-screen pb-24 sm:pb-32 space-y-24">
      {/* Editorial Hero */}
      <section className="pt-12 sm:pt-20 lg:pt-28">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
                Become a host with Ilé
              </span>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-[#171717] font-normal leading-[1.05] tracking-tight">
                Host guests looking for quiet, dependable stays.
              </h1>
              <p className="text-[17px] sm:text-[19px] text-[#6B6B67] leading-relaxed max-w-xl font-light">
                We partner with owners of thoughtfully designed apartments and homes in Abuja and Lagos who can guarantee true 24/7 power, fast internet, and quiet living.
              </p>
            </div>

            <div className="lg:col-span-5 relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#E7E5E0] shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80"
                alt="Modern living room interior"
                fill
                priority
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Yield Estimator Component */}
      <section className="bg-white border-y border-[#E7E5E0] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
              Earnings potential
            </span>
            <h2 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal">
              Estimate your monthly shortlet earnings
            </h2>
            <p className="text-[15px] text-[#6B6B67]">
              Based on verified properties with similar bedroom counts at conservative 65–70% occupancy.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0] space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* City */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#8B8B86] font-semibold mb-2">
                  City
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Abuja", "Lagos"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCity(c)}
                      className={`py-3 rounded-xl text-[15px] font-medium transition-all ${
                        city === c
                          ? "bg-[#24483A] text-white"
                          : "bg-white border border-[#E7E5E0] text-[#171717] hover:border-[#171717]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#8B8B86] font-semibold mb-2">
                  Bedrooms
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setBedrooms(num)}
                      className={`py-3 rounded-xl text-[15px] font-medium transition-all ${
                        bedrooms === num
                          ? "bg-[#24483A] text-white"
                          : "bg-white border border-[#E7E5E0] text-[#171717] hover:border-[#171717]"
                      }`}
                    >
                      {num} {num === 1 ? "bed" : "beds"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Output Calculation */}
            <div className="pt-6 border-t border-[#E7E5E0] flex flex-col sm:flex-row items-baseline justify-between gap-2">
              <div>
                <span className="text-[14px] text-[#6B6B67]">
                  Projected monthly rental revenue:
                </span>
                <div className="text-3xl sm:text-4xl font-semibold text-[#171717] mt-1">
                  {formatNaira(estimatedMonthly)}
                  <span className="text-base text-[#6B6B67] font-normal"> / month</span>
                </div>
              </div>
              <div className="text-xs text-[#8B8B86]">
                Estimated net host payout after platform fee
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Host Standards Requirements */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-12">
        <div className="max-w-xl space-y-3">
          <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
            Our baseline standards
          </span>
          <h2 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal">
            What every Ilé home must guarantee
          </h2>
          <p className="text-[16px] text-[#6B6B67]">
            To protect our guests and community trust, we physically inspect every property prior to listing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-[#E7E5E0] space-y-3">
            <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] w-fit">
              <Zap size={22} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              Uninterrupted 24/7 Power
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              Every home must feature an automatic inverter system or dual generator redundancy with zero downtime.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E7E5E0] space-y-3">
            <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] w-fit">
              <Wifi size={22} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              High-Speed Dedicated Internet
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              Starlink or enterprise fiber with minimum 100 Mbps download speed and whole-home Wi-Fi mesh coverage.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E7E5E0] space-y-3">
            <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] w-fit">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-[18px] font-medium text-[#171717]">
              Manned Estate Security
            </h3>
            <p className="text-[14px] text-[#6B6B67] leading-relaxed">
              Located within a gated estate or private compound with 24-hour uniformed security and CCTV perimeter surveillance.
            </p>
          </div>
        </div>
      </section>

      {/* Host Inquiry Form */}
      <section className="max-w-3xl mx-auto px-6 sm:px-8">
        <div className="p-8 sm:p-12 rounded-2xl bg-white border border-[#E7E5E0] space-y-6">
          <div className="space-y-2">
            <h3 className="font-display text-2xl sm:text-3xl text-[#171717]">
              Submit your property for review
            </h3>
            <p className="text-[15px] text-[#6B6B67]">
              Our curation team visits and responds within 48 business hours.
            </p>
          </div>

          {submitted ? (
            <div className="p-6 rounded-xl bg-[#EDF3F0] text-[#24483A] space-y-2 text-center">
              <CheckCircle2 size={32} className="mx-auto" />
              <h4 className="font-medium text-lg">Inquiry received</h4>
              <p className="text-sm text-[#24483A]/80">
                Thank you. An Ilé curation specialist will contact you via WhatsApp to schedule a physical walkthrough.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8B8B86] font-semibold mb-1">
                    Your Full Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Aliko Mohammed"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#8B8B86] font-semibold mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="+234 802 345 6789"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#8B8B86] font-semibold mb-1">
                  Neighborhood & City
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Maitama, Abuja or Old Ikoyi, Lagos"
                  className="w-full px-4 py-3 rounded-xl border border-[#E7E5E0] text-[15px] focus:outline-none focus:border-[#24483A]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 bg-[#24483A] text-white rounded-xl font-medium text-[15px] hover:bg-[#1B372C] transition-colors flex items-center justify-center gap-2"
                >
                  <span>Request verification visit</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
