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
    const result = await FinanceService.processApprovedRefund(session.userId, params.id, {
      paystackRefundId: body.paystackRefundId,
    });
    return NextResponse.json({ success: true, message: "Refund processed successfully.", refundId: result.refundId, paystackRefundId: result.paystackRefundId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process refund" }, { status: 400 });
  }
}
