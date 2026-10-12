import type { Metadata } from "next";
import { PROPERTIES } from "@/data/properties";
import { getPropertyBySlug } from "@/../backend/src/modules/properties/properties.service";
import StayDetailClient from "./StayDetailClient";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);

  try {
    // 1. Try fetching from live database
    const dbProperty = await getPropertyBySlug(slug, true);
    if (dbProperty) {
      return {
        title: `${dbProperty.title} — ${dbProperty.neighborhood || dbProperty.city}, ${dbProperty.city} | Ilé`,
        description: dbProperty.tagline || dbProperty.description?.slice(0, 160) || "Curated Nigerian stay on Ilé.",
        openGraph: {
          title: `${dbProperty.title} — ${dbProperty.neighborhood || dbProperty.city}, ${dbProperty.city}`,
          description: dbProperty.tagline || dbProperty.description?.slice(0, 160),
          images: [{ url: dbProperty.coverImage || "/images/placeholder-property.jpg" }],
        },
      };
    }
  } catch {
    // Ignore DB error during metadata generation and fall back
  }

  // 2. Fallback to static mock list
  const staticProperty = PROPERTIES.find(
    (p) => p.slug === slug || p.id === slug
  );

  if (staticProperty) {
    return {
      title: `${staticProperty.title} — ${staticProperty.neighborhood}, ${staticProperty.city} | Ilé`,
      description: staticProperty.tagline || staticProperty.description?.slice(0, 160),
      openGraph: {
        title: `${staticProperty.title} — ${staticProperty.neighborhood}, ${staticProperty.city}`,
        description: staticProperty.tagline,
        images: [{ url: staticProperty.coverImage }],
      },
    };
  }

  return {
    title: "Stay Details — Ilé",
  };
}

export default async function StayDetailPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const { slug } = await Promise.resolve(params);
  return <StayDetailClient slug={slug} />;
}
