import { eq } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { env } from "../../config/env";
import crypto from "crypto";

export interface NormalizedLocation {
  displayName: string;
  name: string;
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
}

export const locationsService = {
  /**
   * Search for locations using the geocoding provider with database caching
   */
  async search(rawQuery: string): Promise<NormalizedLocation[]> {
    const query = rawQuery.trim();
    if (!query || query.length < 2) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const db = getDb();

    // 1. Check database cache
    try {
      const [cached] = await db
        .select()
        .from(schema.locationSearchCache)
        .where(eq(schema.locationSearchCache.query, normalizedQuery))
        .limit(1);

      if (cached && cached.results) {
        const parsed = JSON.parse(cached.results);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("[Locations] Cache lookup error:", err);
    }

    // 2. Call external geocoding provider (Nominatim / OSM)
    try {
      const baseUrl = env.GEOCODING_API_URL.replace(/\/+$/, "");
      // Append Nigeria if not already specified to prioritize local Nigerian places
      const searchQuery = normalizedQuery.includes("nigeria")
        ? query
        : `${query}, Nigeria`;

      const url = `${baseUrl}/search?q=${encodeURIComponent(
        searchQuery
      )}&countrycodes=ng&format=jsonv2&addressdetails=1&limit=6`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const res = await fetch(url, {
        headers: {
          "User-Agent": "IleAccommodationMarketplace/1.0 (contact@ile.ng)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Geocoding provider returned status ${res.status}`);
      }

      const items = await res.json();

      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }

      // 3. Normalize results
      const results: NormalizedLocation[] = items.map((item: any) => {
        const addr = item.address || {};
        const lowerDisplay = (item.display_name || "").toLowerCase();

        // City detection
        let city =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.county ||
          "";

        if (!city) {
          if (lowerDisplay.includes("abuja")) city = "Abuja";
          else if (lowerDisplay.includes("lagos")) city = "Lagos";
          else if (lowerDisplay.includes("ibadan")) city = "Ibadan";
          else if (lowerDisplay.includes("port harcourt")) city = "Port Harcourt";
          else if (lowerDisplay.includes("kano")) city = "Kano";
        }

        // State detection
        let state = addr.state || "";
        if (!state) {
          if (lowerDisplay.includes("federal capital territory") || lowerDisplay.includes("fct")) {
            state = "Federal Capital Territory";
          } else if (lowerDisplay.includes("lagos state")) {
            state = "Lagos State";
          }
        }

        // Neighborhood / area
        const neighborhood =
          addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.residential ||
          addr.road ||
          city ||
          "";

        // Main display name
        const name =
          item.name ||
          addr.amenity ||
          addr.building ||
          addr.road ||
          addr.suburb ||
          query;

        return {
          displayName: item.display_name,
          name,
          city: city || state || "Nigeria",
          state: state || "Nigeria",
          country: addr.country || "Nigeria",
          neighborhood,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
      });

      // 4. Save to database cache
      try {
        await db
          .insert(schema.locationSearchCache)
          .values({
            id: `loc_${crypto.randomUUID()}`,
            query: normalizedQuery,
            results: JSON.stringify(results),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.locationSearchCache.query,
            set: {
              results: JSON.stringify(results),
              updatedAt: new Date(),
            },
          });
      } catch (cacheErr) {
        console.warn("[Locations] Failed to cache geocoding result:", cacheErr);
      }

      return results;
    } catch (err: any) {
      console.error("[Locations] Geocoding provider error:", err.message || err);
      throw new Error("We couldn't find that location right now. Please try again.");
    }
  },
};
