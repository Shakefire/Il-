import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { PROPERTIES } from "@/data/properties";
import BookingPanel from "@/components/BookingPanel";
import PropertyGallery from "@/components/PropertyGallery";
import {
  Star,
  Zap,
  Wifi,
  Shield,
  Droplets,
  Car,
  ArrowLeft,
  CheckCircle2,
  Share2,
} from "lucide-react";

export function generateStaticParams() {
  return PROPERTIES.map((prop) => ({
    slug: prop.slug,
  }));
}

export default function StayDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const property = PROPERTIES.find((p) => p.slug === params.slug);

  if (!property) {
    notFound();
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-32">
      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-8 pb-4">
        <Link
          href={`/search?destination=${encodeURIComponent(property.city)}`}
          className="inline-flex items-center gap-2 text-sm text-[#6B6B67] hover:text-[#171717] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to {property.city} stays</span>
        </Link>
      </div>

      {/* Main Content Area */}
      <article className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 space-y-8">
        {/* Title & Metadata Header */}
        <header className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#171717] font-normal tracking-tight">
              {property.title}
            </h1>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm text-[#6B6B67] hover:text-[#171717] self-start sm:self-auto py-1.5 px-3 rounded-lg border border-[#E7E5E0] hover:border-[#171717] transition-all"
            >
              <Share2 size={14} />
              <span>Share</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-[#6B6B67]">
            <span className="text-[#171717] font-medium">
              {property.neighborhood}, {property.city}
            </span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <Star size={14} className="fill-[#171717] text-[#171717]" />
              <span className="font-medium text-[#171717]">
                {property.rating.toFixed(2)}
              </span>
              <span>({property.reviewCount} reviews)</span>
            </div>
            <span>·</span>
            <span>
              {property.bedrooms} {property.bedrooms === 1 ? "bedroom" : "bedrooms"}
            </span>
            <span>·</span>
            <span>{property.maxGuests} guests maximum</span>
          </div>
        </header>

        {/* Asymmetric 3-Image Editorial Gallery */}
        <PropertyGallery
          title={property.title}
          location={`${property.neighborhood}, ${property.city}`}
          images={property.images}
        />

        {/* Main Grid: Left Details (7 cols) + Right Sticky Booking (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-16 pt-6">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-12">
            {/* Host Intro & Quick Specs */}
            <div className="flex items-center justify-between pb-8 border-b border-[#E7E5E0]">
              <div>
                <h2 className="text-[20px] font-medium text-[#171717]">
                  Hosted by {property.host.name}
                </h2>
                <p className="text-[14px] text-[#6B6B67] mt-0.5">
                  {property.host.role} · Hosting since {property.host.joinedYear} · Responds {property.host.responseTime.toLowerCase()}
                </p>
              </div>
              <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border border-[#E7E5E0]">
                <Image
                  src={property.host.avatar}
                  alt={property.host.name}
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Nigerian Infrastructure Highlight (Crucial for Trust & Reliability) */}
            <section className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#8B8B86] font-semibold">
                  Essential infrastructure
                </span>
                <h3 className="font-display text-2xl text-[#171717] font-normal mt-1">
                  What you&apos;ll have
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] shrink-0 mt-0.5">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-medium text-[#171717]">
                      Reliable power
                    </h4>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed mt-0.5">
                      {property.infrastructure.power}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] shrink-0 mt-0.5">
                    <Wifi size={20} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-medium text-[#171717]">
                      Stay connected
                    </h4>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed mt-0.5">
                      {property.infrastructure.internet}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] shrink-0 mt-0.5">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-medium text-[#171717]">
                      Estate security
                    </h4>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed mt-0.5">
                      {property.infrastructure.security}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] shrink-0 mt-0.5">
                    <Droplets size={20} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-medium text-[#171717]">
                      Treated water
                    </h4>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed mt-0.5">
                      {property.infrastructure.water}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 sm:col-span-2">
                  <div className="p-2.5 rounded-xl bg-[#EDF3F0] text-[#24483A] shrink-0 mt-0.5">
                    <Car size={20} />
                  </div>
                  <div>
                    <h4 className="text-[16px] font-medium text-[#171717]">
                      Parking on premises
                    </h4>
                    <p className="text-[14px] text-[#6B6B67] leading-relaxed mt-0.5">
                      {property.infrastructure.parking}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* The Space Description */}
            <section className="space-y-4 pt-4 border-t border-[#E7E5E0]">
              <h3 className="font-display text-2xl text-[#171717] font-normal">
                The space
              </h3>
              <p className="text-[16px] sm:text-[17px] text-[#6B6B67] leading-relaxed">
                {property.description}
              </p>
              <p className="text-[15px] text-[#6B6B67] leading-relaxed">
                Designed for calm and ease. Whether working remotely with uninterrupted internet or unwinding on the balcony, every detail has been arranged to eliminate typical shortlet friction.
              </p>
            </section>

            {/* Amenities Section */}
            <section className="space-y-6 pt-4 border-t border-[#E7E5E0]">
              <h3 className="font-display text-2xl text-[#171717] font-normal">
                Amenities
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {property.amenities.map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-[15px] text-[#171717]"
                  >
                    <CheckCircle2 size={17} className="text-[#24483A] shrink-0" />
                    <span>{amenity.name}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Neighborhood / Location */}
            <section className="space-y-4 pt-4 border-t border-[#E7E5E0]">
              <h3 className="font-display text-2xl text-[#171717] font-normal">
                Location & neighborhood
              </h3>
              <p className="text-[15px] text-[#6B6B67] leading-relaxed">
                {property.neighborhood} is one of {property.city}&apos;s most desirable and peaceful residential enclaves. Quiet streets, mature trees, and proximity to grocery markets, pharmacies, and diplomatic/commercial centers.
              </p>
              <div className="p-4 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] text-[14px] text-[#6B6B67]">
                Exact estate gate address and driver directions are provided immediately upon booking confirmation.
              </div>
            </section>

            {/* Verified Reviews */}
            <section className="space-y-6 pt-4 border-t border-[#E7E5E0]">
              <div className="flex items-baseline gap-3">
                <h3 className="font-display text-2xl text-[#171717] font-normal">
                  Guest reviews
                </h3>
                <span className="text-[15px] text-[#6B6B67]">
                  ★ {property.rating.toFixed(2)} · {property.reviewCount} reviews
                </span>
              </div>

              <div className="space-y-6">
                {property.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-2xl bg-[#FAFAF8] border border-[#E7E5E0]/70 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[15px] text-[#171717]">
                        {rev.author}
                      </span>
                      <span className="text-[13px] text-[#8B8B86]">
                        {rev.date}
                      </span>
                    </div>
                    <div className="text-[12px] text-[#6B6B67]">
                      Visiting from {rev.location}
                    </div>
                    <p className="text-[15px] text-[#171717] pt-1 leading-relaxed">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Sticky Booking Widget */}
          <div className="lg:col-span-5">
            <BookingPanel property={property} />
          </div>
        </div>
      </article>
    </div>
  );
}
