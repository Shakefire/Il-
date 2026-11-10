import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/serverAuth"
import { FinanceService } from "@/../backend/src/modules/finance/finance.service"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/finance/settlements/:bookingId/override
 * Admin exception — skips guest check-in only; still blocks refunds; ledger once.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  const session = requireAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const result = await FinanceService.adminOverrideSettlement(session.userId, {
      bookingId: params.bookingId,
      reason: body.reason || "",
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Override failed" },
      { status: 400 }
    )
  }
}
