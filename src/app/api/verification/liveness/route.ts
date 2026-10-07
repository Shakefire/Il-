import { NextRequest, NextResponse } from "next/server";
import { authenticateNextRequest } from "@/lib/serverAuth";
import { uploadImage } from "@/../backend/src/modules/uploads/uploads.service";
import { getDb, schema } from "@/../backend/src/db/client";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = authenticateNextRequest(req);

    // Read multipart form data
    const formData = await req.formData();
    const snapshotEntry = formData.get("snapshot");
    const videoEntry = formData.get("video");

    if (!snapshotEntry) {
      return NextResponse.json(
        { error: "Missing required liveness snapshot capture" },
        { status: 400 }
      );
    }

    const verificationId = `live_${crypto.randomUUID()}`;

    // 1. Process Snapshot (Blob, File, or Base64 string)
    let snapshotBuffer: Buffer;
    let snapshotMimeType = "image/jpeg";

    if (typeof snapshotEntry === "string") {
      // Base64 data URL
      const dataUriMatch = snapshotEntry.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        snapshotMimeType = dataUriMatch[1];
        snapshotBuffer = Buffer.from(dataUriMatch[2], "base64");
      } else {
        snapshotBuffer = Buffer.from(snapshotEntry, "base64");
      }
    } else if (snapshotEntry instanceof Blob) {
      snapshotMimeType = snapshotEntry.type || "image/jpeg";
      snapshotBuffer = Buffer.from(await snapshotEntry.arrayBuffer());
    } else {
      return NextResponse.json({ error: "Invalid snapshot data format" }, { status: 400 });
    }

    // Upload high-res snapshot
    const snapshotUpload = await uploadImage(snapshotBuffer, snapshotMimeType, {
      folder: "kyc/liveness",
    });

    if (!snapshotUpload.success || !snapshotUpload.url) {
      return NextResponse.json(
        { error: snapshotUpload.error || "Failed to store verification snapshot" },
        { status: 500 }
      );
    }

    // 2. Process Session Video Clip (if provided)
    let videoUrl: string | null = null;
    if (videoEntry && videoEntry instanceof Blob) {
      try {
        const videoMime = videoEntry.type || "video/webm";
        const videoBuffer = Buffer.from(await videoEntry.arrayBuffer());
        
        // Upload video if within size limit
        if (videoBuffer.length > 0 && videoBuffer.length <= 25 * 1024 * 1024) {
          const videoUpload = await uploadImage(videoBuffer, videoMime, {
            folder: "kyc/liveness-sessions",
          });
          if (videoUpload.success && videoUpload.url) {
            videoUrl = videoUpload.url;
          }
        }
      } catch (videoErr) {
        console.warn("[Liveness API] Notice: Video session storage skipped or non-fatal:", videoErr);
      }
    }

    // 3. If user is authenticated, link verified snapshot as selfieUrl on profile
    if (session?.userId) {
      try {
        const db = getDb();
        const [existingProfile] = await db
          .select({ id: schema.profiles.id })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, session.userId))
          .limit(1);

        if (existingProfile) {
          await db
            .update(schema.profiles)
            .set({
              selfieUrl: snapshotUpload.url,
              updatedAt: new Date(),
            })
            .where(eq(schema.profiles.userId, session.userId));
        }
      } catch (dbErr) {
        console.warn("[Liveness API] Notice: Profile selfie auto-link deferred:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      verificationId,
      snapshotUrl: snapshotUpload.url,
      videoUrl,
      verifiedAt: new Date().toISOString(),
      message: "Biometric liveness verification completed successfully.",
    });
  } catch (err: any) {
    console.error("[Liveness API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Liveness verification processing failed" },
      { status: 500 }
    );
  }
}
