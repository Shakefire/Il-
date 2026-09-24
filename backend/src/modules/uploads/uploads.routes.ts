import { FastifyInstance } from "fastify";
import { uploadImage, getImageObject, deleteImage } from "./uploads.service";
import { authenticateRequest } from "../../lib/security";
import { getDb, schema } from "../../db/client";
import { eq, and } from "drizzle-orm";

export async function uploadsRoutes(fastify: FastifyInstance) {
  // GET /api/uploads/image?key=...
  // Public image streaming endpoint with long-lived caching
  fastify.get("/image", async (request, reply) => {
    const query = request.query as { key?: string };
    const storageKey = query.key;

    if (!storageKey || typeof storageKey !== "string") {
      return reply.status(400).send({ error: "Missing image storage key." });
    }

    // Security check: prevent directory traversal
    if (storageKey.includes("..") || storageKey.startsWith("/")) {
      return reply.status(400).send({ error: "Invalid storage key." });
    }

    const obj = await getImageObject(storageKey);
    if (!obj) {
      return reply.status(404).send({ error: "Image not found." });
    }

    reply
      .header("Content-Type", obj.contentType)
      .header("Cache-Control", "public, max-age=31536000, immutable");

    if (obj.contentLength) {
      reply.header("Content-Length", obj.contentLength);
    }

    return reply.send(obj.stream);
  });

  // POST /api/uploads
  fastify.post("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const body = request.body as {
      image?: string;
      mimeType?: string;
      folder?: string;
      propertyId?: string;
    };

    if (!body || !body.image) {
      return reply.status(400).send({ error: "Missing image data in request body." });
    }

    // Property ownership check if propertyId is provided
    if (body.propertyId && session.role !== "admin") {
      const db = getDb();
      const [prop] = await db
        .select({ hostId: schema.properties.hostId })
        .from(schema.properties)
        .where(eq(schema.properties.id, body.propertyId))
        .limit(1);

      if (prop && prop.hostId !== session.userId) {
        return reply.status(403).send({ error: "You do not have permission to upload photos for this property." });
      }
    }

    let buffer: Buffer;
    let mimeType = body.mimeType || "image/jpeg";

    try {
      const dataUriMatch = body.image.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        buffer = Buffer.from(dataUriMatch[2], "base64");
      } else {
        buffer = Buffer.from(body.image, "base64");
      }
    } catch {
      return reply.status(400).send({ error: "Invalid base64 image format." });
    }

    const result = await uploadImage(buffer, mimeType, {
      folder: body.folder || "properties",
      propertyId: body.propertyId,
    });

    if (!result.success) {
      return reply.status(400).send({ error: result.error || "Failed to upload image." });
    }

    return reply.status(201).send({
      success: true,
      url: result.url,
      storageKey: result.storageKey,
    });
  });

  // DELETE /api/uploads
  fastify.delete("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const body = request.body as {
      storageKey?: string;
      propertyId?: string;
    };

    if (!body?.storageKey) {
      return reply.status(400).send({ error: "Missing storageKey." });
    }

    // Ownership check
    if (body.propertyId && session.role !== "admin") {
      const db = getDb();
      const [prop] = await db
        .select({ hostId: schema.properties.hostId })
        .from(schema.properties)
        .where(eq(schema.properties.id, body.propertyId))
        .limit(1);

      if (prop && prop.hostId !== session.userId) {
        return reply.status(403).send({ error: "You do not have permission to delete photos for this property." });
      }
    }

    const success = await deleteImage(body.storageKey);
    return reply.send({ success });
  });
}
