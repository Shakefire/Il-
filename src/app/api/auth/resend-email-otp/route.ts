import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { authService } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  let email: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.email && typeof body.email === "string" && body.email.trim()) {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    // optional body
  }

  const targetEmail = email;
  const targetUserId = session?.userId;

  if (!targetEmail && !targetUserId) {
    return NextResponse.json(
      { error: "Email address or active session is required to resend verification code." },
      { status: 400 }
    );
  }

  try {
    const result = await authService.resendEmailOtp({ email: targetEmail, userId: targetUserId });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to resend email code" }, { status: 400 });
  }
}
