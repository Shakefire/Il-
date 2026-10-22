import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const refunds = await FinanceService.getRefundQueue({ status, limit, offset });
    return NextResponse.json({ success: true, refunds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load refunds" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const result = await FinanceService.processRefund(session.userId, {
      bookingId: body.bookingId,
      reason: body.reason,
      adminNotes: body.adminNotes,
      paystackRefundId: body.paystackRefundId,
    });

    return NextResponse.json({
      message: "Refund processed successfully without processing fee.",
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process refund" }, { status: 400 });
  }
}
