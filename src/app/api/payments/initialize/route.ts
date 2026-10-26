import { NextRequest, NextResponse } from "next/server";
import { initializeBookingPayment } from "@/../backend/src/modules/payments/payments.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const targetRef = body?.bookingId || body?.referenceCode;
    const accessToken = body?.accessToken || req.headers.get("x-booking-access-token") || undefined;
    if (!targetRef) {
      return NextResponse.json(
        { error: "Missing booking identifier (bookingId or referenceCode)." },
        { status: 400 }
      );
    }

    const result = await initializeBookingPayment(targetRef, accessToken);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Payment initialization failed." },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API] Payment initialize error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to initialize payment." },
      { status: 500 }
    );
  }
}
