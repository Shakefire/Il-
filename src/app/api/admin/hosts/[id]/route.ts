import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const dossier = await adminService.getHostApplication(id);
    return NextResponse.json({
      success: true,
      host: dossier.host,
      profile: dossier.profile,
      verificationLogs: dossier.verificationLogs,
      properties: dossier.properties,
      dossier,
    });
  } catch (err: any) {
    console.error("[Admin API] Host dossier lookup failed:", err);
    return NextResponse.json({ error: err.message || "Host dossier not found" }, { status: 404 });
  }
}
