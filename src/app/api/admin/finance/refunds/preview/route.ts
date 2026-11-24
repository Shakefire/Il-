import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { financeControlHttp, getAdminRefundPreview } from "@/../backend/src/modules/finance/admin-refund.service";

export const dynamic = "force-dynamic";

/** GET /api/admin/finance/refunds/preview?bookingId= — read-only refund context. */
export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin", code: "ADMIN_REQUIRED" }, { status: 401 });
  }

  const bookingId = new URL(req.url).searchParams.get("bookingId") || "";
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  try {
    const preview = await getAdminRefundPreview(bookingId);
    return NextResponse.json({ success: true, preview });
  } catch (err: unknown) {
    const mapped = financeControlHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
