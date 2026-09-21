"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  heading: string;
  supportingText?: string;
  imageAlt?: string;
}

export default function AuthLayout({
  children,
  heading,
  supportingText,
  imageAlt = "Contemporary interior of a curated Nigerian residence",
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-between text-[#171717]">
      {/* 1. Subtle Top Bar: Logo on Left, Back to Home on Right */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 h-20 sm:h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl sm:text-3xl tracking-tight text-[#171717] font-normal">
            Ilé
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#0B5D45] mt-1 group-hover:scale-125 transition-transform" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[14px] font-medium text-[#6B6B67] hover:text-[#171717] transition-colors py-2 px-1"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </Link>
      </header>

      {/* 2. Main Two-Part Composition: Form on Left, Editorial Image on Right */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 flex items-center py-6 sm:py-10">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Form Side (spacious, calm, plenty of breathing room) */}
          <div className="md:col-span-6 lg:col-span-5 max-w-md w-full mx-auto md:mx-0">
            {/* Header copy */}
            <div className="space-y-2 mb-8 sm:mb-10">
              <h1 className="font-display text-3xl sm:text-4xl text-[#171717] font-normal tracking-tight">
                {heading}
              </h1>
              {supportingText && (
                <p className="text-[16px] text-[#6B6B67] font-light leading-relaxed">
                  {supportingText}
                </p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>

          {/* Editorial Visual Element (Hidden on mobile < 768px) */}
          <div className="hidden md:block md:col-span-6 lg:col-span-7 pl-0 lg:pl-6">
            <div className="relative w-full aspect-[4/5] lg:aspect-[16/14] rounded-2xl lg:rounded-3xl overflow-hidden bg-[#E7E5E0] shadow-sm border border-[#E7E5E0]/60">
              <Image
                src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=85"
                alt={imageAlt}
                fill
                priority
                sizes="(max-width: 1024px) 50vw, 60vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </main>

      {/* 3. Subtle Clean Bottom Space */}
      <footer className="w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-6 text-center md:text-left text-xs text-[#9E9E9A]">
        © 2026 Ilé Hospitality Ltd.
      </footer>
    </div>
  );
}
