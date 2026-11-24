import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/serverAuth";
import { respondToSupportCase } from "@/../backend/src/modules/support/support.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = requireAdminSession(req);
  if (!session) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const { id } = await Promise.resolve(params);
  const body = await req.json().catch(() => ({}));
  try {
    const result = await respondToSupportCase({
      caseId: id,
      adminId: session.userId,
      response: body.response || "",
      status: body.status,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
