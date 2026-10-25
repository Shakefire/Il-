import { NextRequest, NextResponse } from "next/server";
import { verifyPayment, processFailedPayment } from "@/../backend/src/modules/payments/payments.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { reference: string } }
) {
  const reference = params.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing transaction reference." }, { status: 400 });
  }

  try {
    const result = await verifyPayment(reference);
    if (!result.verified) {
      // Payment not successful on Paystack — cancel booking and release dates
      try {
        await processFailedPayment({
          reference,
          reason: result.error || "Payment was not completed on Paystack.",
        });
      } catch (cancelErr) {
        console.warn("[API] Failed to cancel booking after unverified payment:", cancelErr);
      }
      return NextResponse.json(
        { verified: false, error: result.error || "Payment could not be verified." },
        { status: 400 }
      );
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API] Payment verify error:", err);
    return NextResponse.json(
      { error: err.message || "Payment verification failed." },
      { status: 500 }
    );
  }
}
