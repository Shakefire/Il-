import crypto from "crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDb, schema } from "../../db/client"
import { offsetCoordinates } from "../../lib/geocoding"
import { PROPERTY_STATUS } from "../../config/constants"

function httpError(statusCode: number, message: string): Error {
  const err: any = new Error(message)
  err.statusCode = statusCode
  return err
}

function publicFavourite(property: typeof schema.properties.$inferSelect) {
  const coords = offsetCoordinates(property.latitude, property.longitude)
  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    tagline: property.tagline,
    city: property.city,
    neighborhood: property.neighborhood,
    state: property.state,
    pricePerNight: property.pricePerNight,
    currency: property.currency,
    coverImage: property.coverImage,
    rating: property.rating,
    reviewCount: property.reviewCount,
    verified: property.verified,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    beds: property.beds,
    maxGuests: property.maxGuests,
    propertyType: property.propertyType,
    powerType: property.powerType,
    coordinates: { lat: coords.lat, lng: coords.lng },
  }
}

export async function listFavourites(userId: string) {
  const db = getDb()
  const rows = await db
    .select({ property: schema.properties })
    .from(schema.favourites)
    .innerJoin(schema.properties, eq(schema.favourites.propertyId, schema.properties.id))
    .where(
      and(
        eq(schema.favourites.userId, userId),
        eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED)
      )
    )
    .orderBy(desc(schema.favourites.createdAt))
  return { favourites: rows.map((row) => publicFavourite(row.property)) }
}

export async function addFavourite(userId: string, propertyId: string) {
  const db = getDb()
  const [property] = await db
    .select()
    .from(schema.properties)
    .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED)))
    .limit(1)
  if (!property) throw httpError(404, "Listing not found.")

  const [existing] = await db
    .select({ id: schema.favourites.id })
    .from(schema.favourites)
    .where(and(eq(schema.favourites.userId, userId), eq(schema.favourites.propertyId, propertyId)))
    .limit(1)
  if (existing) return { favourite: publicFavourite(property), created: false }

  await db.insert(schema.favourites).values({
    id: `fav_${crypto.randomUUID()}`,
    userId,
    propertyId,
  })
  return { favourite: publicFavourite(property), created: true }
}

export async function removeFavourite(userId: string, propertyId: string) {
  const db = getDb()
  await db
    .delete(schema.favourites)
    .where(and(eq(schema.favourites.userId, userId), eq(schema.favourites.propertyId, propertyId)))
  return { removed: true }
}
