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
  if (!session) {
    return NextResponse.json({ error: "Sign in to view stay details." }, { status: 401 });
  }

  try {
    const contact = await bookingsService.getBookingContact(id, session.userId);
    return NextResponse.json(contact);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load stay details" },
      { status: err.statusCode || 400 }
    );
  }
}
