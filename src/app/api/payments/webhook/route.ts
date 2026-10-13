import { NextRequest, NextResponse } from "next/server";
import { handlePaystackWebhook } from "@/../backend/src/modules/payments/payments.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature header." }, { status: 400 });
  }

  try {
    const rawBody = await req.text();
    const res = await handlePaystackWebhook(rawBody, signature);
    return NextResponse.json({ received: true, message: res.message });
  } catch (err: any) {
    console.error("[Paystack Webhook API] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Webhook processing error." },
      { status: 400 }
    );
  }
}
