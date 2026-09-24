import { eq, inArray, count, and, asc } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { offsetCoordinates } from "../../lib/geocoding";
import { PROPERTY_STATUS } from "../../config/constants";

/**
 * Enrich a raw property row with images, amenities, host, coordinates, and infrastructure.
 */
export function enrichProperty(
  prop: any,
  images: any[],
  amenities: any[],
  host: any
) {
  const coords = offsetCoordinates(prop.latitude, prop.longitude);

  return {
    id: prop.id,
    slug: prop.slug,
    title: prop.title,
    tagline: prop.tagline,
    description: prop.description,
    propertyType: prop.propertyType,
    spaceType: prop.spaceType,
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    beds: prop.beds,
    maxGuests: prop.maxGuests,
    pricePerNight: prop.pricePerNight,
    currency: prop.currency,
    city: prop.city,
    neighborhood: prop.neighborhood,
    state: prop.state,
    coverImage: prop.coverImage,
    rating: prop.rating,
    reviewCount: prop.reviewCount,
    verified: prop.verified,
    featured: prop.featured,
    powerType: prop.powerType,
    images: images.length > 0 ? images.map((img: any) => img.url || img) : [prop.coverImage],
    amenities,
    coordinates: {
      lat: coords.lat,
      lng: coords.lng,
    },
    infrastructure: {
      power: prop.powerDescription,
      powerType: prop.powerType,
      internet: prop.internetDescription,
      security: prop.securityDescription,
      water: prop.waterDescription,
      parking: prop.parkingDescription,
    },
    host: host
      ? {
          name: `${host.firstName} ${host.lastName}`,
          avatar: host.avatarUrl || "/images/default-avatar.png",
        }
      : { name: "Host", avatar: "/images/default-avatar.png" },
  };
}

/**
 * Get published properties with pagination and batch-fetched relations.
 */
export async function getPublishedProperties(pagination: { limit: number; offset: number }) {
  const db = getDb();

  // Count total
  const [totalResult] = await db
    .select({ total: count(schema.properties.id) })
    .from(schema.properties)
    .where(eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED));

  const total = Number(totalResult?.total) || 0;

  // Fetch page of properties (select ALL fields)
  const properties = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED))
    .limit(pagination.limit)
    .offset(pagination.offset);

  if (properties.length === 0) return { properties: [], total };

  const propertyIds = properties.map((p: any) => p.id);

  // Batch fetch images, amenities, and hosts (avoids N+1)
  const images = await db
    .select()
    .from(schema.propertyImages)
    .where(inArray(schema.propertyImages.propertyId, propertyIds))
    .orderBy(asc(schema.propertyImages.displayOrder));

  const amenities = await db
    .select()
    .from(schema.propertyAmenities)
    .where(inArray(schema.propertyAmenities.propertyId, propertyIds));

  const hostIds = Array.from(new Set(properties.map((p: any) => p.hostId)));
  const hosts = await db
    .select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, hostIds));

  // Map enriched properties
  const enriched = properties.map((prop: any) => {
    const propImages = images.filter((img: any) => img.propertyId === prop.id);
    const propAmenities = amenities.filter((a: any) => a.propertyId === prop.id);
    const host = hosts.find((h: any) => h.id === prop.hostId);

    return enrichProperty(prop, propImages, propAmenities, host);
  });

  return { properties: enriched, total };
}

/**
 * Get a single published property by slug with full details.
 */
export async function getPropertyBySlug(slug: string) {
  const db = getDb();

  const [prop] = await db
    .select()
    .from(schema.properties)
    .where(
      and(
        eq(schema.properties.slug, slug),
        eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED)
      )
    )
    .limit(1);

  if (!prop) return null;

  const images = await db
    .select()
    .from(schema.propertyImages)
    .where(eq(schema.propertyImages.propertyId, prop.id))
    .orderBy(asc(schema.propertyImages.displayOrder));

  const amenities = await db
    .select()
    .from(schema.propertyAmenities)
    .where(eq(schema.propertyAmenities.propertyId, prop.id));

  const [hostUser] = await db
    .select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.id, prop.hostId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, prop.hostId))
    .limit(1);

  const enriched = enrichProperty(prop, images, amenities, hostUser);

  // Add extended host info for single property view
  return {
    ...enriched,
    host: {
      ...enriched.host,
      bio: profile?.bio || "Verified property host on Ilé.",
      responseRate: profile?.responseRate || "100%",
      responseTime: profile?.responseTime || "Within an hour",
      joinedYear: profile?.joinedYear || 2026,
    },
  };
}
