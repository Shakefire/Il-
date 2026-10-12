import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { hostsService } from "@/../backend/src/modules/hosts/hosts.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const result = await hostsService.getHostProperty(session.userId, id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Property not found" }, { status: err.statusCode || 404 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const body = await req.json();
    const result = await hostsService.updateProperty(session.userId, id, body);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.issues) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to update property" }, { status: err.statusCode || 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const session = authenticateNextRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);

  try {
    const result = await hostsService.deleteProperty(session.userId, id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete property listing" }, { status: err.statusCode || 400 });
  }
}
