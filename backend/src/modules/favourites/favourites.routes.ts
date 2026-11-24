import { FastifyInstance } from "fastify"
import { authenticateRequest } from "../../lib/security"
import { addFavourite, listFavourites, removeFavourite } from "./favourites.service"

export async function favouritesRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    try {
      const result = await listFavourites(session.userId)
      return reply.send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ error: err.message })
    }
  })

  fastify.post("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const body = (request.body || {}) as { propertyId?: string }
    if (!body.propertyId) return reply.status(400).send({ error: "propertyId is required." })
    try {
      const result = await addFavourite(session.userId, body.propertyId)
      return reply.status(result.created ? 201 : 200).send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message })
    }
  })

  fastify.delete("/:propertyId", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const { propertyId } = request.params as { propertyId: string }
    try {
      const result = await removeFavourite(session.userId, propertyId)
      return reply.send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message })
    }
  })
}
