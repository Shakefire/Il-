import type { Metadata } from "next";
import { PROPERTIES } from "@/data/properties";
import StayDetailClient from "./StayDetailClient";

export async function generateStaticParams() {
  return PROPERTIES.flatMap((p) => [
    { slug: p.slug },
    { slug: p.id },
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const property = PROPERTIES.find(
    (p) => p.slug === params.slug || p.id === params.slug
  );

  if (!property) {
    return {
      title: "Stay Details — Ilé",
    };
  }

  return {
    title: `${property.title} — ${property.neighborhood}, ${property.city} | Ilé`,
    description: property.tagline || property.description.slice(0, 160),
    openGraph: {
      title: `${property.title} — ${property.neighborhood}, ${property.city}`,
      description: property.tagline,
      images: [{ url: property.coverImage }],
    },
  };
}

export default function StayDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  return <StayDetailClient slug={params.slug} />;
}
