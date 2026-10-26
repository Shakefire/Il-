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
      if (result.status === "failed") {
        // Terminal failure from payment provider — cancel booking and release dates
        try {
          await processFailedPayment({
            reference,
            reason: result.error || "Payment was declined by financial institution.",
          });
        } catch (cancelErr) {
          console.warn("[API] Failed to cancel booking after declined payment:", cancelErr);
        }
        return NextResponse.json(
          { verified: false, status: "failed", error: result.error || "Payment was declined." },
          { status: 400 }
        );
      }

      // Transient status (pending, ongoing, abandoned, or network timeout)
      // Do NOT release availability blocks prematurely; preserve blocks while pending.
      return NextResponse.json(
        {
          verified: false,
          status: result.status || "pending",
          pending: true,
          error: result.error || "Payment verification is pending or incomplete.",
        },
        { status: 200 }
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
