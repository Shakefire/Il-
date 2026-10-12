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

  try {
    const property = await adminService.updatePropertyStatus(
      id,
      "PUBLISHED",
      null,
      session.userId,
      clientIp
    );
    return NextResponse.json({ success: true, message: "Property approved and published.", property });
  } catch (err: any) {
    console.error("[Admin API] Failed to approve property:", err);
    return NextResponse.json({ error: err.message || "Failed to approve property" }, { status: err.statusCode || 400 });
  }
}
