import { NextRequest, NextResponse } from "next/server";
import { BankResolutionService } from "@/../backend/src/modules/payments/bank-resolution.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/banks/resolve?account_number=0001234567&bank_code=058
 * Backwards-compatible NUBAN inquiry endpoint delegating to BankResolutionService.
 */
export async function GET(req: NextRequest) {
  try {
    const accountNumber = req.nextUrl.searchParams.get("account_number") || req.nextUrl.searchParams.get("accountNumber");
    const bankCode = req.nextUrl.searchParams.get("bank_code") || req.nextUrl.searchParams.get("bankCode");

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { resolved: false, error: "Both account_number and bank_code are required." },
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
    console.error("[API /api/banks/resolve] Error:", err.message);
    return NextResponse.json(
      { resolved: false, error: err.message || "Failed to resolve account." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ resolved: false, error: "Invalid request body." }, { status: 400 });
    }

    const accountNumber = body.accountNumber || body.account_number;
    const bankCode = body.bankCode || body.bank_code;

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
    return NextResponse.json(
      { resolved: false, error: err.message || "Failed to resolve account." },
      { status: 500 }
    );
  }
}
