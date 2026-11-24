import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";
import { financeControlHttp } from "@/../backend/src/modules/finance/admin-refund.service";

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
      amountNaira: body.amountNaira,
    });
    if (!result.success) {
      return NextResponse.json(
        {
          error: `Refund is ${result.status}. It is not successful until the Paystack result is reconciled.`,
          ...result,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Refund settled from commission account 1040. Host wallets were not debited.",
      refundId: result.refundId,
      paystackRefundId: result.paystackRefundId,
      status: result.status,
    });
  } catch (err: any) {
    const mapped = financeControlHttp(err);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
