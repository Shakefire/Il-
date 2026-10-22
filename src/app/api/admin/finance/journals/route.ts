import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { LedgerService } from "@/../backend/src/modules/finance/ledger.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = requireAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized or not an admin" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const journals = await LedgerService.getJournals(limit, offset);
    return NextResponse.json({ success: true, journals });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load journals" }, { status: 500 });
  }
}
