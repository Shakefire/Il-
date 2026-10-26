import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const updated = await FinanceService.rejectRefund(session.userId, params.id, body.adminNotes);
    return NextResponse.json({ success: true, message: "Refund rejected.", refund: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to reject refund" }, { status: 400 });
  }
}
