import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { createReview } from "@/../backend/src/modules/reviews/reviews.routes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const result = await createReview(session.userId, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, review: result.review }, { status: 201 });
}
