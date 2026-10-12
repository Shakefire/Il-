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

  try {
    const host = await adminService.approveHostApplication(
      params.id,
      session.userId,
      clientIp
    );
    return NextResponse.json({ success: true, message: "Host approved.", host });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to approve host" }, { status: 404 });
  }
}
