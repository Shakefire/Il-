import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { removeFavourite } from "@/../backend/src/modules/favourites/favourites.service";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { propertyId: string } | Promise<{ propertyId: string }> }
) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { propertyId } = await Promise.resolve(params);
  try {
    const result = await removeFavourite(session.userId, propertyId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
