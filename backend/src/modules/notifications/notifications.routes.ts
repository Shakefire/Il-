import { FastifyInstance } from "fastify"
import { z } from "zod"
import { authenticateRequest } from "../../lib/security"
import { inboxService } from "./inbox.service"
import { deviceTokensService } from "./device-tokens.service"
import { getWebPushPublicKey } from "./web-push.service"
import { preferencesService } from "./preferences.service"

const RegisterDeviceSchema = z.object({
  token: z.string().min(8),
  platform: z.enum(["ios", "android", "web"]),
  provider: z.enum(["fcm", "web_push"]).optional(),
  appVersion: z.string().max(40).optional(),
})

const PreferencePatchSchema = z.object({
  category: z.string().min(2).max(60),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inboxEnabled: z.boolean().optional(),
})

export async function notificationsRoutes(fastify: FastifyInstance) {
  // GET /api/notifications — in-app inbox for current user
  fastify.get("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return

    const query = request.query as { limit?: string; unreadOnly?: string }
    const result = await inboxService.listForUser(session.userId, {
      limit: query.limit ? Number(query.limit) : 30,
      unreadOnly: query.unreadOnly === "true" || query.unreadOnly === "1",
    })
    return reply.send({
      success: true,
      notifications: result.items,
      unreadCount: result.unreadCount,
    })
  })

  // POST /api/notifications/:id/read
  fastify.post("/:id/read", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const { id } = request.params as { id: string }
    const updated = await inboxService.markRead(session.userId, id)
    if (!updated) {
      return reply.status(404).send({ error: "Notification not found" })
    }
    return reply.send({ success: true, notification: updated })
  })

  // POST /api/notifications/read-all
  fastify.post("/read-all", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    await inboxService.markAllRead(session.userId)
    return reply.send({ success: true })
  })

  // POST /api/notifications/devices — register FCM / web push token
  fastify.post("/devices", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const parse = RegisterDeviceSchema.safeParse(request.body)
    if (!parse.success) {
      return reply
        .status(400)
        .send({ error: parse.error.issues[0]?.message || "Invalid device payload" })
    }
    try {
      const device = await deviceTokensService.register({
        userId: session.userId,
        ...parse.data,
        userAgent: request.headers["user-agent"],
      })
      return reply.status(201).send({ success: true, device })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // DELETE /api/notifications/devices
  fastify.delete("/devices", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const { token } = (request.body || {}) as { token?: string }
    if (!token) {
      return reply.status(400).send({ error: "token is required" })
    }
    await deviceTokensService.revoke(session.userId, token)
    return reply.send({ success: true })
  })

  // GET /api/notifications/web-push/public-key
  fastify.get("/web-push/public-key", async (_request, reply) => {
    const key = getWebPushPublicKey()
    return reply.send({
      success: true,
      publicKey: key,
      configured: !!key,
    })
  })

  // GET /api/notifications/preferences
  fastify.get("/preferences", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const preferences = await preferencesService.listForUser(session.userId)
    return reply.send({ success: true, preferences })
  })

  // PATCH /api/notifications/preferences
  fastify.patch("/preferences", async (request, reply) => {
    const session = await authenticateRequest(request, reply)
    if (!session) return
    const parse = PreferencePatchSchema.safeParse(request.body)
    if (!parse.success) {
      return reply
        .status(400)
        .send({ error: parse.error.issues[0]?.message || "Invalid preferences" })
    }
    try {
      const preference = await preferencesService.upsertPreference(
        session.userId,
        parse.data.category,
        parse.data
      )
      return reply.send({ success: true, preference })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
