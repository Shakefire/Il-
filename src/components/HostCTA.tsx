"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getFallbackImage } from "@/lib/placeholders";

export default function HostCTA() {
  const [imgSrc, setImgSrc] = useState(
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80"
  );

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="relative overflow-hidden rounded-[18px] bg-[#24483A] text-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 p-8 sm:p-14 lg:p-16 space-y-6">
              <span className="text-[13px] uppercase tracking-wider font-semibold text-white/70">
                Hosting with Ilé
              </span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.08] tracking-tight">
                Have a beautiful space?
              </h2>
              <p className="text-white/80 text-[17px] sm:text-[19px] leading-relaxed max-w-lg font-light">
                Share it with guests looking for somewhere quiet, reliable, and special to stay in Abuja or Lagos.
              </p>
              <div className="pt-2">
                <Link
                  href="/host"
                  className="inline-flex items-center gap-2 bg-white text-[#171717] px-6 py-3.5 rounded-xl font-medium text-[15px] hover:bg-[#FAFAF8] transition-colors"
                >
                  <span>Become a host</span>
                  <ArrowUpRight size={17} />
                </Link>
              </div>
            </div>

            {/* Right Architectural Image */}
            <div className="lg:col-span-5 relative h-72 lg:h-[420px] w-full bg-[#1B372C]">
              <Image
                src={imgSrc}
                alt="Contemporary residence in Abuja"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover opacity-90"
                onError={() =>
                  setImgSrc(
                    getFallbackImage("Ilé Host Residence", "Abuja & Lagos")
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
