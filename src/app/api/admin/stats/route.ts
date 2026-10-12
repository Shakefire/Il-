import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const stats = await adminService.getStats();
    return NextResponse.json({ success: true, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load stats" }, { status: 500 });
  }
}
