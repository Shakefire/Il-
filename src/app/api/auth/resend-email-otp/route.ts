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
    const result = await authService.resendEmailOtp(session.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to resend email code" }, { status: 400 });
  }
}
