import type { EmailPayload } from "./notifications.service"
import { sendEmail } from "./notifications.service"
import { sendSms } from "./termii.service"
import { sendFcmPush } from "./fcm.service"
import { sendWebPush } from "./web-push.service"
import { withChannelIdempotency } from "./delivery-ledger"
import { inboxService } from "./inbox.service"
import { deviceTokensService } from "./device-tokens.service"
import { preferencesService } from "./preferences.service"
import {
  buildLifecycleIdempotencyKey,
  type LifecycleEmailEvent,
} from "./lifecycle-notify"

export type OrchestratorChannels = {
  email?: EmailPayload
  sms?: { to: string; message: string }
  inbox?: {
    userId: string
    title: string
    body: string
    deepLink?: string | null
  }
  push?: boolean
  /** Preference category — critical categories cannot be muted. */
  category?: string
}

const resolveCategory = (event: string, explicit?: string): string => {
  if (explicit) return explicit
  const upper = event.toUpperCase()
  if (upper.includes("PASSWORD") || upper.includes("OTP") || upper.includes("AUTH")) {
    return "security"
  }
  if (upper.includes("PAYOUT")) return "payout"
  if (upper.includes("PAYMENT") || upper.includes("REFUND")) return "payment"
  if (upper.includes("BOOKING") || upper.includes("HOST_") || upper.includes("GUEST_")) {
    return "booking"
  }
  return "product"
}

async function shouldSend(
  userId: string | undefined,
  category: string,
  channel: "emailEnabled" | "smsEnabled" | "pushEnabled" | "inboxEnabled"
): Promise<boolean> {
  try {
    return await preferencesService.isChannelEnabled(userId, category, channel)
  } catch {
    return true
  }
}

/**
 * Multi-channel notification orchestrator.
 * Email keeps existing durable ledger; SMS/push/web_push/inbox use notification_deliveries.
 * Provider failures never throw — booking/payment callers stay safe.
 */
export function notifyLifecycleEvent(params: {
  bookingId: string
  event: LifecycleEmailEvent | string
  recipientRole: string
  channels: OrchestratorChannels
}): void {
  const { bookingId, event, recipientRole, channels } = params
  const baseKey = buildLifecycleIdempotencyKey(
    event as LifecycleEmailEvent,
    bookingId,
    recipientRole
  )
  const category = resolveCategory(String(event), channels.category)
  const inboxUserId = channels.inbox?.userId

  void (async () => {
    // Email
    if (channels.email) {
      const allow = await shouldSend(inboxUserId, category, "emailEnabled")
      if (allow) {
        const payload: EmailPayload = {
          ...channels.email,
          eventType: String(event),
          entityType: "booking",
          entityId: bookingId,
          idempotencyKey: channels.email.idempotencyKey || `${baseKey}:email`,
        }
        sendEmail(payload).catch((err) =>
          console.warn(`[Orchestrator] email ${event} failed (non-fatal):`, err)
        )
      }
    }

    // In-app inbox
    if (channels.inbox?.userId) {
      const allowInbox = await shouldSend(channels.inbox.userId, category, "inboxEnabled")
      if (allowInbox) {
        const inboxKey = `${baseKey}:inbox`
        withChannelIdempotency({
          idempotencyKey: inboxKey,
          channel: "inbox",
          eventType: String(event),
          entityType: "booking",
          entityId: bookingId,
          userId: channels.inbox.userId,
          recipient: channels.inbox.userId,
          payloadSummary: channels.inbox.title,
          send: async () => {
            await inboxService.upsertInboxItem({
              userId: channels.inbox!.userId,
              eventType: String(event),
              title: channels.inbox!.title,
              body: channels.inbox!.body,
              entityType: "booking",
              entityId: bookingId,
              deepLink: channels.inbox!.deepLink || null,
              idempotencyKey: inboxKey,
            })
            return { ok: true, mock: false, providerMessageId: inboxKey }
          },
        }).catch((err) =>
          console.warn(`[Orchestrator] inbox ${event} failed (non-fatal):`, err)
        )
      }

      // Push / web push to registered devices for same user
      if (channels.push !== false) {
        const allowPush = await shouldSend(channels.inbox.userId, category, "pushEnabled")
        if (allowPush) {
          deviceTokensService
            .listActiveForUser(channels.inbox.userId)
            .then(async (tokens) => {
              for (const device of tokens) {
                const channel = device.provider === "web_push" ? "web_push" : "push"
                const key = `${baseKey}:${channel}:${device.id}`
                await withChannelIdempotency({
                  idempotencyKey: key,
                  channel,
                  eventType: String(event),
                  entityType: "booking",
                  entityId: bookingId,
                  userId: channels.inbox!.userId,
                  recipient: device.token.slice(0, 64),
                  payloadSummary: channels.inbox!.title,
                  send: async () => {
                    if (channel === "web_push") {
                      return sendWebPush({
                        endpoint: device.token,
                        title: channels.inbox!.title,
                        body: channels.inbox!.body,
                        data: { bookingId, event: String(event) },
                      })
                    }
                    return sendFcmPush({
                      token: device.token,
                      title: channels.inbox!.title,
                      body: channels.inbox!.body,
                      data: { bookingId, event: String(event) },
                    })
                  },
                })
              }
            })
            .catch((err) =>
              console.warn(`[Orchestrator] push fan-out ${event} failed (non-fatal):`, err)
            )
        }
      }
    }

    // SMS
    if (channels.sms?.to) {
      const allowSms = await shouldSend(inboxUserId, category, "smsEnabled")
      if (allowSms) {
        const smsKey = `${baseKey}:sms`
        withChannelIdempotency({
          idempotencyKey: smsKey,
          channel: "sms",
          eventType: String(event),
          entityType: "booking",
          entityId: bookingId,
          recipient: channels.sms.to,
          payloadSummary: channels.sms.message.slice(0, 160),
          send: async () =>
            sendSms({ to: channels.sms!.to, message: channels.sms!.message }),
        }).catch((err) =>
          console.warn(`[Orchestrator] sms ${event} failed (non-fatal):`, err)
        )
      }
    }
  })().catch((err) =>
    console.warn(`[Orchestrator] lifecycle ${event} failed (non-fatal):`, err)
  )
}

/**
 * Auth / finance / account events (non-booking entity).
 * Same non-fatal + idempotent guarantees as booking lifecycle.
 */
export function notifyUserEvent(params: {
  userId: string
  event: string
  entityType?: string
  entityId?: string
  category?: string
  channels: OrchestratorChannels
}): void {
  const {
    userId,
    event,
    entityType = "user",
    entityId = userId,
    channels,
  } = params
  const category = resolveCategory(event, channels.category || params.category)
  const baseKey = `${entityType}:${entityId}:${event}:user`

  void (async () => {
    if (channels.email) {
      const allow = await shouldSend(userId, category, "emailEnabled")
      if (allow) {
        sendEmail({
          ...channels.email,
          eventType: event,
          entityType,
          entityId,
          idempotencyKey: channels.email.idempotencyKey || `${baseKey}:email`,
        }).catch((err) =>
          console.warn(`[Orchestrator] user email ${event} failed (non-fatal):`, err)
        )
      }
    }

    if (channels.inbox) {
      const allowInbox = await shouldSend(userId, category, "inboxEnabled")
      if (allowInbox) {
        const inboxKey = `${baseKey}:inbox`
        withChannelIdempotency({
          idempotencyKey: inboxKey,
          channel: "inbox",
          eventType: event,
          entityType,
          entityId,
          userId,
          recipient: userId,
          payloadSummary: channels.inbox.title,
          send: async () => {
            await inboxService.upsertInboxItem({
              userId,
              eventType: event,
              title: channels.inbox!.title,
              body: channels.inbox!.body,
              entityType,
              entityId,
              deepLink: channels.inbox!.deepLink || null,
              idempotencyKey: inboxKey,
            })
            return { ok: true, mock: false, providerMessageId: inboxKey }
          },
        }).catch((err) =>
          console.warn(`[Orchestrator] user inbox ${event} failed (non-fatal):`, err)
        )
      }
    }

    if (channels.push !== false && (channels.inbox || userId)) {
      const allowPush = await shouldSend(userId, category, "pushEnabled")
      if (allowPush) {
        const title = channels.inbox?.title || String(event)
        const body = channels.inbox?.body || "You have a new Ilé update."
        deviceTokensService
          .listActiveForUser(userId)
          .then(async (tokens) => {
            for (const device of tokens) {
              const channel = device.provider === "web_push" ? "web_push" : "push"
              const key = `${baseKey}:${channel}:${device.id}`
              await withChannelIdempotency({
                idempotencyKey: key,
                channel,
                eventType: event,
                entityType,
                entityId,
                userId,
                recipient: device.token.slice(0, 64),
                payloadSummary: title,
                send: async () => {
                  if (channel === "web_push") {
                    return sendWebPush({
                      endpoint: device.token,
                      title,
                      body,
                      data: { event, entityId },
                    })
                  }
                  return sendFcmPush({
                    token: device.token,
                    title,
                    body,
                    data: { event, entityId },
                  })
                },
              })
            }
          })
          .catch((err) =>
            console.warn(`[Orchestrator] user push ${event} failed (non-fatal):`, err)
          )
      }
    }

    if (channels.sms?.to) {
      const allowSms = await shouldSend(userId, category, "smsEnabled")
      if (allowSms) {
        const smsKey = `${baseKey}:sms`
        withChannelIdempotency({
          idempotencyKey: smsKey,
          channel: "sms",
          eventType: event,
          entityType,
          entityId,
          userId,
          recipient: channels.sms.to,
          payloadSummary: channels.sms.message.slice(0, 160),
          send: async () =>
            sendSms({ to: channels.sms!.to, message: channels.sms!.message }),
        }).catch((err) =>
          console.warn(`[Orchestrator] user sms ${event} failed (non-fatal):`, err)
        )
      }
    }
  })().catch((err) =>
    console.warn(`[Orchestrator] user event ${event} failed (non-fatal):`, err)
  )
}
