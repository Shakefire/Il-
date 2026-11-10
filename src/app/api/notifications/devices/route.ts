import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { deviceTokensService } from "@/../backend/src/modules/notifications/device-tokens.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body?.token || !body?.platform) {
      return NextResponse.json(
        { error: "token and platform are required" },
        { status: 400 }
      );
    }
    const device = await deviceTokensService.register({
      userId: session.userId,
      token: String(body.token),
      platform: body.platform,
      provider: body.provider,
      appVersion: body.appVersion,
      userAgent: req.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ success: true, device }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to register device" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body?.token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }
    await deviceTokensService.revoke(session.userId, String(body.token));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to revoke device" },
      { status: 400 }
    );
  }
}
