import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

/**
 * PUT /api/host/properties/:id/media-order
 * Persist gallery display order and cover image.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.orderedImageIds) || body.orderedImageIds.length === 0) {
      return NextResponse.json({ error: "orderedImageIds array is required" }, { status: 400 });
    }

    const result = await hostsService.reorderPropertyMedia(
      session.userId,
      id,
      body.orderedImageIds,
      body.coverImageId
    );
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reorder media" },
      { status: err.statusCode || 400 }
    );
  }
}
