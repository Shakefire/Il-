import { NextResponse } from "next/server";
import { BankResolutionService } from "@/../backend/src/modules/payments/bank-resolution.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/banks
 * Fetch official list of supported Nigerian banks with caching and safe fallback.
 */
export async function GET() {
  try {
    const banks = await BankResolutionService.getNigerianBanks();
    return NextResponse.json({ banks });
  } catch (err: any) {
    console.error("[API] Failed to get banks:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve Nigerian banks" },
      { status: 500 }
    );
  }
}
