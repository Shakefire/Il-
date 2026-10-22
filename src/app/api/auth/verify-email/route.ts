import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { authService } from "@/../backend/src/modules/auth/auth.service";
import { createSessionToken } from "@/../backend/src/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const { code, email } = body || {};

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json(
        { error: "Please provide a valid 6-digit verification code." },
        { status: 400 }
      );
    }

    const targetEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;
    const targetUserId = session?.userId;

    if (!targetEmail && !targetUserId) {
      return NextResponse.json(
        { error: "Please provide the email address associated with your account or sign in to verify." },
        { status: 400 }
      );
    }

    const { user, profile } = await authService.verifyEmailOtp(
      { email: targetEmail, userId: targetUserId },
      code.trim()
    );

    // CRITICAL SECURITY FIX: Establish authentic session token ONLY upon successful verification
    const token = createSessionToken(user.id, user.email, user.role, true);

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        status: user.status,
      },
      profile,
      message: "Email successfully verified. You can now proceed with your owner profile.",
    });

    response.cookies.set("session_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify email" }, { status: 400 });
  }
}
