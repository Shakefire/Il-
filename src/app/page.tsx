import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import DestinationTile from "@/components/DestinationTile";
import HostCTA from "@/components/HostCTA";
import StaysExplorer from "@/components/StaysExplorer";
import { PROPERTIES, DESTINATIONS } from "@/data/properties";

export default function HomePage() {
  return (
    <div className="w-full">
      {/* 1. Immersive Hero Section: Full-width, high-quality interior background with subtle dark overlay */}
      <section className="relative w-full min-h-[580px] sm:min-h-[660px] lg:min-h-[720px] flex items-center justify-center z-20">
        {/* Background Image & Gradient Overlays isolated in overflow-hidden layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Image
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85"
            alt="Luxury Nigerian residence interior"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Targeted Gradient Mask */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.52)_0%,rgba(0,0,0,0.18)_55%,transparent_80%)]" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        {/* Hero Content & Floating Frosted Search Container */}
        <div className="relative z-20 w-full max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-24 text-center flex flex-col items-center">
          {/* White Editorial Headline with Crisp High-Contrast Text Shadows */}
          <div className="max-w-3xl space-y-4">
            <h1 className="font-display text-[44px] sm:text-[62px] lg:text-[76px] text-white font-semibold leading-[1.02] tracking-tight [text-shadow:0_2px_14px_rgba(0,0,0,0.75),0_1px_4px_rgba(0,0,0,0.9)]">
              Find somewhere <br className="hidden sm:inline" />
              worth staying.
            </h1>
            <p className="text-[17px] sm:text-[21px] text-white max-w-xl mx-auto font-light leading-relaxed [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
              Thoughtfully selected homes, apartments and shortlets across Nigeria.
            </p>
          </div>

          {/* Floating Frosted Glass Search Container hovering over hero image */}
          <div className="mt-10 sm:mt-14 w-full">
            <SearchBar
              initialDestination="Abuja"
              initialPropertyType="All Types"
              initialGuests={2}
            />
          </div>
        </div>
      </section>

      {/* 2. Content Below The Fold: Pure White Background (#FFFFFF) for Maximum Readability */}
      <section className="bg-white py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Stays Explorer: Secondary Action Bar (Sliders/Filters, New first Sort, Grid vs Map) & Property Cards */}
          <StaysExplorer initialProperties={PROPERTIES} />
        </div>
      </section>

      {/* 3. Popular Destinations */}
      <section className="bg-[#FAF9F6] py-16 sm:py-24 border-t border-[#F0EFEB]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-8 sm:space-y-10">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
                Destinations
              </span>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-[#171717] font-normal mt-1">
                Popular destinations
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {DESTINATIONS.map((dest) => (
              <DestinationTile
                key={dest.id}
                id={dest.id}
                name={dest.name}
                state={dest.state}
                tagline={dest.tagline}
                image={dest.image}
                stayCount={dest.stayCount}
                neighborhoods={dest.neighborhoods}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 4. Host CTA */}
      <div className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <HostCTA />
        </div>
      </div>
    </div>
  );
}
