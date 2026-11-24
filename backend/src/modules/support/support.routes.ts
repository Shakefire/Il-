import { FastifyInstance } from "fastify"
import { authenticateRequest, requireRole } from "../../lib/security"
import {
  createSupportCase,
  getSupportCase,
  listMySupportCases,
  listSupportCasesForAdmin,
  respondToSupportCase,
} from "./support.service"

export async function supportRoutes(fastify: FastifyInstance) {
  fastify.post("/cases", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const body = (request.body || {}) as {
      bookingId?: string
      category?: string
      subject?: string
      message?: string
    }
    try {
      const result = await createSupportCase({
        requesterId: session.userId,
        bookingId: body.bookingId,
        category: body.category || "",
        subject: body.subject || "",
        message: body.message || "",
      })
      return reply.status(201).send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message })
    }
  })

  fastify.get("/cases", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    try {
      if (session.role === "admin") {
        const result = await listSupportCasesForAdmin()
        return reply.send({ success: true, ...result })
      }
      const result = await listMySupportCases(session.userId)
      return reply.send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message })
    }
  })

  fastify.get("/cases/:id", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const { id } = request.params as { id: string }
    try {
      const result = await getSupportCase(id, session.userId, session.role)
      return reply.send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 404).send({ error: err.message })
    }
  })

  fastify.post("/cases/:id/respond", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"])
    if (!session) return
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as { response?: string; status?: string }
    try {
      const result = await respondToSupportCase({
        caseId: id,
        adminId: session.userId,
        response: body.response || "",
        status: body.status,
      })
      return reply.send({ success: true, ...result })
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message })
    }
  })
}
