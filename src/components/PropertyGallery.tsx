"use client";

import { useState } from "react";
import Image from "next/image";
import { getFallbackImage } from "@/lib/placeholders";

interface PropertyGalleryProps {
  title: string;
  location: string;
  images: string[];
}

export default function PropertyGallery({
  title,
  location,
  images,
}: PropertyGalleryProps) {
  const [img0, setImg0] = useState(images[0]);
  const [img1, setImg1] = useState(images[1] || images[0]);
  const [img2, setImg2] = useState(images[2] || images[0]);

  return (
    <section aria-label="Photo Gallery">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 rounded-2xl overflow-hidden aspect-[16/10] sm:aspect-[21/10] max-h-[580px]">
        {/* Primary Large Image */}
        <div className="md:col-span-8 relative h-full w-full bg-[#E7E5E0]">
          <Image
            src={img0}
            alt={`${title} main interior`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 65vw"
            className="object-cover"
            onError={() => setImg0(getFallbackImage(title, location))}
          />
        </div>

        {/* Stacked Secondary Images */}
        <div className="hidden md:grid md:col-span-4 grid-rows-2 gap-3 sm:gap-4 h-full">
          <div className="relative h-full w-full bg-[#E7E5E0] overflow-hidden">
            <Image
              src={img1}
              alt={`${title} bedroom`}
              fill
              sizes="35vw"
              className="object-cover"
              onError={() => setImg1(getFallbackImage(`${title} Suite`, location))}
            />
          </div>
          <div className="relative h-full w-full bg-[#E7E5E0] overflow-hidden">
            <Image
              src={img2}
              alt={`${title} living area`}
              fill
              sizes="35vw"
              className="object-cover"
              onError={() => setImg2(getFallbackImage(`${title} Living`, location))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
