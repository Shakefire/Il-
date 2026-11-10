import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service"

export const dynamic = "force-dynamic"

/**
 * POST /api/bookings/:id/confirm-check-in — Guest confirms arrival (Phase 7)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = authenticateNextRequest(req)
  const body = await req.json().catch(() => ({} as { accessToken?: string }))
  const headerToken = req.headers.get("x-access-token")
  const accessToken = body.accessToken || headerToken || undefined

  if (!session?.userId && !accessToken) {
    return NextResponse.json(
      { error: "Authentication or booking access token required." },
      { status: 401 }
    )
  }

  try {
    const result = await bookingsService.confirmGuestCheckIn(
      params.id,
      { userId: session?.userId || null, accessToken: accessToken || null },
      {
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      }
    )
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to confirm check-in", code: err.code },
      { status: err.statusCode || 400 }
    )
  }
}
