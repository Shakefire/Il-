import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    await authService.requestPasswordReset(email.trim());
    return NextResponse.json({
      success: true,
      message: `If an account exists for ${email.trim()}, a password reset link has been dispatched.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process request." }, { status: 400 });
  }
}
