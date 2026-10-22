import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service";

export const dynamic = "force-dynamic";

export async function POST(
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
  const authIdentifier = token || session?.userId || (session?.role === "admin" ? "admin" : undefined);

  if (!authIdentifier) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await bookingsService.cancelBooking(id, authIdentifier, body.reason);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel booking" },
      { status: err.statusCode || 400 }
    );
  }
}
