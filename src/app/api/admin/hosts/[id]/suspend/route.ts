import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.ip || undefined;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason || "Account suspended by admin.";

  try {
    const host = await adminService.suspendHostApplication(
      params.id,
      reason,
      session.userId,
      clientIp
    );
    return NextResponse.json({ success: true, message: "Host suspended.", host });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to suspend host" }, { status: 404 });
  }
}
