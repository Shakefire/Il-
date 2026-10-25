import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const body = await req.json();
    if (!body.bankName || !body.accountNumber || !body.accountName) {
      return NextResponse.json({ error: "Bank name, account number, and account name are required" }, { status: 400 });
    }

    const updated = await FinanceService.updatePayoutBankAccount(session.userId, {
      payoutId: id,
      bankName: body.bankName,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      accountName: body.accountName,
      updateHostDefaultProfile: body.updateHostDefaultProfile !== false,
    });

    return NextResponse.json({ success: true, payout: updated });
  } catch (err: any) {
    console.error("[Admin API] Failed to update payout bank details:", err);
    return NextResponse.json({ error: err.message || "Failed to update payout bank details" }, { status: 400 });
  }
}
