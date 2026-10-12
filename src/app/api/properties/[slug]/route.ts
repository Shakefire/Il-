import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { getPropertyBySlug } from "@/../backend/src/modules/properties/properties.service";
import { PROPERTIES } from "@/data/properties";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } | Promise<{ slug: string }> }
) {
  const { slug } = await Promise.resolve(params);

  if (!slug) {
    return NextResponse.json({ error: "Property identifier is required" }, { status: 400 });
  }

  // Check auth session for elevated permissions
  const session = authenticateNextRequest(req);
  let allowUnpublished = false;

  if (session && (session.role === "admin" || session.role === "host")) {
    allowUnpublished = true;
  }

  try {
    // 1. Check live database first
    const dbProperty = await getPropertyBySlug(slug, allowUnpublished);
    if (dbProperty) {
      return NextResponse.json({ property: dbProperty });
    }

    // 2. Check static curated mock properties as graceful fallback
    const staticProperty = PROPERTIES.find(
      (p) => p.slug === slug || p.id === slug
    );

    if (staticProperty) {
      return NextResponse.json({ property: staticProperty });
    }

    return NextResponse.json(
      { error: "Property not found or not published" },
      { status: 404 }
    );
  } catch (err: any) {
    console.error("[API] Failed to fetch property by slug:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load property details" },
      { status: 500 }
    );
  }
}
