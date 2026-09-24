import { FastifyInstance } from "fastify";
import { locationsService } from "./locations.service";

// In-memory sliding window rate limiter (max 60 req/min per IP)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (entry.count >= 60) {
    return false;
  }

  entry.count++;
  return true;
}

export async function locationsRoutes(fastify: FastifyInstance) {
  // GET /api/locations/search?q=
  fastify.get("/search", async (request, reply) => {
    const ip = request.ip || "unknown";

    if (!checkRateLimit(ip)) {
      return reply.status(429).send({
        success: false,
        error: "Too many location search requests. Please slow down and try again.",
      });
    }

    const { q } = request.query as { q?: string };

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return reply.send({
        success: true,
        data: [],
      });
    }

    if (q.trim().length < 2) {
      return reply.send({
        success: true,
        data: [],
      });
    }

    try {
      const results = await locationsService.search(q);
      return reply.send({
        success: true,
        data: results,
      });
    } catch (err: any) {
      return reply.send({
        success: false,
        data: [],
        error: err.message || "We couldn't find that location right now. Please try again.",
      });
    }
  });
}
