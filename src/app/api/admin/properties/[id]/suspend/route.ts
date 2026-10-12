import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  const clientIp = req.headers.get("x-forwarded-for") || undefined;
  const body = await req.json().catch(() => ({}));
  const reason = body?.reason || body?.feedback || "Property suspended by admin.";

  try {
    const property = await adminService.updatePropertyStatus(
      id,
      "SUSPENDED",
      reason,
      session.userId,
      clientIp
    );
    return NextResponse.json({ success: true, message: "Property suspended.", property });
  } catch (err: any) {
    console.error("[Admin API] Failed to suspend property:", err);
    return NextResponse.json({ error: err.message || "Failed to suspend property" }, { status: err.statusCode || 400 });
  }
}
