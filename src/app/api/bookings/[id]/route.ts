import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service";

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
    const booking = result.booking;

    // Check authorization: Must be the guest, the property host, an admin, match accessToken, or match guest email
    const isGuest = session && booking.guestId && session.userId === booking.guestId;
    const isHost = session && result.property && session.userId === result.property.hostId;
    const isAdmin = session && session.role === "admin";
    const isTokenValid = Boolean(token && booking.accessToken && token === booking.accessToken);
    const isEmailValid = Boolean(
      guestEmailParam &&
      booking.guestEmail &&
      guestEmailParam.toLowerCase().trim() === booking.guestEmail.toLowerCase().trim()
    );

    if (!isGuest && !isHost && !isAdmin && !isTokenValid && !isEmailValid) {
      return NextResponse.json(
        { error: "Unauthorized access to booking details. Please log in or provide a valid access token." },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Booking not found" },
      { status: err.statusCode || 404 }
    );
  }
}
