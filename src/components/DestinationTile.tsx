"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getFallbackImage } from "@/lib/placeholders";

interface DestinationTileProps {
  id: string;
  name: string;
  state: string;
  tagline: string;
  image: string;
  stayCount: number;
  neighborhoods: string[];
}

export default function DestinationTile({
  name,
  state,
  tagline,
  image,
  stayCount,
  neighborhoods,
}: DestinationTileProps) {
  const [imgSrc, setImgSrc] = useState(image);

  return (
    <Link
      href={`/search?destination=${encodeURIComponent(name)}`}
      className="group relative block w-full overflow-hidden rounded-[16px] aspect-[16/10] sm:aspect-[16/9] bg-[#E7E5E0] focus:outline-none"
    >
      <Image
        src={imgSrc}
        alt={`${name} stays`}
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
        onError={() => setImgSrc(getFallbackImage(name, state))}
      />

      {/* Targeted Bottom Scrim Gradient: Solid dark base anchored strictly to bottom 65% without muddying sky/trees */}
      <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-black/90 via-black/55 via-45% to-transparent pointer-events-none" />

      {/* Editorial Content with balanced bottom padding */}
      <div className="absolute inset-0 p-8 sm:p-10 pb-8 sm:pb-9 flex flex-col justify-between text-white">
        <div className="flex justify-between items-start">
          <span className="text-[13px] uppercase tracking-wider font-semibold text-white/90 drop-shadow-sm">
            {stayCount} curated stays
          </span>
        </div>

        <div className="space-y-2.5">
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-white drop-shadow-md">
            {name}
          </h3>
          <p className="text-white/95 text-[15px] sm:text-[16px] max-w-md hidden sm:block leading-[1.55] drop-shadow-sm">
            {tagline}
          </p>
          <div className="pt-2 text-xs sm:text-[13.5px] text-white/90 font-medium tracking-wide drop-shadow-sm">
            {neighborhoods.join(" · ")}
          </div>
        </div>
      </div>
    </Link>
  );
}
