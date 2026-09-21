"use client";

import { useState } from "react";
import Image from "next/image";
import { getFallbackImage } from "@/lib/placeholders";

export default function HeroImage() {
  const [src, setSrc] = useState(
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85"
  );

  return (
    <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden rounded-[16px] sm:rounded-[20px] bg-[#E7E5E0] shadow-sm">
      <Image
        src={src}
        alt="Contemporary residence in Maitama, Abuja"
        fill
        priority
        sizes="(max-width: 1280px) 100vw, 1280px"
        className="object-cover"
        onError={() =>
          setSrc(getFallbackImage("The Olive Residence", "Maitama, Abuja"))
        }
      />
    </div>
  );
}
