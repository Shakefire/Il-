import { NextRequest, NextResponse } from "next/server";
import { env } from "@/../backend/src/config/env";

export const dynamic = "force-dynamic";

// GET /api/banks/resolve?account_number=0001234567&bank_code=058
export async function GET(req: NextRequest) {
  try {
    const accountNumber = req.nextUrl.searchParams.get("account_number");
    const bankCode = req.nextUrl.searchParams.get("bank_code");

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: "Both account_number and bank_code are required." },
        { status: 400 }
      );
    }

    if (!env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Payment gateway not configured." }, { status: 503 });
    }

    const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });

    const body = await res.json();

    if (!res.ok || !body.status) {
      return NextResponse.json(
        { error: body.message || "Could not resolve account. Please verify your details.", resolved: false },
        { status: res.status === 422 ? 422 : 400 }
      );
    }

    return NextResponse.json({
      resolved: true,
      accountName: body.data.account_name,
      accountNumber: body.data.account_number,
      bankId: body.data.bank_id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, resolved: false }, { status: 500 });
  }
}
