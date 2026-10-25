import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { getDb, schema } from "@/../backend/src/db/client";
import { eq } from "drizzle-orm";
import { BankResolutionService, maskAccountNumber } from "@/../backend/src/modules/payments/bank-resolution.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/host/payout-account
 * Securely retrieve saved host payout account (account number masked).
 */
export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const [profile] = await db
      .select({
        bankName: schema.profiles.bankName,
        bankCode: schema.profiles.bankCode,
        bankAccountNumber: schema.profiles.bankAccountNumber,
        bankAccountName: schema.profiles.bankAccountName,
        bankAccountVerifiedAt: schema.profiles.bankAccountVerifiedAt,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, session.userId))
      .limit(1);

    if (!profile || !profile.bankAccountNumber) {
      return NextResponse.json({
        hasAccount: false,
        account: null,
      });
    }

    return NextResponse.json({
      hasAccount: true,
      account: {
        bankName: profile.bankName,
        bankCode: profile.bankCode,
        accountNumberMasked: maskAccountNumber(profile.bankAccountNumber),
        accountName: profile.bankAccountName,
        verifiedAt: profile.bankAccountVerifiedAt,
      },
    });
  } catch (err: any) {
    console.error("[API /api/host/payout-account GET] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve payout account." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/host/payout-account
 * Set or replace host payout account. Must be authoritatively resolved with Paystack.
 * Payload: { bankCode: string, accountNumber: string }
 */
export async function PUT(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.bankCode || !body.accountNumber) {
      return NextResponse.json(
        { error: "Both bankCode and accountNumber are required." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";

    const result = await BankResolutionService.updateHostPayoutAccount(
      session.userId,
      {
        bankCode: String(body.bankCode).trim(),
        accountNumber: String(body.accountNumber).trim(),
      },
      ip
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API /api/host/payout-account PUT] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to update payout account." },
      { status: 400 }
    );
  }
}
