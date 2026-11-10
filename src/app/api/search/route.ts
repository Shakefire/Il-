import { NextRequest, NextResponse } from "next/server"
import { searchProperties } from "@/../backend/src/modules/search/search.service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

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
  }

  try {
    const result = await searchProperties(params)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[API] Search error:", err)
    return NextResponse.json(
      {
        properties: [],
        total: 0,
        page: 1,
        limit: 0,
        searchCenter: null,
        radiusKm: null,
        datesRequested: Boolean(params.checkIn && params.checkOut),
        error: "Search is temporarily unavailable.",
      },
      { status: 503 }
    )
  }
}
