import { NextRequest, NextResponse } from "next/server";
import { searchProperties } from "@/../backend/src/modules/search/search.service";
import { PROPERTIES } from "@/data/properties";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const params = {
    location: searchParams.get("location") || undefined,
    destination: searchParams.get("destination") || undefined,
    lat: searchParams.get("lat") || undefined,
    lng: searchParams.get("lng") || undefined,
    radius: searchParams.get("radius") || undefined,
    checkIn: searchParams.get("checkIn") || undefined,
    checkOut: searchParams.get("checkOut") || undefined,
    guests: searchParams.get("guests") || undefined,
    type: searchParams.get("type") || undefined,
    bedrooms: searchParams.get("bedrooms") || undefined,
    maxPrice: searchParams.get("maxPrice") || undefined,
    minPrice: searchParams.get("minPrice") || undefined,
    powerType: searchParams.get("powerType") || undefined,
    amenities: searchParams.get("amenities") || undefined,
    page: searchParams.get("page") || undefined,
    limit: searchParams.get("limit") || undefined,
  };

  try {
    const result = await searchProperties(params);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API] Search error:", err);

    // Fallback: simple filter over static PROPERTIES
    let filtered = [...PROPERTIES];
    if (params.location) {
      const loc = params.location.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.city.toLowerCase().includes(loc) ||
          p.neighborhood.toLowerCase().includes(loc) ||
          p.title.toLowerCase().includes(loc)
      );
    }
    if (params.guests) {
      const g = Number(params.guests);
      if (!isNaN(g)) filtered = filtered.filter((p) => p.maxGuests >= g);
    }

    return NextResponse.json({
      properties: filtered,
      total: filtered.length,
      page: 1,
      limit: filtered.length,
      searchCenter: null,
      radiusKm: null,
      datesRequested: Boolean(params.checkIn && params.checkOut),
    });
  }
}
