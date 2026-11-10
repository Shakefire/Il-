import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service"

export const dynamic = "force-dynamic"

/**
 * POST /api/bookings/:id/accept — Host accept → PAYMENT_PENDING
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await bookingsService.acceptBooking(params.id, session.userId)
    return NextResponse.json({
      success: true,
      booking: result.booking,
      paymentDeadlineAt: result.paymentDeadlineAt,
      idempotent: result.idempotent,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to accept booking", code: err.code },
      { status: err.statusCode || 400 }
    )
  }
}
