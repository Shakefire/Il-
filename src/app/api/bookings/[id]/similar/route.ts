import { NextRequest, NextResponse } from "next/server"
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service"

/**
 * GET /api/bookings/:id/similar
 * Similar published stays preserving destination/dates/guests.
 * Never auto-books or charges.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit")
    const result = await bookingsService.findSimilarProperties(
      params.id,
      limitParam ? Number(limitParam) : 8
    )
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load similar properties" },
      { status: error.statusCode || 404 }
    )
  }
}
