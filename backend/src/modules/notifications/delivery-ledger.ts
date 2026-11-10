import crypto from "crypto"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../../db/client"

export type Channel = "sms" | "push" | "web_push" | "inbox"

export async function withChannelIdempotency(params: {
  idempotencyKey: string
  channel: Channel
  eventType: string
  entityType?: string
  entityId?: string | null
  userId?: string | null
  recipient: string
  payloadSummary?: string
  maxAttempts?: number
  send: () => Promise<{
    ok: boolean
    mock?: boolean
    providerMessageId?: string
    error?: string
  }>
}): Promise<{ sent: boolean; idempotent?: boolean; exhausted?: boolean; mock?: boolean }> {
  const db = getDb()
  const maxAttempts = params.maxAttempts ?? 3

  try {
    const [existing] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      .limit(1)

    if (existing?.status === "SENT") {
      return { sent: false, idempotent: true, mock: existing.mockMode }
    }
    if (existing && (existing.attempts >= existing.maxAttempts || existing.status === "EXHAUSTED")) {
      return { sent: false, exhausted: true, mock: existing.mockMode }
    }

    if (!existing) {
      await db.insert(schema.notificationDeliveries).values({
        id: `ndel_${crypto.randomUUID()}`,
        idempotencyKey: params.idempotencyKey,
        channel: params.channel,
        eventType: params.eventType,
        entityType: params.entityType || "booking",
        entityId: params.entityId || null,
        userId: params.userId || null,
        recipient: params.recipient,
        payloadSummary: params.payloadSummary || null,
        status: "PENDING",
        attempts: 0,
        maxAttempts,
      })
    }
  } catch (err) {
    console.warn("[NotifyLedger] ensure row failed; sending without durable idempotency:", err)
  }

  const result = await params.send()

  try {
    const [row] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      .limit(1)

    const attempts = (row?.attempts || 0) + 1
    const exhausted = !result.ok && attempts >= (row?.maxAttempts || maxAttempts)

    await db
      .update(schema.notificationDeliveries)
      .set({
        attempts,
        status: result.ok ? "SENT" : exhausted ? "EXHAUSTED" : "FAILED",
        providerMessageId: result.providerMessageId || row?.providerMessageId || null,
        lastError: result.ok ? null : result.error || "send failed",
        mockMode: !!result.mock,
        sentAt: result.ok ? new Date() : row?.sentAt || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
  } catch (err) {
    console.warn("[NotifyLedger] update failed:", err)
  }

  return { sent: result.ok, mock: result.mock }
}
