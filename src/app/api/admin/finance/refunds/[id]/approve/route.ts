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
    const updated = await FinanceService.approveRefund(session.userId, params.id);
    return NextResponse.json({ success: true, message: "Refund approved.", refund: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to approve refund" }, { status: 400 });
  }
}
