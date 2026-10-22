import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await FinanceService.disbursePayout(session.userId, {
      payoutId: id,
      transferRef: body.transferRef,
      receiptUrl: body.receiptUrl,
      notes: body.notes,
    });

    return NextResponse.json({
      message: "Payout successfully marked as disbursed.",
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to disburse payout" }, { status: 400 });
  }
}
