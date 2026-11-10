import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { FinanceService } from "@/../backend/src/modules/finance/finance.service"

export const dynamic = "force-dynamic"

/** POST /api/host/wallet/withdraw — Atomic reserve + Paystack transfer */
export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const result = await FinanceService.requestHostWithdrawal(session.userId, {
      amountNaira: body.amountNaira,
      payoutIds: body.payoutIds,
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Withdrawal failed", code: err.code },
      { status: err.statusCode || 400 }
    )
  }
}
