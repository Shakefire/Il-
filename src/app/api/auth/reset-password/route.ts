import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, password } = body || {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "A valid password reset token is required." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }

    await authService.resetPassword(token, password);
    return NextResponse.json({
      success: true,
      message: "Your password has been reset successfully. Please log in with your new credentials.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reset password." }, { status: 400 });
  }
}
