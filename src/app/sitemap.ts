import { MetadataRoute } from "next";
import { getPublishedProperties } from "@/../backend/src/modules/properties/properties.service";

const BASE = "https://ilestays.ng";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/become-a-host`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/host`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let propertyRoutes: MetadataRoute.Sitemap = [];
  try {
    const result = await getPublishedProperties({ limit: 200, offset: 0 });
    if (result?.properties?.length) {
      propertyRoutes = result.properties.map((p: { slug?: string; id: string; updatedAt?: string | Date }) => ({
        url: `${BASE}/stay/${p.slug || p.id}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch {
    // fall through with static routes only
  }

  return [...staticRoutes, ...propertyRoutes];
}
