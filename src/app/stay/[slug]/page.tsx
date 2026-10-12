import type { Metadata } from "next";
import { PROPERTIES } from "@/data/properties";
import StayDetailClient from "./StayDetailClient";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const slug = params?.slug;
  const staticProperty = PROPERTIES.find(
    (p) => p.slug === slug || p.id === slug
  );

  if (staticProperty) {
    return {
      title: `${staticProperty.title} — ${staticProperty.neighborhood}, ${staticProperty.city} | Ilé`,
      description: staticProperty.tagline || staticProperty.description?.slice(0, 160) || "Curated Nigerian stay on Ilé.",
      openGraph: {
        title: `${staticProperty.title} — ${staticProperty.neighborhood}, ${staticProperty.city}`,
        description: staticProperty.tagline || staticProperty.description?.slice(0, 160),
        images: [{ url: staticProperty.coverImage || "/images/placeholder-property.jpg" }],
      },
    };
  }

  // Graceful fallback title for dynamically created database listings
  const formattedSlug = slug
    ? slug
        .replace(/-[a-f0-9]{8}$/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Stay Details";

  return {
    title: `${formattedSlug} | Ilé`,
    description: "Curated Nigerian stay on Ilé.",
  };
}

export default function StayDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return <StayDetailClient slug={params.slug} />;
}
