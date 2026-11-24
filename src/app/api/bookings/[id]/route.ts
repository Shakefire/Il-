import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { authorizeBookingView, bookingsService } from "@/../backend/src/modules/bookings/bookings.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params);
  if (!id) {
    return NextResponse.json({ error: "Booking identifier is required" }, { status: 400 });
  }

  const session = authenticateNextRequest(req);
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || req.headers.get("x-access-token");
  const guestEmailParam = searchParams.get("email");

  try {
    const result = await bookingsService.getBooking(id);
    const safe = authorizeBookingView(result, {
      userId: session?.userId || null,
      role: session?.role || null,
      accessToken: token,
      email: guestEmailParam,
    });
    return NextResponse.json(safe);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Booking not found" },
      { status: err.statusCode || 404 }
    );
  }
}
