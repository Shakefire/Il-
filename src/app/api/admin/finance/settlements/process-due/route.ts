import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const result = await FinanceService.processDueSettlements();
    return NextResponse.json({
      success: true,
      message: `Successfully processed ${result.processedCount} due check-in settlements.`,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process due settlements" },
      { status: 500 }
    );
  }
}
