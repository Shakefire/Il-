import { FastifyInstance } from "fastify";
import { searchProperties, SearchParams } from "./search.service";

export async function searchRoutes(fastify: FastifyInstance) {
  // GET /api/search — Search properties
  fastify.get("/", async (request, reply) => {
    const query = request.query as SearchParams;
    const result = await searchProperties(query);
    return reply.send(result);
  });
}
