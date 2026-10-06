import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const payload = {
      ...body,
      identityDocumentUrl: body.idFrontUrl || body.identityDocumentUrl,
      idDocumentBackUrl: body.idBackUrl || body.idDocumentBackUrl,
    };
    const result = await hostsService.updateOnboardingIdentity(session.userId, payload);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save identity documents" }, { status: 400 });
  }
}
