import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { getPropertyBySlug } from "@/../backend/src/modules/properties/properties.service"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } | Promise<{ slug: string }> }
) {
  const { slug } = await Promise.resolve(params)

  if (!slug) {
    return NextResponse.json({ error: "Property identifier is required" }, { status: 400 })
  }

  const session = authenticateNextRequest(req)
  let allowUnpublished = false

  if (session && (session.role === "admin" || session.role === "host")) {
    allowUnpublished = true
  }

  try {
    const dbProperty = await getPropertyBySlug(slug, allowUnpublished)
    if (dbProperty) {
      return NextResponse.json({ property: dbProperty })
    }
  } catch (err: any) {
    console.warn("[API] DB query failed in getPropertyBySlug:", err?.message || err)
    return NextResponse.json(
      { error: "Unable to load this stay right now." },
      { status: 503 }
    )
  }

  return NextResponse.json(
    { error: "Property not found or not published" },
    { status: 404 }
  )
}
