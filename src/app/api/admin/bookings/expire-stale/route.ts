import { NextRequest, NextResponse } from "next/server";
import { expireStalePendingBookings } from "@/../backend/src/modules/payments/payments.service";

export const dynamic = "force-dynamic";

// POST /api/admin/bookings/expire-stale — expire stale PAYMENT_PENDING bookings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const maxAgeMinutes = body.maxAgeMinutes || 30;

    const result = await expireStalePendingBookings(maxAgeMinutes);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
