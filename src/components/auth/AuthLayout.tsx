"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  supportingText?: string;
  imageAlt?: string;
  imageSrc?: string;
}

export default function AuthLayout({
  children,
  heading,
  supportingText,
  imageAlt = "Curated Ilé Living Exhibition",
  imageSrc = "/images/auth-partner-showcase.png",
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-[#111827] flex flex-col justify-between selection:bg-[#EDF5F2] selection:text-[#1C3D32]">
      {/* Global Wrapper featuring fluid inner paddings (p-6 scaling smoothly up to p-16 on desktop) */}
      <div className="w-full max-w-[1400px] mx-auto p-6 sm:p-10 md:p-12 lg:p-16 flex flex-col flex-1">
        {/* Top Corner Utility Bar: Brand on Left, Back to Home Trigger on Right */}
        <header className="w-full flex items-center justify-between pb-8 sm:pb-12">
          {/* Brand Name: Serif typeface followed by bold brand color period token block */}
          <Link href="/" className="inline-flex items-baseline group" aria-label="Ilé Home">
            <span className="font-serif text-[28px] sm:text-[32px] font-normal tracking-tight text-[#111827]">
              Ilé
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-[#1C3D32] ml-1 mb-0.5 group-hover:scale-125 transition-transform" />
          </Link>

          {/* Explicit Back Navigation Trigger */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[14px] font-normal text-[#4B5563] hover:text-[#111827] transition-colors py-1.5 px-1 group"
          >
            <span className="text-base group-hover:-translate-x-0.5 transition-transform">&larr;</span>
            <span>Back to home</span>
          </Link>
        </header>

        {/* Balanced Two-Column Split Layout on Large Screens: Left 45%, Right 55% */}
        <main className="flex-1 w-full flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
            {/* Left 45%: Form Actions and Branding Context */}
            <div className="lg:col-span-5 w-full max-w-[480px] mx-auto lg:mx-0">
              {/* Title & Subtitle */}
              <div className="mb-7 sm:mb-8">
                <h1 className="font-serif text-[32px] sm:text-[38px] xl:text-[42px] font-normal tracking-tight text-[#111827] leading-[1.12]">
                  {heading}
                </h1>
                {supportingText && (
                  <p className="mt-2.5 text-[15px] sm:text-[16px] text-[#4B5563] font-normal leading-relaxed">
                    {supportingText}
                  </p>
                )}
              </div>

              {/* Form Inputs & Actions Slot */}
              {children}
            </div>

            {/* Right 55%: Immersive Rounded Gallery Exhibition Placeholder Card */}
            <div className="hidden lg:block lg:col-span-7">
              <div className="relative w-full aspect-[16/12] xl:aspect-[16/11] rounded-[28px] overflow-hidden bg-[#F7F7F5] shadow-xs border border-[#E5E7EB]/40 group">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover object-center group-hover:scale-[1.01] transition-transform duration-700 ease-out"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
