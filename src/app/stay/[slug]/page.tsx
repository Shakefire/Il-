"use client";

// Force dynamic rendering to prevent stale /_next/data route mismatches
// after new Vercel deployments (avoids 500 on client navigation)
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { PROPERTIES } from "@/data/properties";
import BookingPanel from "@/components/BookingPanel";
import PropertyGallery from "@/components/PropertyGallery";
import { api } from "@/lib/api";
import { Property } from "@/types";
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
  Loader2,
  Building,
} from "lucide-react";

export default function StayDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const staticMatch = PROPERTIES.find(
    (p) => p.slug === params.slug || p.id === params.slug
  );

  const [property, setProperty] = useState<Property | null>(staticMatch || null);
  const [loading, setLoading] = useState(!staticMatch);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProperty() {
      // If already matched statically, we still verify with backend if needed, or stick with static
      if (staticMatch) {
        setProperty(staticMatch);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.getProperty(params.slug);
        if (active && res && res.property) {
          const raw = res.property;
          const normalized: Property = {
            id: raw.id,
            slug: raw.slug,
            title: raw.title,
            tagline: raw.tagline || "",
            description: raw.description || "Spacious, curated accommodation on Ilé.",
            city: raw.city || "Abuja",
            neighborhood: raw.neighborhood || "",
            state: raw.state || "FCT",
            pricePerNight: Number(raw.pricePerNight) || 50000,
            currency: raw.currency || "NGN",
            rating: Number(raw.rating) || 5.0,
            reviewCount: Number(raw.reviewCount) || 0,
            verified: raw.verified ?? true,
            bedrooms: Number(raw.bedrooms) || 1,
            bathrooms: Number(raw.bathrooms) || 1,
            maxGuests: Number(raw.maxGuests) || 2,
            coverImage: raw.coverImage || "/images/placeholder-property.jpg",
            images: Array.isArray(raw.images) && raw.images.length > 0 ? raw.images : [raw.coverImage || "/images/placeholder-property.jpg"],
            propertyType: raw.propertyType || "Serviced Apartment",
            infrastructure: raw.infrastructure || {
              power: raw.powerDescription || "24/7 dedicated power supply with solar & inverter backup",
              powerType: raw.powerType || "Solar + Inverter",
              internet: raw.internetDescription || "High-speed fiber optic Wi-Fi throughout the apartment",
              security: raw.securityDescription || "24-hour gated estate security with manned access control",
              water: raw.waterDescription || "Continuous treated borehole water supply",
              parking: raw.parkingDescription || "Free secure on-premises parking",
            },
            amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
            host: raw.host || {
              name: "Host",
              role: "Property Host",
              joinedYear: 2026,
              avatar: "/images/default-avatar.png",
              responseRate: "100%",
              responseTime: "Within an hour",
              bio: "Verified property host on Ilé.",
            },
            coordinates: raw.coordinates || { lat: 9.0765, lng: 7.3986 },
            reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
            isReserved: raw.isReserved ?? false,
          };
          setProperty(normalized);
        }
      } catch (err) {
        console.warn("Could not fetch remote property:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProperty();

    return () => {
      active = false;
    };
  }, [params.slug, staticMatch]);

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      try {
        if (navigator.share) {
          await navigator.share({
            title: property?.title || "Ilé Stay",
            text: `Check out ${property?.title} on Ilé`,
            url: window.location.href,
          });
        } else {
          await navigator.clipboard.writeText(window.location.href);
          setCopiedShare(true);
          setTimeout(() => setCopiedShare(false), 2500);
        }
      } catch {}
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 bg-[#FAFAF8]">
        <Loader2 size={32} className="animate-spin text-[#0B5D45]" />
        <p className="text-sm text-[#6B6B67]">Loading property details...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center bg-[#FAFAF8]">
        <div className="max-w-md w-full bg-white border border-[#E7E5E0] rounded-2xl p-8 space-y-4 shadow-sm">
          <Building size={40} className="mx-auto text-[#0B5D45]" />
          <h2 className="text-2xl font-display font-medium text-[#171717]">Listing Not Found</h2>
          <p className="text-sm text-[#6B6B67] leading-relaxed">
            This property listing might have been removed, unlisted, or the link may be invalid.
          </p>
          <div className="pt-2">
            <Link
              href="/search"
              className="inline-block px-5 py-2.5 bg-[#0B5D45] text-white rounded-xl text-sm font-semibold hover:bg-[#084936] transition-colors"
            >
              Explore Available Stays
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-32 bg-[#FAFAF8]">
      {/* Back Link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-3">
        <Link
          href={`/search?destination=${encodeURIComponent(property.city)}`}
          className="inline-flex items-center gap-2 text-sm text-[#6B6B67] hover:text-[#171717] transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to {property.city} stays</span>
        </Link>
      </div>

      {/* Main Content Area */}
      <article className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 space-y-6 sm:space-y-8">
        {/* Title & Metadata Header */}
        <header className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-[#171717] font-normal tracking-tight">
              {property.title}
            </h1>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-sm text-[#6B6B67] hover:text-[#171717] self-start sm:self-auto py-1.5 px-3 rounded-lg border border-[#E7E5E0] bg-white hover:border-[#171717] transition-all"
            >
              <Share2 size={14} />
              <span>{copiedShare ? "Link Copied!" : "Share"}</span>
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
                {property.rating ? property.rating.toFixed(2) : "5.00"}
              </span>
              <span>({property.reviewCount || 0} reviews)</span>
            </div>
            <span>·</span>
            <span>
              {property.bedrooms} {property.bedrooms === 1 ? "bedroom" : "bedrooms"}
            </span>
            <span>·</span>
            <span>{property.maxGuests} guests maximum</span>
          </div>
        </header>

        {/* Asymmetric 3-Image Editorial Gallery with Mobile Carousel */}
        <PropertyGallery
          title={property.title}
          location={`${property.neighborhood}, ${property.city}`}
          images={property.images}
        />

        {/* Main Grid: Left Details (7 cols) + Right Sticky Booking (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 pt-4 sm:pt-6">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-10 sm:space-y-12">
            {/* Host Intro & Quick Specs */}
            <div className="flex items-center justify-between pb-8 border-b border-[#E7E5E0]">
              <div>
                <h2 className="text-[20px] font-medium text-[#171717]">
                  Hosted by {property.host?.name || "Verified Host"}
                </h2>
                <p className="text-[14px] text-[#6B6B67] mt-0.5">
                  {property.host?.role || "Property Host"} · Hosting since {property.host?.joinedYear || 2026} · Responds {property.host?.responseTime ? property.host.responseTime.toLowerCase() : "within an hour"}
                </p>
              </div>
              <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border border-[#E7E5E0] bg-[#E7E5E0]">
                <Image
                  src={property.host?.avatar || "/images/default-avatar.png"}
                  alt={property.host?.name || "Host"}
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Nigerian Infrastructure Highlight */}
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
                      {property.infrastructure?.power || "24/7 dedicated power setup"}
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
                      {property.infrastructure?.internet || "High-speed Wi-Fi available"}
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
                      {property.infrastructure?.security || "24/7 gated security"}
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
                      {property.infrastructure?.water || "Continuous treated water supply"}
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
                      {property.infrastructure?.parking || "Secure on-premises parking"}
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
            {property.amenities && property.amenities.length > 0 && (
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
                      <span>{typeof amenity === "string" ? amenity : amenity.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Neighborhood / Location */}
            <section className="space-y-4 pt-4 border-t border-[#E7E5E0]">
              <h3 className="font-display text-2xl text-[#171717] font-normal">
                Location &amp; neighborhood
              </h3>
              <p className="text-[15px] text-[#6B6B67] leading-relaxed">
                {property.neighborhood} is one of {property.city}&apos;s most desirable and peaceful residential enclaves. Quiet streets, mature trees, and proximity to grocery markets, pharmacies, and diplomatic/commercial centers.
              </p>
              <div className="p-4 rounded-xl bg-white border border-[#E7E5E0] text-[14px] text-[#6B6B67]">
                Exact estate gate address and driver directions are provided immediately upon booking confirmation.
              </div>
            </section>

            {/* Verified Reviews */}
            {property.reviews && property.reviews.length > 0 && (
              <section className="space-y-6 pt-4 border-t border-[#E7E5E0]">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display text-2xl text-[#171717] font-normal">
                    Guest reviews
                  </h3>
                  <span className="text-[15px] text-[#6B6B67]">
                    ★ {property.rating ? property.rating.toFixed(2) : "5.00"} · {property.reviewCount || 0} reviews
                  </span>
                </div>

                <div className="space-y-6">
                  {property.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-5 rounded-2xl bg-white border border-[#E7E5E0]/70 space-y-2"
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
            )}
          </div>

          {/* Right Column: Sticky Booking Widget (Fully responsive for mobile & desktop) */}
          <div className="lg:col-span-5">
            <BookingPanel property={property} />
          </div>
        </div>
      </article>
    </div>
  );
}
