import { NextRequest, NextResponse } from "next/server";
import { BankResolutionService } from "@/../backend/src/modules/payments/bank-resolution.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/bank-accounts/resolve
 * Standardized NUBAN Name Inquiry endpoint.
 * Payload: { accountNumber: string, bankCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { resolved: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { resolved: false, error: "Both accountNumber and bankCode are required." },
        { status: 400 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";

    const result = await BankResolutionService.resolveBankAccount(
      String(accountNumber),
      String(bankCode),
      ip
    );

    if (!result.resolved) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API /api/bank-accounts/resolve] Error:", err.message);
    return NextResponse.json(
      { resolved: false, error: "An unexpected error occurred while resolving account." },
      { status: 500 }
    );
  }
}
