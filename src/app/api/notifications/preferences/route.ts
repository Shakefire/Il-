import { NextRequest, NextResponse } from "next/server"
import { authenticateNextRequest } from "@/lib/serverAuth"
import { preferencesService } from "@/../backend/src/modules/notifications/preferences.service"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  const preferences = await preferencesService.listForUser(session.userId)
  return NextResponse.json({ success: true, preferences })
}

export async function PATCH(req: NextRequest) {
  const session = authenticateNextRequest(req)
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  try {
    const body = await req.json()
    const preference = await preferencesService.upsertPreference(
      session.userId,
      String(body.category || ""),
      {
        emailEnabled: body.emailEnabled,
        smsEnabled: body.smsEnabled,
        pushEnabled: body.pushEnabled,
        inboxEnabled: body.inboxEnabled,
      }
    )
    return NextResponse.json({ success: true, preference })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update preferences" },
      { status: 400 }
    )
  }
}
