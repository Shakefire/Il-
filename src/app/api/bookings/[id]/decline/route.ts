import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service"

export const dynamic = "force-dynamic"

/**
 * POST /api/bookings/:id/decline — Host decline → CANCELLED
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let reason: string | undefined
  try {
    const body = await req.json()
    reason = typeof body?.reason === "string" ? body.reason : undefined
  } catch {
    reason = undefined
  }

  try {
    const result = await bookingsService.declineBooking(
      params.id,
      session.userId,
      reason
    )
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to decline booking", code: err.code },
      { status: err.statusCode || 400 }
    )
  }
}
