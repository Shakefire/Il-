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
  const reason = body?.reason || "Application does not meet host criteria.";

  try {
    const host = await adminService.rejectHostApplication(
      params.id,
      reason,
      session.userId,
      clientIp
    );
    return NextResponse.json({ success: true, message: "Host rejected.", host });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reject host" }, { status: 404 });
  }
}
