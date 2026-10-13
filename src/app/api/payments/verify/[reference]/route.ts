import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/../backend/src/modules/payments/payments.service";

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
