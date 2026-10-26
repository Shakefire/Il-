import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { FinanceService } from "@/../backend/src/modules/finance/finance.service";

export const dynamic = "force-dynamic";

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const headerRow = headers.map(escape).join(",");
  const dataRows = rows.map((r) => r.map(escape).join(","));
  return [headerRow, ...dataRows].join("\n");
}

function naira(kobo: number | null | undefined): string {
  return ((kobo ?? 0) / 100).toFixed(2);
}

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 200;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
  const statusFilter = searchParams.get("status") || undefined;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  try {
    switch (params.type) {
      case "collections": {
        const result = await FinanceService.getCollectionsReport({ from, to, limit, offset });
        if (format === "csv") {
          const headers = ["Booking Ref", "Property", "Guest Email", "Gross (NGN)", "Paystack Fee (NGN)", "Net (NGN)", "Paid At", "Currency"];
          const rows = result.rows.map((r) => [
            r.bookingRef, r.propertyName, r.guestEmail,
            naira(r.amount), naira(r.paystackFeeAmount), naira(r.netAmount),
            r.paidAt ? new Date(r.paidAt).toISOString() : "", r.currency,
          ]);
          rows.push(["TOTAL", "", "", naira(result.totals.totalGross), naira(result.totals.totalFees), naira(result.totals.totalNet), "", ""]);
          return new NextResponse(toCSV(headers, rows), {
            status: 200,
            headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="ile-collections-${today}.csv"` },
          });
        }
        return NextResponse.json(result);
      }

      case "payouts": {
        const result = await FinanceService.getPayoutsReport({ from, to, status: statusFilter, limit, offset });
        if (format === "csv") {
          const headers = ["Booking Ref", "Property", "Host Name", "Host Email", "Amount (NGN)", "Status", "Disbursed At", "Transfer Ref", "Transfer Status"];
          const rows = result.rows.map((r) => [
            r.bookingRef, r.propertyName, r.hostName, r.hostEmail,
            naira(r.amount), r.status, r.disbursedAt ? new Date(r.disbursedAt).toISOString() : "",
            r.paystackTransferRef || "", r.transferStatus || "",
          ]);
          rows.push(["TOTAL", "", "", "", naira(result.totals.totalDisbursed), "", "", "", ""]);
          return new NextResponse(toCSV(headers, rows), {
            status: 200,
            headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="ile-payouts-${today}.csv"` },
          });
        }
        return NextResponse.json(result);
      }

      case "refunds": {
        const result = await FinanceService.getRefundsReport({ from, to, limit, offset });
        if (format === "csv") {
          const headers = ["Booking Ref", "Property", "Guest Email", "Gross Paid (NGN)", "Fee Retained (NGN)", "Refunded (NGN)", "Status", "Processed At", "Reason"];
          const rows = result.rows.map((r) => [
            r.bookingRef, r.propertyName, r.guestEmail,
            naira(r.grossPaid), naira(r.nonRefundableProcessingFee), naira(r.refundableAmount),
            r.status, r.processedAt ? new Date(r.processedAt).toISOString() : "", r.reason || "",
          ]);
          rows.push(["TOTAL", "", "", "", naira(result.totals.totalFeeRetained), naira(result.totals.totalRefunded), "", "", ""]);
          return new NextResponse(toCSV(headers, rows), {
            status: 200,
            headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="ile-refunds-${today}.csv"` },
          });
        }
        return NextResponse.json(result);
      }

      case "settlements": {
        const result = await FinanceService.getSettlementsReport({ limit, offset });
        if (format === "csv") {
          const headers = ["Booking Ref", "Property", "Host Name", "Host Email", "Check-In", "Check-Out", "Total Amount (NGN)", "Accommodation (NGN)", "Commission (NGN)", "Host Net (NGN)", "Payout Status"];
          const rows = result.settlements.map((r) => [
            r.bookingRef, r.propertyName, r.hostName, r.hostEmail,
            r.checkInDate || "", r.checkOutDate || "",
            naira(r.totalAmount), naira(r.accommodationSubtotal), naira(r.hostCommissionAmount), naira(r.hostNetAmount),
            r.payoutStatus,
          ]);
          return new NextResponse(toCSV(headers, rows), {
            status: 200,
            headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="ile-settlements-${today}.csv"` },
          });
        }
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown report type: ${params.type}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate report" }, { status: 500 });
  }
}
