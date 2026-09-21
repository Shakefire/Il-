"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { Property } from "@/types";
import { formatNaira } from "@/lib/utils";
import { getFallbackImage } from "@/lib/placeholders";

interface PropertyCardProps {
  property: Property;
  onHover?: (id: string | null) => void;
  isHovered?: boolean;
}

export default function PropertyCard({
  property,
  onHover,
  isHovered = false,
}: PropertyCardProps) {
  // Gallery images array (guaranteed at least 1 image)
  const images =
    property.images && property.images.length > 0
      ? property.images
      : [property.coverImage];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imgError, setImgError] = useState(false);

  const currentImage = images[currentImageIndex] || property.coverImage;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite((prev) => !prev);
  };

  return (
    <Link
      href={`/stay/${property.slug}`}
      onMouseEnter={() => onHover && onHover(property.id)}
      onMouseLeave={() => onHover && onHover(null)}
      className="group block focus:outline-none h-full"
    >
      {/* Unified Card Container: Resolves container ambiguity with clean border, background, and soft hover elevation */}
      <div
        className={`h-full bg-white rounded-[18px] border p-3 sm:p-3.5 flex flex-col transition-all duration-300 shadow-xs hover:shadow-md ${
          isHovered
            ? "border-[#24483A] shadow-md ring-1 ring-[#24483A]/15"
            : "border-[#EAE8E3] hover:border-[#D1CEC7]"
        }`}
      >
        {/* Image Container with Mini-Gallery Affordances */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[13px] bg-[#E7E5E0] select-none">
          <Image
            src={
              imgError
                ? getFallbackImage(property.title, `${property.neighborhood}, ${property.city}`)
                : currentImage
            }
            alt={`${property.title} photo ${currentImageIndex + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            onError={() => setImgError(true)}
          />

          {/* 1. Verified Stay Pill Badge */}
          {property.verified && (
            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold text-[#171717] tracking-tight border border-[#E7E5E0]/60 shadow-xs pointer-events-none">
              Verified stay
            </div>
          )}

          {/* 2. Quick Action: Save / Favorite Button */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-md text-white transition-all duration-200 border border-white/20 shadow-xs hover:scale-110 active:scale-95 focus:outline-none"
            aria-label={isFavorite ? "Remove from saved shortlist" : "Save stay to shortlist"}
          >
            <Heart
              size={17}
              className={`transition-colors duration-200 ${
                isFavorite
                  ? "fill-[#E11D48] text-[#E11D48]"
                  : "stroke-white fill-black/20 text-white"
              }`}
            />
          </button>

          {/* 3. Image Affordances: Mini Carousel Navigation Arrows */}
          {images.length > 1 && (
            <>
              {/* Previous Arrow */}
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#171717] flex items-center justify-center shadow-md transition-all duration-150 opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-90 focus:outline-none"
                aria-label="Previous photo"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>

              {/* Next Arrow */}
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-[#171717] flex items-center justify-center shadow-md transition-all duration-150 opacity-0 group-hover:opacity-100 hover:scale-105 active:scale-90 focus:outline-none"
                aria-label="Next photo"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
                {images.slice(0, 5).map((_, idx) => (
                  <span
                    key={idx}
                    className={`transition-all duration-200 rounded-full shadow-xs ${
                      idx === currentImageIndex
                        ? "w-3.5 h-1.5 bg-white"
                        : "w-1.5 h-1.5 bg-white/60"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content Section: Clearly structured inside the card boundary */}
        <div className="pt-3.5 px-1 pb-0.5 space-y-1.5 flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            {/* Title & Star Rating */}
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`text-[17px] sm:text-[18px] font-semibold tracking-tight transition-colors line-clamp-1 ${
                  isHovered
                    ? "text-[#24483A]"
                    : "text-[#171717] group-hover:text-[#24483A]"
                }`}
              >
                {property.title}
              </h3>
              <div className="flex items-center gap-1 text-[13px] text-[#171717] font-semibold shrink-0 pt-0.5">
                <Star size={13} className="fill-[#171717] text-[#171717] stroke-none" />
                <span>{property.rating.toFixed(2)}</span>
              </div>
            </div>

            {/* Location with Pin */}
            <p className="text-[13.5px] text-[#6B6B67] flex items-center gap-1.5">
              <MapPin size={13} className="text-[#8B8B86] shrink-0" />
              <span className="truncate">
                {property.neighborhood}, {property.city}
              </span>
            </p>
          </div>

          {/* Pricing & Review count footer */}
          <div className="pt-2 border-t border-[#F2F0EC] flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 text-[#171717]">
              <span className="text-[18px] sm:text-[19px] font-bold tracking-tight">
                {formatNaira(property.pricePerNight)}
              </span>
              <span className="text-[#6B6B67] font-normal text-[13px]">/ night</span>
            </div>
            <span className="text-[12px] text-[#8B8B86]">
              {property.reviewCount} reviews
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
