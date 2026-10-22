import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { bookingsService } from "@/../backend/src/modules/bookings/bookings.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Authentication required to view account bookings" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const queryObj: Record<string, any> = {};
  searchParams.forEach((val, key) => {
    queryObj[key] = val;
  });

  try {
    const result = await bookingsService.getUserBookings(session.userId, queryObj);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load bookings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);

  try {
    const body = await req.json();
    const result = await bookingsService.createBooking(body, session || undefined);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create booking" },
      { status: err.statusCode || 400 }
    );
  }
}
