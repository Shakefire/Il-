import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const host = await adminService.getHostApplication(params.id);
    return NextResponse.json({ success: true, host });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Host dossier not found" }, { status: 404 });
  }
}
