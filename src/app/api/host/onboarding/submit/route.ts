import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }
    const result = await hostsService.submitOnboardingForReview(session.userId, body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit onboarding application" }, { status: 400 });
  }
}
