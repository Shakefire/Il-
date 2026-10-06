import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { authService } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code } = body || {};

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json(
        { error: "Please provide a valid 6-digit verification code." },
        { status: 400 }
      );
    }

    const result = await authService.verifyEmailOtp(session.userId, code.trim());
    return NextResponse.json({
      success: true,
      message: "Email successfully verified. You can now proceed with your owner profile.",
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify email" }, { status: 400 });
  }
}
