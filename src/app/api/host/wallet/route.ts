import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { FinanceService } from "@/../backend/src/modules/finance/finance.service"

export const dynamic = "force-dynamic"

/** GET /api/host/wallet — Host wallet projection from payouts */
export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const wallet = await FinanceService.getHostWallet(session.userId)
    return NextResponse.json({ success: true, wallet })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load wallet" },
      { status: 500 }
    )
  }
}
