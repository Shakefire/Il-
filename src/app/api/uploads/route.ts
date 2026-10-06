import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/../backend/src/modules/uploads/uploads.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, folder = "kyc" } = body;

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "No image payload provided" }, { status: 400 });
    }

    // Parse base64 data URI
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // If already a remote URL, return as is
      if (image.startsWith("http://") || image.startsWith("https://")) {
        return NextResponse.json({ success: true, url: image });
      }
      return NextResponse.json({ error: "Invalid base64 payload format" }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    const result = await uploadImage(buffer, mimeType, { folder });
    if (result.success && result.url) {
      return NextResponse.json({ success: true, url: result.url });
    }

    // Graceful fallback to data URI if R2 is unavailable
    return NextResponse.json({ success: true, url: image });
  } catch (err: any) {
    console.error("[Upload API] Error processing upload:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
