import type { Metadata } from "next"
import StayDetailClient from "./StayDetailClient"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Metadata {
  const slug = params?.slug
  const formattedSlug = slug
    ? slug
        .replace(/-[a-f0-9]{8}$/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Stay Details"

  return {
    title: `${formattedSlug} | Ilé`,
    description: "Curated Nigerian stay on Ilé.",
  }
}

export default function StayDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  return <StayDetailClient slug={params.slug} />
}
