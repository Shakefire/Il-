import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { newsletterService } from "@/../backend/src/modules/newsletter/newsletter.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const subscribers = await newsletterService.getSubscribers(page, limit);
    return NextResponse.json({ success: true, subscribers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load subscribers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
