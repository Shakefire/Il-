import crypto from "crypto"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../../db/client"
import { maskRecipient } from "./recipient-validator"

export type Channel = "email" | "sms" | "push" | "web_push" | "inbox"

export type DeliveryStatus =
  | "PENDING"
  | "SENT"
  | "ACCEPTED"
  | "DELIVERED"
  | "FAILED"
  | "EXHAUSTED"
  | "SKIPPED"
  | "NOT_CONFIGURED"

export type ChannelSendResult = {
  ok: boolean
  mock?: boolean
  skipped?: boolean
  notConfigured?: boolean
  accepted?: boolean
  delivered?: boolean
  providerMessageId?: string
  error?: string
}

export type DeliveryRecordParams = {
  idempotencyKey: string
  channel: Channel
  eventType: string
  entityType?: string
  entityId?: string | null
  userId?: string | null
  recipient: string
  payloadSummary?: string
  status: DeliveryStatus
  attempts?: number
  maxAttempts?: number
  providerMessageId?: string | null
  lastError?: string | null
  mockMode?: boolean
}

/**
 * Record a direct delivery attempt or skipped entry in notification_deliveries.
 */
export async function recordDelivery(params: DeliveryRecordParams, tx?: any): Promise<void> {
  const db = tx || getDb()
  const masked = maskRecipient(params.recipient, "unknown")
  try {
    const [existing] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      .limit(1)

    if (existing) {
      await db
        .update(schema.notificationDeliveries)
        .set({
          status: params.status,
          attempts: params.attempts !== undefined ? params.attempts : existing.attempts + 1,
          providerMessageId: params.providerMessageId || existing.providerMessageId,
          lastError: params.lastError ?? existing.lastError,
          mockMode: params.mockMode ?? existing.mockMode,
          sentAt: params.status === "SENT" || params.status === "ACCEPTED" || params.status === "DELIVERED"
            ? new Date()
            : existing.sentAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      return
    }

    await db.insert(schema.notificationDeliveries).values({
      id: `ndel_${crypto.randomUUID()}`,
      idempotencyKey: params.idempotencyKey,
      channel: params.channel,
      eventType: params.eventType || "NOTIFICATION",
      entityType: params.entityType || "booking",
      entityId: params.entityId || null,
      userId: params.userId || null,
      recipient: masked,
      payloadSummary: params.payloadSummary || null,
      status: params.status,
      attempts: params.attempts ?? (params.status === "PENDING" ? 0 : 1),
      maxAttempts: params.maxAttempts ?? 3,
      providerMessageId: params.providerMessageId || null,
      lastError: params.lastError || null,
      mockMode: !!params.mockMode,
      sentAt: params.status === "SENT" || params.status === "ACCEPTED" || params.status === "DELIVERED"
        ? new Date()
        : null,
    })
  } catch (err) {
    console.warn(`[NotifyLedger] recordDelivery failed for key ${params.idempotencyKey}:`, err)
  }
}

/**
 * Record an intentionally skipped channel in the ledger for complete observability.
 */
export async function recordSkippedDelivery(params: {
  idempotencyKey: string
  channel: Channel
  eventType: string
  entityType?: string
  entityId?: string | null
  userId?: string | null
  recipient: string
  reason: string
  notConfigured?: boolean
}): Promise<void> {
  const status: DeliveryStatus = params.notConfigured ? "NOT_CONFIGURED" : "SKIPPED"
  await recordDelivery({
    idempotencyKey: params.idempotencyKey,
    channel: params.channel,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    userId: params.userId,
    recipient: params.recipient,
    status,
    lastError: `${status}: ${params.reason}`,
    attempts: 0,
    maxAttempts: 1,
    mockMode: false,
  })
}

/**
 * Wrap a channel send call in durable idempotency & status recording.
 */
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
  tx?: any
  send: () => Promise<ChannelSendResult>
}): Promise<{
  sent: boolean
  status: DeliveryStatus
  idempotent?: boolean
  exhausted?: boolean
  mock?: boolean
  skipped?: boolean
  notConfigured?: boolean
  providerMessageId?: string
  error?: string
}> {
  const db = params.tx || getDb()
  const maxAttempts = params.maxAttempts ?? 3
  const masked = maskRecipient(params.recipient, "unknown")

  try {
    const [existing] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      .limit(1)

    if (existing) {
      if (
        existing.status === "SENT" ||
        existing.status === "ACCEPTED" ||
        existing.status === "DELIVERED"
      ) {
        return {
          sent: true,
          status: existing.status as DeliveryStatus,
          idempotent: true,
          mock: existing.mockMode,
          providerMessageId: existing.providerMessageId || undefined,
        }
      }
      if (existing.status === "SKIPPED" || existing.status === "NOT_CONFIGURED") {
        return {
          sent: false,
          status: existing.status as DeliveryStatus,
          idempotent: true,
          skipped: true,
          notConfigured: existing.status === "NOT_CONFIGURED",
        }
      }
      if (existing.attempts >= existing.maxAttempts || existing.status === "EXHAUSTED") {
        return {
          sent: false,
          status: "EXHAUSTED",
          exhausted: true,
          mock: existing.mockMode,
          error: existing.lastError || "Attempts exhausted",
        }
      }
    } else {
      await db.insert(schema.notificationDeliveries).values({
        id: `ndel_${crypto.randomUUID()}`,
        idempotencyKey: params.idempotencyKey,
        channel: params.channel,
        eventType: params.eventType || "NOTIFICATION",
        entityType: params.entityType || "booking",
        entityId: params.entityId || null,
        userId: params.userId || null,
        recipient: masked,
        payloadSummary: params.payloadSummary || null,
        status: "PENDING",
        attempts: 0,
        maxAttempts,
      })
    }
  } catch (err) {
    console.warn("[NotifyLedger] ensure row failed; sending without durable idempotency:", err)
  }

  let result: ChannelSendResult
  try {
    result = await params.send()
  } catch (err: any) {
    result = {
      ok: false,
      error: err?.message || String(err),
    }
  }

  try {
    const [row] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))
      .limit(1)

    const attempts = (row?.attempts || 0) + (result.skipped ? 0 : 1)
    const exhausted =
      !result.ok &&
      !result.skipped &&
      !result.notConfigured &&
      attempts >= (row?.maxAttempts || maxAttempts)

    const status: DeliveryStatus = result.notConfigured
      ? "NOT_CONFIGURED"
      : result.skipped
      ? "SKIPPED"
      : result.delivered
      ? "DELIVERED"
      : result.accepted
      ? "ACCEPTED"
      : result.ok
      ? "SENT"
      : exhausted
      ? "EXHAUSTED"
      : "FAILED"

    await db
      .update(schema.notificationDeliveries)
      .set({
        attempts,
        status,
        providerMessageId: result.providerMessageId || row?.providerMessageId || null,
        lastError: result.ok ? null : result.error || "send failed",
        mockMode: !!result.mock,
        sentAt: result.ok ? new Date() : row?.sentAt || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationDeliveries.idempotencyKey, params.idempotencyKey))

    return {
      sent: result.ok,
      status,
      mock: result.mock,
      skipped: result.skipped,
      notConfigured: result.notConfigured,
      providerMessageId: result.providerMessageId,
      error: result.error,
    }
  } catch (err) {
    console.warn("[NotifyLedger] update failed:", err)
    return {
      sent: result.ok,
      status: result.ok ? "SENT" : "FAILED",
      mock: result.mock,
      skipped: result.skipped,
      error: result.error,
    }
  }
}
