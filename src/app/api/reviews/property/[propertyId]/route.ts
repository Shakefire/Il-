import { NextRequest, NextResponse } from "next/server";
import { getPropertyReviews } from "@/../backend/src/modules/reviews/reviews.routes";
import { parsePagination } from "@/../backend/src/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { propertyId: string } | Promise<{ propertyId: string }> }
) {
  const { propertyId } = await Promise.resolve(params);
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await getPropertyReviews(propertyId, parsePagination(query));
  return NextResponse.json({ reviews: result.data, pagination: result.pagination });
}
