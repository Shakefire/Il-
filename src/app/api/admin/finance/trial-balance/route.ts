import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { LedgerService } from "@/../backend/src/modules/finance/ledger.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const trialBalance = await LedgerService.getTrialBalance();
    return NextResponse.json({ success: true, trialBalance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load trial balance" }, { status: 500 });
  }
}
