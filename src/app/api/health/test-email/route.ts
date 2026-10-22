import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { sendEmail, emailOtpEmail } from "@/../backend/src/modules/notifications/notifications.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = (body?.to || "").trim() || "shakefire@protonmail.com";

    const payload = emailOtpEmail({
      name: "Ilé Administrator",
      email: to,
      code: Math.floor(100000 + Math.random() * 900000).toString(),
      purpose: "administrative system verification",
    });

    const success = await sendEmail(payload);

    return NextResponse.json({
      success,
      message: `Test email dispatched to ${to}`,
      provider: process.env.EMAIL_PROVIDER || "resend",
    });
  } catch (err: any) {
    console.error("[Test Email] Dispatch error:", err);
    return NextResponse.json({ error: err.message || "Failed to dispatch test email" }, { status: 500 });
  }
}
