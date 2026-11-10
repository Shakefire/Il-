import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { inboxService } from "@/../backend/src/modules/notifications/inbox.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const result = await inboxService.listForUser(session.userId, {
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 30,
    unreadOnly:
      searchParams.get("unreadOnly") === "true" ||
      searchParams.get("unreadOnly") === "1",
  });

  return NextResponse.json({
    success: true,
    notifications: result.items,
    unreadCount: result.unreadCount,
  });
}
