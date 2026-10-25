import { NextRequest, NextResponse } from "next/server";
import { env } from "@/../backend/src/config/env";

export const dynamic = "force-dynamic";

// GET /api/banks — list Nigerian banks from Paystack
export async function GET() {
  try {
    if (!env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Payment gateway not configured." }, { status: 503 });
    }

    const res = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=100", {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });

    const body = await res.json();
    if (!res.ok || !body.status) {
      return NextResponse.json({ error: body.message || "Failed to fetch banks." }, { status: 502 });
    }

    // Return simplified bank list
    const banks = (body.data || []).map((b: any) => ({
      name: b.name,
      code: b.code,
      type: b.type,
      slug: b.slug,
    }));

    return NextResponse.json({ banks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
