import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { adminService } from "@/../backend/src/modules/admin/admin.service";
import { parsePagination } from "@/../backend/src/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const queryObj: Record<string, any> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const pagination = parsePagination(queryObj);
    const result = await adminService.getProperties(pagination);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load properties" },
      { status: 500 }
    );
  }
}
