import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const result = await hostsService.unpublishProperty(session.userId, id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to unpublish property" },
      { status: err.statusCode || 400 }
    );
  }
}
