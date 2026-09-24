/**
 * Image Upload & Storage Service
 * Handles file uploads, streaming retrieval, and deletion with Cloudflare R2
 * S3-compatible bucket "storageapp" and local filesystem fallback.
 *
 * Folder / Key structure:
 * 9jaroommate.com/properties/{propertyId}/{imageId}.{ext}
 */

import { env } from "../../config/env";
import { MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_TYPES } from "../../config/constants";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export interface UploadResult {
  success: boolean;
  url: string;
  storageKey: string;
  error?: string;
}

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (s3ClientInstance) return s3ClientInstance;

  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
    return s3ClientInstance;
  }

  return null;
}

/**
 * Clean folder prefix to avoid redundant bucket name in key
 * e.g., "storageapp/9jaroommate.com/" -> "9jaroommate.com"
 */
function getNormalizedPrefix(): string {
  const rawPrefix = env.R2_FOLDER_PREFIX || "9jaroommate.com/";
  return rawPrefix
    .replace(/^storageapp\/?/i, "")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Upload an image buffer to Cloudflare R2 (or local fallback).
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  options: { folder?: string; propertyId?: string } = {}
): Promise<UploadResult> {
  // Validate size (10MB limit)
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      url: "",
      storageKey: "",
      error: `Image exceeds maximum size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }

  // Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as any)) {
    return {
      success: false,
      url: "",
      storageKey: "",
      error: `Unsupported image type (${mimeType}). Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    };
  }

  const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const prefix = getNormalizedPrefix();
  
  // Construct property-specific key: 9jaroommate.com/properties/{propertyId}/{imageId}.{ext}
  let key: string;
  if (options.propertyId) {
    key = `${prefix}/properties/${options.propertyId}/${filename}`;
  } else {
    const folderClean = (options.folder || "properties").replace(/^\/+|\/+$/g, "");
    key = `${prefix}/${folderClean}/${filename}`;
  }

  // Use Cloudflare R2 if credentials exist
  const r2 = getR2Client();
  if (r2) {
    return uploadToR2(r2, buffer, key, mimeType);
  }

  // Local filesystem fallback
  return uploadToLocal(buffer, key, mimeType);
}

/**
 * Stream an image object from storage.
 */
export async function getImageObject(
  storageKey: string
): Promise<{ stream: Readable; contentType: string; contentLength?: number } | null> {
  const r2 = getR2Client();

  if (r2) {
    try {
      const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME || "storageapp",
        Key: storageKey,
      });

      const response = await r2.send(command);
      if (!response.Body) return null;

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType || "image/jpeg",
        contentLength: response.ContentLength,
      };
    } catch (err: any) {
      if (err.name !== "NoSuchKey" && err.name !== "NotFound") {
        console.error("[R2] GetObject error:", err);
      }
      return null;
    }
  }

  // Fallback to local filesystem
  try {
    const filePath = path.join(getLocalUploadDir(), storageKey.replace(/\//g, path.sep));
    if (!fs.existsSync(filePath)) return null;

    const stream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    return {
      stream,
      contentType,
      contentLength: stats.size,
    };
  } catch (err) {
    console.error("[Local] File read error:", err);
    return null;
  }
}

/**
 * Delete an image from storage by key.
 */
export async function deleteImage(storageKey: string): Promise<boolean> {
  const r2 = getR2Client();
  if (r2) {
    return deleteFromR2(r2, storageKey);
  }

  return deleteFromLocal(storageKey);
}

/**
 * Test R2 connectivity for health checks.
 */
export async function testR2Connectivity(): Promise<{ connected: boolean; error?: string }> {
  const r2 = getR2Client();
  if (!r2) {
    return { connected: false, error: "Cloudflare R2 credentials not configured" };
  }

  try {
    const bucket = env.R2_BUCKET_NAME || "storageapp";
    // Check if bucket is accessible
    await r2.send(new HeadBucketCommand({ Bucket: bucket }));
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err.message || "Failed to reach Cloudflare R2" };
  }
}

// ─── Cloudflare R2 Implementation ───

async function uploadToR2(
  client: S3Client,
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    const bucket = env.R2_BUCKET_NAME || "storageapp";
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await client.send(command);

    // If a custom public CDN domain is configured, use it.
    // Otherwise route through our Fastify streaming image endpoint so images always display.
    const url = env.R2_PUBLIC_URL
      ? `${env.R2_PUBLIC_URL.replace(/\/+$/, "")}/${key}`
      : `/api/uploads/image?key=${encodeURIComponent(key)}`;

    return { success: true, url, storageKey: key };
  } catch (err: any) {
    console.error("[R2] S3Client upload error:", err);
    return { success: false, url: "", storageKey: key, error: err.message || "R2 upload error" };
  }
}

async function deleteFromR2(client: S3Client, storageKey: string): Promise<boolean> {
  try {
    const bucket = env.R2_BUCKET_NAME || "storageapp";
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });
    await client.send(command);
    return true;
  } catch (err) {
    console.error("[R2] S3Client delete error:", err);
    return false;
  }
}

// ─── Local Filesystem Fallback ───

function getLocalUploadDir(): string {
  const dir = path.resolve(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function uploadToLocal(buffer: Buffer, key: string, _mimeType: string): Promise<UploadResult> {
  try {
    const uploadDir = getLocalUploadDir();
    const filePath = path.join(uploadDir, key.replace(/\//g, path.sep));
    const fileDir = path.dirname(filePath);

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${key}`;
    return { success: true, url, storageKey: key };
  } catch (err) {
    console.error("[Local] Upload error:", err);
    return { success: false, url: "", storageKey: key, error: "Local upload error" };
  }
}

async function deleteFromLocal(storageKey: string): Promise<boolean> {
  try {
    const filePath = path.join(getLocalUploadDir(), storageKey.replace(/\//g, path.sep));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}
