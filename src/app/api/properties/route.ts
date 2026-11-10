import { NextRequest, NextResponse } from "next/server"
import { getPublishedProperties } from "@/../backend/src/modules/properties/properties.service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100)
  const page = Math.max(Number(searchParams.get("page")) || 1, 1)
  const offset = Number(searchParams.get("offset")) || (page - 1) * limit

  try {
    const result = await getPublishedProperties({ limit, offset })
    return NextResponse.json({
      properties: result.properties,
      total: result.total,
      page,
      limit,
    })
  } catch (err: any) {
    console.error("[API] Failed to load published properties:", err)
    return NextResponse.json(
      {
        properties: [],
        total: 0,
        page,
        limit,
        error: "Unable to load stays right now.",
      },
      { status: 503 }
    )
  }
}
