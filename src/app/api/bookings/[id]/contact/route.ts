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

  // Determine authorized identity: token or session user ID/role
  const authIdentifier = token || session?.userId || (session?.role === "admin" ? "admin" : undefined);

  if (!authIdentifier) {
    return NextResponse.json(
      { error: "Unauthorized access: valid session or access token required to view property arrival guide." },
      { status: 401 }
    );
  }

  try {
    const contact = await bookingsService.getBookingContact(id, authIdentifier);
    return NextResponse.json(contact);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load property arrival and contact details" },
      { status: err.statusCode || 400 }
    );
  }
}
