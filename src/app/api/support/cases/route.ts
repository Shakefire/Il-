import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { createSupportCase, listMySupportCases, listSupportCasesForAdmin } from "@/../backend/src/modules/support/support.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const result = session.role === "admin"
      ? await listSupportCasesForAdmin()
      : await listMySupportCases(session.userId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const result = await createSupportCase({
      requesterId: session.userId,
      bookingId: body.bookingId,
      category: body.category || "",
      subject: body.subject || "",
      message: body.message || "",
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
