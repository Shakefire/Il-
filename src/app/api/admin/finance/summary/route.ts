import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const summary = await FinanceService.getFinancialSummary();
    return NextResponse.json({ success: true, ...summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load financial summary" }, { status: 500 });
  }
}
