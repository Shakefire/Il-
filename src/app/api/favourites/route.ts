import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { addFavourite, listFavourites } from "@/../backend/src/modules/favourites/favourites.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const result = await listFavourites(session.userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.propertyId) return NextResponse.json({ error: "propertyId is required." }, { status: 400 });
  try {
    const result = await addFavourite(session.userId, body.propertyId);
    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
