import { FastifyInstance } from "fastify";
import { getPublishedProperties, getPropertyBySlug } from "./properties.service";
import { parsePagination, paginatedResponse } from "../../lib/pagination";

export async function propertiesRoutes(fastify: FastifyInstance) {
  // GET /api/properties — List published properties with pagination
  fastify.get("/", async (request, reply) => {
    const pagination = parsePagination(request.query as Record<string, any>);
    const result = await getPublishedProperties(pagination);

    const response = paginatedResponse(result.properties, result.total, pagination);

    return reply.send({
      properties: response.data,
      pagination: response.pagination,
    });
  });

  // GET /api/properties/:slug — Get property by slug or ID
  fastify.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    let allowUnpublished = false;
    const authHeader = request.headers.authorization;
    if (authHeader) {
      try {
        const { verifySessionToken } = await import("../../lib/security");
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const payload = verifySessionToken(token);
        if (payload && (payload.role === "admin" || payload.role === "host")) {
          allowUnpublished = true;
        }
      } catch {}
    }

    const property = await getPropertyBySlug(slug, allowUnpublished);

    if (!property) {
      return reply.status(404).send({ error: "Property not found or not published" });
    }

    return reply.send({ property });
  });
}
