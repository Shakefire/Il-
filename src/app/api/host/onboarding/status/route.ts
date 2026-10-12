import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await hostsService.getOnboardingStatus(session.userId);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load onboarding status" }, { status: 500 });
  }
}
