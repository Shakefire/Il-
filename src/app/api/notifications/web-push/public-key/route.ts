import { NextResponse } from "next/server";
import { getWebPushPublicKey } from "@/../backend/src/modules/notifications/web-push.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = getWebPushPublicKey();
  return NextResponse.json({
    success: true,
    publicKey: key,
    configured: !!key,
  });
}
