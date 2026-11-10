import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/serverAuth"
import { adminService } from "@/../backend/src/modules/admin/admin.service"

export const dynamic = "force-dynamic"

// GET /api/admin/settings — fetch platform settings (admin-only)
export async function GET(req: NextRequest) {
  const session = requireAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 })
  }

  try {
    const settings = await adminService.getSettings()
    return NextResponse.json(settings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PUT /api/admin/settings — update platform settings (admin-only, audited)
export async function PUT(req: NextRequest) {
  const session = requireAdminSession(req)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const commissionPct = body.defaultHostCommissionPct
    const payoutHoldHours = body.payoutHoldHours
    const hostPayoutPct = body.defaultHostPayoutPct
    const hostPayoutMode = body.hostPayoutMode as "AUTOMATIC" | "MANUAL" | undefined

    if (commissionPct !== undefined && (commissionPct < 0 || commissionPct > 50)) {
      return NextResponse.json(
        { error: "Commission percentage must be between 0 and 50." },
        { status: 400 }
      )
    }

    if (hostPayoutMode !== undefined && hostPayoutMode !== "AUTOMATIC" && hostPayoutMode !== "MANUAL") {
      return NextResponse.json(
        { error: "Host payout mode must be AUTOMATIC or MANUAL." },
        { status: 400 }
      )
    }

    const settings = await adminService.updateSettings(
      {
        ...(commissionPct !== undefined
          ? { defaultHostCommissionPct: Math.round(commissionPct) }
          : {}),
        ...(payoutHoldHours !== undefined
          ? { payoutHoldHours: Math.round(payoutHoldHours) }
          : {}),
        ...(hostPayoutPct !== undefined
          ? { defaultHostPayoutPct: Math.round(hostPayoutPct) }
          : {}),
        ...(hostPayoutMode !== undefined ? { hostPayoutMode } : {}),
      },
      session.userId,
      req.headers.get("x-forwarded-for") || undefined
    )

    return NextResponse.json({ success: true, settings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
