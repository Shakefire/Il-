import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/host/payout-account
 * Securely retrieve saved host payout account (account number masked).
 * Canonical logic: hostsService.getPayoutAccount (shared with Fastify).
 */
export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await hostsService.getPayoutAccount(session.userId);
    return NextResponse.json(result);
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
 * Set or replace host payout account via Paystack resolve.
 * Canonical logic: hostsService.updatePayoutAccount (shared with Fastify).
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
    const result = await hostsService.updatePayoutAccount(
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
