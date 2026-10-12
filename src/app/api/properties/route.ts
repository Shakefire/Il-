import { NextRequest, NextResponse } from "next/server";
import { getPublishedProperties } from "@/../backend/src/modules/properties/properties.service";
import { PROPERTIES } from "@/data/properties";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const offset = Number(searchParams.get("offset")) || (page - 1) * limit;

  try {
    const result = await getPublishedProperties({ limit, offset });

    if (result.properties.length > 0) {
      return NextResponse.json({
        properties: result.properties,
        total: result.total,
        page,
        limit,
      });
    }

    // Graceful fallback to static curated properties if database is empty
    return NextResponse.json({
      properties: PROPERTIES.slice(offset, offset + limit),
      total: PROPERTIES.length,
      page,
      limit,
    });
  } catch (err: any) {
    console.error("[API] Failed to load published properties:", err);
    // Return static properties as high-availability fallback
    return NextResponse.json({
      properties: PROPERTIES.slice(offset, offset + limit),
      total: PROPERTIES.length,
      page,
      limit,
    });
  }
}
