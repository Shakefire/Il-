import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { inboxService } from "@/../backend/src/modules/notifications/inbox.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  await inboxService.markAllRead(session.userId);
  return NextResponse.json({ success: true });
}
