import { NextRequest, NextResponse } from "next/server";
import { expireStalePendingBookings } from "@/../backend/src/modules/payments/payments.service";
import { verifySessionToken } from "@/../backend/src/lib/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/bookings/expire-stale
 * Secured: admin session cookie/Bearer OR x-cron-secret matching CRON_SECRET.
 * Expires PENDING_HOST / PAYMENT_PENDING past absolute deadlines.
 */
export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;
    const headerSecret =
      req.headers.get("x-cron-secret") ||
      req.headers.get("x-internal-job-secret");

    let authorized = false;
    if (cronSecret && headerSecret && headerSecret === cronSecret) {
      authorized = true;
    }

    if (!authorized) {
      const auth = req.headers.get("authorization");
      const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      const cookieToken = req.cookies.get("ile_session")?.value || null;
      const token = bearer || cookieToken;
      const session = token ? verifySessionToken(token) : null;
      if (session?.role === "admin") {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized: admin session or CRON_SECRET required." },
        { status: 401 }
      );
    }

    const result = await expireStalePendingBookings();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
