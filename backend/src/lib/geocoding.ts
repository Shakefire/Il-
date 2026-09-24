/**
 * OpenStreetMap Nominatim Geocoding Resolver with Local Nigerian Landmark Caching
 * Resolves arbitrary place names (e.g. "Abuja", "Maitama", "Wuse 2", "Jabi Lake", "Nicon Luxury")
 * into geographic coordinates without depending on proprietary Google Maps APIs.
 */

import { env } from "../config/env";
import { COORDINATE_OFFSET_RANGE } from "../config/constants";

export interface GeocodedLocation {
  displayName: string;
  city: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  boundingRadiusKm: number;
}

// Built-in high-precision coordinates for popular Nigerian landmarks & neighborhoods
const NIGERIAN_LANDMARK_REGISTRY: Record<string, GeocodedLocation> = {
  // ─── Abuja Core & Neighborhoods ───
  abuja: {
    displayName: "Abuja, Federal Capital Territory, Nigeria",
    city: "Abuja",
    neighborhood: "Central Area",
    latitude: 9.0765,
    longitude: 7.3986,
    boundingRadiusKm: 25,
  },
  maitama: {
    displayName: "Maitama District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Maitama",
    latitude: 9.0882,
    longitude: 7.4981,
    boundingRadiusKm: 8,
  },
  "wuse 2": {
    displayName: "Wuse 2, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Wuse 2",
    latitude: 9.0747,
    longitude: 7.4735,
    boundingRadiusKm: 6,
  },
  wuse: {
    displayName: "Wuse District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Wuse",
    latitude: 9.068,
    longitude: 7.465,
    boundingRadiusKm: 8,
  },
  asokoro: {
    displayName: "Asokoro District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Asokoro",
    latitude: 9.0435,
    longitude: 7.5255,
    boundingRadiusKm: 8,
  },
  guzape: {
    displayName: "Guzape Hills, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Guzape",
    latitude: 9.0289,
    longitude: 7.5142,
    boundingRadiusKm: 8,
  },
  jabi: {
    displayName: "Jabi District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Jabi",
    latitude: 9.0694,
    longitude: 7.4258,
    boundingRadiusKm: 7,
  },
  "jabi lake": {
    displayName: "Jabi Lake & Waterfront, Jabi, Abuja",
    city: "Abuja",
    neighborhood: "Jabi",
    latitude: 9.0722,
    longitude: 7.428,
    boundingRadiusKm: 5,
  },
  "nicon luxury": {
    displayName: "Nicon Luxury Area, Area 11, Garki, Abuja",
    city: "Abuja",
    neighborhood: "Garki Area 11",
    latitude: 9.0468,
    longitude: 7.4932,
    boundingRadiusKm: 6,
  },
  garki: {
    displayName: "Garki District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Garki",
    latitude: 9.0345,
    longitude: 7.4891,
    boundingRadiusKm: 8,
  },
  utako: {
    displayName: "Utako District, Abuja, FCT",
    city: "Abuja",
    neighborhood: "Utako",
    latitude: 9.062,
    longitude: 7.443,
    boundingRadiusKm: 6,
  },

  // ─── Lagos Core & Prime Neighborhoods ───
  lagos: {
    displayName: "Lagos, Lagos State, Nigeria",
    city: "Lagos",
    neighborhood: "Lagos Island / Mainland",
    latitude: 6.5244,
    longitude: 3.3792,
    boundingRadiusKm: 35,
  },
  ikoyi: {
    displayName: "Old Ikoyi, Lagos State",
    city: "Lagos",
    neighborhood: "Old Ikoyi",
    latitude: 6.4521,
    longitude: 3.4382,
    boundingRadiusKm: 7,
  },
  "banana island": {
    displayName: "Banana Island, Ikoyi, Lagos",
    city: "Lagos",
    neighborhood: "Banana Island",
    latitude: 6.4633,
    longitude: 3.4518,
    boundingRadiusKm: 5,
  },
  "victoria island": {
    displayName: "Victoria Island (VI), Lagos State",
    city: "Lagos",
    neighborhood: "Victoria Island",
    latitude: 6.4281,
    longitude: 3.4219,
    boundingRadiusKm: 8,
  },
  vi: {
    displayName: "Victoria Island (VI), Lagos State",
    city: "Lagos",
    neighborhood: "Victoria Island",
    latitude: 6.4281,
    longitude: 3.4219,
    boundingRadiusKm: 8,
  },
  lekki: {
    displayName: "Lekki Peninsula, Lagos State",
    city: "Lagos",
    neighborhood: "Lekki",
    latitude: 6.4474,
    longitude: 3.4839,
    boundingRadiusKm: 15,
  },
  "lekki phase 1": {
    displayName: "Lekki Phase 1, Lagos State",
    city: "Lagos",
    neighborhood: "Lekki Phase 1",
    latitude: 6.4474,
    longitude: 3.4839,
    boundingRadiusKm: 7,
  },
  "eko atlantic": {
    displayName: "Eko Atlantic City, Victoria Island, Lagos",
    city: "Lagos",
    neighborhood: "Eko Atlantic",
    latitude: 6.4158,
    longitude: 3.4097,
    boundingRadiusKm: 6,
  },
  "ikeja gra": {
    displayName: "Ikeja GRA, Lagos State",
    city: "Lagos",
    neighborhood: "Ikeja GRA",
    latitude: 6.5922,
    longitude: 3.3551,
    boundingRadiusKm: 8,
  },
};

/**
 * Calculates Great-Circle distance in kilometers between two lat/lng coordinates (Haversine Formula)
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Apply random offset to coordinates for location privacy.
 * Shifts lat/lng by ±COORDINATE_OFFSET_RANGE (≈300m).
 */
export function offsetCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  const offsetLat = (Math.random() - 0.5) * 2 * COORDINATE_OFFSET_RANGE;
  const offsetLng = (Math.random() - 0.5) * 2 * COORDINATE_OFFSET_RANGE;
  return {
    lat: Math.round((lat + offsetLat) * 10000) / 10000,
    lng: Math.round((lng + offsetLng) * 10000) / 10000,
  };
}

/**
 * Resolves an arbitrary location query into coordinates using the Nigerian landmark registry
 * with OpenStreetMap / Nominatim fallback.
 */
export async function resolveLocation(query: string): Promise<GeocodedLocation | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized || normalized === "all nigeria") {
    return null;
  }

  // 1. Direct landmark / neighborhood match
  if (NIGERIAN_LANDMARK_REGISTRY[normalized]) {
    return NIGERIAN_LANDMARK_REGISTRY[normalized];
  }

  // 2. Partial search in registered landmarks
  for (const [key, loc] of Object.entries(NIGERIAN_LANDMARK_REGISTRY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return loc;
    }
  }

  // 3. Nominatim geocoder fallback
  try {
    const encoded = encodeURIComponent(`${query}, Nigeria`);
    const baseUrl = env.GEOCODING_API_URL;
    const res = await fetch(
      `${baseUrl}/search?q=${encoded}&countrycodes=ng&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "IleAccommodationMarketplace/1.0 (contact@ile.ng)",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const isAbuja = item.display_name.toLowerCase().includes("abuja");
        const isLagos = item.display_name.toLowerCase().includes("lagos");

        return {
          displayName: item.display_name,
          city: isAbuja ? "Abuja" : isLagos ? "Lagos" : query,
          neighborhood: query,
          latitude: lat,
          longitude: lng,
          boundingRadiusKm: 15,
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim geocoding network error, falling back to general area:", err);
  }

  // Default fallback
  if (normalized.includes("abuja") || normalized.includes("fct")) {
    return NIGERIAN_LANDMARK_REGISTRY["abuja"];
  }
  if (normalized.includes("lagos") || normalized.includes("ikoyi") || normalized.includes("lekki")) {
    return NIGERIAN_LANDMARK_REGISTRY["lagos"];
  }

  return null;
}
