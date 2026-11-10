import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/serverAuth"
import { FinanceService } from "@/../backend/src/modules/finance/finance.service"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = requireAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 })
  }

  const { id } = await Promise.resolve(params)
  try {
    const body = await req.json().catch(() => ({}))
    const result = await FinanceService.rejectPayout(session.userId, id, body?.reason || "")
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
