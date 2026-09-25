import { eq, inArray, and, lte, gte, asc, lt, gt } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { calculateDistanceKm, offsetCoordinates } from "../../lib/geocoding";
import { locationsService, NormalizedLocation } from "../locations/locations.service";
import { PROPERTY_STATUS, DEFAULT_SEARCH_RADIUS_KM } from "../../config/constants";
import { enrichProperty } from "../properties/properties.service";

/**
 * Find property IDs that are unavailable for the given date range.
 */
export async function getUnavailablePropertyIds(checkIn: string, checkOut: string): Promise<Set<string>> {
  const db = getDb();

  const conflicting = await db
    .select({ propertyId: schema.availabilityBlocks.propertyId })
    .from(schema.availabilityBlocks)
    .where(
      and(
        lt(schema.availabilityBlocks.startDate, checkOut),
        gt(schema.availabilityBlocks.endDate, checkIn)
      )
    );

  return new Set(conflicting.map((b: any) => b.propertyId));
}

export interface SearchParams {
  location?: string;
  destination?: string;
  lat?: string | number;
  lng?: string | number;
  radius?: string | number;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  type?: string;
  bedrooms?: string;
  maxPrice?: string;
  minPrice?: string;
  powerType?: string;
  amenities?: string;
  page?: string;
  limit?: string;
}

/**
 * Full-text + geo search for properties with real proximity sorting.
 */
export async function searchProperties(params: SearchParams) {
  const db = getDb();

  const locationQuery = params.location || params.destination || "";
  const guests = params.guests ? parseInt(params.guests, 10) : 1;
  const checkIn = params.checkIn;
  const checkOut = params.checkOut;
  const propType = params.type && params.type !== "All Types" && params.type !== "all" ? params.type : null;
  const bedrooms = params.bedrooms && params.bedrooms !== "any" ? parseInt(params.bedrooms, 10) : null;
  const maxPrice = params.maxPrice ? parseInt(params.maxPrice, 10) : null;
  const minPrice = params.minPrice ? parseInt(params.minPrice, 10) : null;
  const powerType = params.powerType || null;
  const requiredAmenities = params.amenities
    ? params.amenities.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
    : [];
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.min(Math.max(1, parseInt(params.limit || "20", 10)), 100);

  // 1. Resolve geographic target coordinates
  let targetLat: number | null = null;
  let targetLng: number | null = null;
  let boundingRadiusKm = params.radius ? parseFloat(String(params.radius)) : DEFAULT_SEARCH_RADIUS_KM;
  let resolvedLocation: NormalizedLocation | null = null;

  if (params.lat && params.lng) {
    targetLat = parseFloat(String(params.lat));
    targetLng = parseFloat(String(params.lng));
  } else if (locationQuery && locationQuery.trim().toLowerCase() !== "all nigeria") {
    try {
      const candidates = await locationsService.search(locationQuery);
      if (candidates.length > 0) {
        resolvedLocation = candidates[0];
        targetLat = resolvedLocation.latitude;
        targetLng = resolvedLocation.longitude;
      }
    } catch (geoErr) {
      console.warn("[Search] Geocoding lookup fallback:", geoErr);
    }
  }

  // 2. Fetch all published properties
  const allPublished = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.status, PROPERTY_STATUS.PUBLISHED));

  // 3. Check date availability
  let unavailableIds = new Set<string>();
  if (checkIn && checkOut) {
    unavailableIds = await getUnavailablePropertyIds(checkIn, checkOut);
  }

  // 4. Load amenities for filtering if specified
  let allAmenities: any[] = [];
  if (requiredAmenities.length > 0) {
    allAmenities = await db.select().from(schema.propertyAmenities);
  }

  // 5. Filter properties
  const filtered = allPublished.filter((p: any) => {
    // If date range given, only hide properties that are blocked AND the user wants "available only"
    // We keep reserved properties in — they'll be ranked lower and marked isReserved
    if (p.maxGuests < guests) return false;

    if (propType) {
      const normSelected = propType.toLowerCase();
      const propertyTypeNorm = p.propertyType.toLowerCase();
      if (!propertyTypeNorm.includes(normSelected) && !normSelected.includes(propertyTypeNorm)) return false;
    }

    if (bedrooms !== null && p.bedrooms < bedrooms) return false;
    if (maxPrice !== null && p.pricePerNight > maxPrice) return false;
    if (minPrice !== null && p.pricePerNight < minPrice) return false;

    if (powerType && !p.powerType.toLowerCase().includes(powerType.toLowerCase())) return false;

    // Amenities filter
    if (requiredAmenities.length > 0) {
      const propAmenityNames = allAmenities
        .filter((a: any) => a.propertyId === p.id)
        .map((a: any) => a.name.toLowerCase());
      if (!requiredAmenities.every((req) => propAmenityNames.some((name) => name.includes(req)))) {
        return false;
      }
    }

    // Geographic Proximity Filter
    if (targetLat !== null && targetLng !== null) {
      const distKm = calculateDistanceKm(
        targetLat,
        targetLng,
        p.latitude,
        p.longitude
      );

      // Check if within radius, or if neighborhood / city text matches
      const matchesCity = resolvedLocation && p.city.toLowerCase() === resolvedLocation.city.toLowerCase();
      const matchesNeighborhood = resolvedLocation && p.neighborhood.toLowerCase().includes(resolvedLocation.neighborhood.toLowerCase());

      if (distKm > boundingRadiusKm && !matchesCity && !matchesNeighborhood) {
        return false;
      }

      p.distanceKm = Math.round(distKm * 10) / 10;
    } else if (locationQuery && locationQuery.toLowerCase() !== "all nigeria") {
      const normLoc = locationQuery.toLowerCase();
      const matchesText =
        p.city.toLowerCase().includes(normLoc) ||
        p.neighborhood.toLowerCase().includes(normLoc) ||
        p.state.toLowerCase().includes(normLoc);
      if (!matchesText) return false;
    }

    return true;
  });

  // Stamp isReserved on each property before sorting
  filtered.forEach((p: any) => {
    p.isReserved = unavailableIds.has(p.id);
  });

  // Sort: available first, then reserved. Within each tier, sort by geographic distance if available.
  filtered.sort((a: any, b: any) => {
    if (a.isReserved !== b.isReserved) return a.isReserved ? 1 : -1;
    if (targetLat !== null && targetLng !== null) {
      return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    }
    return 0;
  });

  const totalResults = filtered.length;

  // 6. Paginate
  const offset = (page - 1) * limit;
  const pageResults = filtered.slice(offset, offset + limit);

  if (pageResults.length === 0) {
    return {
      query: {
        location: locationQuery,
        resolvedLocation: resolvedLocation || null,
        coordinates: targetLat && targetLng ? { lat: targetLat, lng: targetLng } : null,
        checkIn,
        checkOut,
        guests,
        totalResults: 0,
      },
      properties: [],
      pagination: {
        page,
        limit,
        total: totalResults,
        totalPages: Math.ceil(totalResults / limit),
        hasNext: false,
        hasPrev: page > 1,
      },
    };
  }

  // 7. Batch enrich relations
  const propertyIds = pageResults.map((p: any) => p.id);

  const images = await db
    .select()
    .from(schema.propertyImages)
    .where(inArray(schema.propertyImages.propertyId, propertyIds))
    .orderBy(asc(schema.propertyImages.displayOrder));

  const amenities = await db
    .select()
    .from(schema.propertyAmenities)
    .where(inArray(schema.propertyAmenities.propertyId, propertyIds));

  const hostIds = Array.from(new Set(pageResults.map((p: any) => p.hostId)));
  const hosts = await db
    .select({
      id: schema.users.id,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, hostIds));

  const enriched = pageResults.map((prop: any) => {
    const propImages = images.filter((img: any) => img.propertyId === prop.id);
    const propAmenities = amenities.filter((a: any) => a.propertyId === prop.id);
    const host = hosts.find((h: any) => h.id === prop.hostId);

    return {
      ...enrichProperty(prop, propImages, propAmenities, host),
      distanceKm: prop.distanceKm,
      isReserved: prop.isReserved ?? false,
    };
  });

  return {
    query: {
      location: locationQuery,
      resolvedLocation: resolvedLocation || null,
      coordinates: targetLat && targetLng ? { lat: targetLat, lng: targetLng } : null,
      checkIn,
      checkOut,
      guests,
      totalResults,
    },
    properties: enriched,
    pagination: {
      page,
      limit,
      total: totalResults,
      totalPages: Math.ceil(totalResults / limit),
      hasNext: page * limit < totalResults,
      hasPrev: page > 1,
    },
  };
}
