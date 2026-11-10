import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/serverAuth"
import { FinanceService } from "@/../backend/src/modules/finance/finance.service"

export const dynamic = "force-dynamic"

/** GET /api/admin/finance/ops — Plain-language finance ops overview */
export async function GET(req: NextRequest) {
  const session = requireAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const result = await FinanceService.getAdminFinanceOpsOverview({
      status: searchParams.get("status") || undefined,
      hostId: searchParams.get("hostId") || undefined,
      bookingId: searchParams.get("bookingId") || undefined,
      transferRef: searchParams.get("transferRef") || undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : 100,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load finance ops" },
      { status: 500 }
    )
  }
}
