"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Grid, X } from "lucide-react";
import { getFallbackImage } from "@/lib/placeholders";

interface PropertyGalleryProps {
  title: string;
  location: string;
  images: string[];
}

export default function PropertyGallery({
  title,
  location,
  images = [],
}: PropertyGalleryProps) {
  const safeImages = images.length > 0 ? images : [getFallbackImage(title, location)];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAllModal, setShowAllModal] = useState(false);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? safeImages.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === safeImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <section aria-label="Photo Gallery" className="space-y-3">
      {/* Mobile Gallery (< md): Interactive Touch Carousel with Arrows, Counter & Strip */}
      <div className="md:hidden relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#E7E5E0] shadow-sm select-none">
        <Image
          src={safeImages[currentIndex]}
          alt={`${title} photo ${currentIndex + 1}`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Previous / Next Arrow Controls */}
        {safeImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-transform active:scale-90"
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-transform active:scale-90"
              aria-label="Next photo"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* Counter Badge */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium tracking-wide">
          {currentIndex + 1} / {safeImages.length}
        </div>

        {/* Fullscreen Trigger */}
        <button
          type="button"
          onClick={() => setShowAllModal(true)}
          className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#171717] text-xs font-semibold shadow-xs flex items-center gap-1.5"
        >
          <Grid size={13} />
          <span>All photos</span>
        </button>
      </div>

      {/* Mobile Horizontal Thumbnail Strip */}
      {safeImages.length > 1 && (
        <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
          {safeImages.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all ${
                idx === currentIndex
                  ? "ring-2 ring-[#0B5D45] opacity-100 scale-105"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Desktop Gallery (>= md): Asymmetric Editorial Grid */}
      <div className="hidden md:grid md:grid-cols-12 gap-3 sm:gap-4 rounded-2xl overflow-hidden aspect-[21/10] max-h-[560px] relative">
        {/* Primary Large Image */}
        <div
          onClick={() => setShowAllModal(true)}
          className="md:col-span-8 relative h-full w-full bg-[#E7E5E0] cursor-pointer group"
        >
          <Image
            src={safeImages[0]}
            alt={`${title} main interior`}
            fill
            priority
            sizes="65vw"
            className="object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        </div>

        {/* Stacked Secondary Images */}
        <div className="md:col-span-4 grid grid-rows-2 gap-3 sm:gap-4 h-full">
          <div
            onClick={() => setShowAllModal(true)}
            className="relative h-full w-full bg-[#E7E5E0] overflow-hidden cursor-pointer group"
          >
            <Image
              src={safeImages[1] || safeImages[0]}
              alt={`${title} bedroom`}
              fill
              sizes="35vw"
              className="object-cover group-hover:scale-[1.01] transition-transform duration-300"
            />
          </div>
          <div
            onClick={() => setShowAllModal(true)}
            className="relative h-full w-full bg-[#E7E5E0] overflow-hidden cursor-pointer group"
          >
            <Image
              src={safeImages[2] || safeImages[0]}
              alt={`${title} living area`}
              fill
              sizes="35vw"
              className="object-cover group-hover:scale-[1.01] transition-transform duration-300"
            />
          </div>
        </div>

        {/* Show all photos button */}
        <button
          type="button"
          onClick={() => setShowAllModal(true)}
          className="absolute bottom-4 right-4 px-4 py-2 rounded-xl bg-white/95 hover:bg-white text-[#171717] text-xs font-semibold shadow-md backdrop-blur-sm transition-all hover:scale-105 flex items-center gap-1.5"
        >
          <Grid size={14} />
          <span>Show all {safeImages.length} photos</span>
        </button>
      </div>

      {/* Full Photo Modal */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-y-auto">
          <div className="flex items-center justify-between text-white max-w-5xl mx-auto w-full pb-4 border-b border-white/20">
            <h3 className="font-semibold text-lg">{title} — Photo Gallery</h3>
            <button
              type="button"
              onClick={() => setShowAllModal(false)}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="max-w-4xl mx-auto w-full py-6 space-y-6">
            {safeImages.map((img, i) => (
              <div key={i} className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-neutral-900">
                <Image src={img} alt={`${title} photo ${i + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
