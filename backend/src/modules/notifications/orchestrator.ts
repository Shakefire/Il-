import type { EmailPayload } from "./notifications.service"
import { sendEmail } from "./notifications.service"
import { sendSms } from "./termii.service"
import { sendFcmPush } from "./fcm.service"
import { sendWebPush } from "./web-push.service"
import {
  withChannelIdempotency,
  recordSkippedDelivery,
} from "./delivery-ledger"
import { inboxService } from "./inbox.service"
import { deviceTokensService } from "./device-tokens.service"
import { preferencesService } from "./preferences.service"
import {
  buildLifecycleIdempotencyKey,
  type LifecycleEmailEvent,
} from "./lifecycle-notify"
import { getRoutingRule, isChannelEligibleForEvent } from "./routing-matrix"
import {
  validateEmail,
  validateAndNormalizePhone,
  validateUserId,
  validateDeviceToken,
  maskRecipient,
} from "./recipient-validator"

export type OrchestratorChannels = {
  email?: EmailPayload
  sms?: { to: string; message: string; countryContext?: string }
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

async function shouldSend(
  userId: string | undefined,
  category: string,
  channel: "emailEnabled" | "smsEnabled" | "pushEnabled" | "inboxEnabled"
): Promise<boolean> {
  if (!userId) return true
  try {
    return await preferencesService.isChannelEnabled(userId, category, channel)
  } catch {
    return true
  }
}

/**
 * Multi-channel notification orchestrator.
 * All channels execute independently in parallel with full fault isolation:
 * - A failure, timeout, or missing credentials in one channel NEVER affects any other channel.
 * - In-app inbox notifications are mandatory, persistent, and never suppressed for critical events.
 * - Provider failures never throw to callers — booking/payment mutations stay safe.
 * - Strictly prevents cross-channel substitution (e.g. phone into email, email into phone).
 * - Records skipped reasons in the delivery ledger for 100% observability.
 */
export function notifyLifecycleEvent(params: {
  bookingId: string
  event: LifecycleEmailEvent | string
  recipientRole: string
  channels: OrchestratorChannels
}): void {
  const { bookingId, event, recipientRole, channels } = params
  const eventStr = String(event)
  const rule = getRoutingRule(eventStr)
  const baseKey = buildLifecycleIdempotencyKey(
    event as LifecycleEmailEvent,
    bookingId,
    recipientRole
  )
  const category = channels.category || rule.category
  const inboxUserId = channels.inbox?.userId

  // 1. Mandatory In-App Inbox Dispatch
  const dispatchInbox = async () => {
    const inboxKey = `${baseKey}:inbox`
    if (!channels.inbox?.userId) {
      return
    }

    const userCheck = validateUserId(channels.inbox.userId)
    if (!userCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: inboxKey,
        channel: "inbox",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        recipient: String(channels.inbox.userId),
        reason: userCheck.error,
      })
      return
    }

    try {
      const allowInbox = await shouldSend(userCheck.value, category, "inboxEnabled")
      if (!allowInbox) {
        await recordSkippedDelivery({
          idempotencyKey: inboxKey,
          channel: "inbox",
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId: userCheck.value,
          recipient: userCheck.value,
          reason: "Muted by user notification preference",
        })
        return
      }

      await withChannelIdempotency({
        idempotencyKey: inboxKey,
        channel: "inbox",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: userCheck.value,
        recipient: userCheck.value,
        payloadSummary: channels.inbox.title,
        send: async () => {
          await inboxService.upsertInboxItem({
            userId: userCheck.value,
            eventType: eventStr,
            title: channels.inbox!.title,
            body: channels.inbox!.body,
            entityType: "booking",
            entityId: bookingId,
            deepLink: channels.inbox!.deepLink || null,
            idempotencyKey: inboxKey,
          })
          return { ok: true, delivered: true, providerMessageId: inboxKey }
        },
      })
    } catch (err) {
      console.error(`[Orchestrator] CRITICAL: In-app inbox failed for ${eventStr}:`, err)
    }
  }

  // 2. Email Dispatch (Resend)
  const dispatchEmail = async () => {
    const emailKey = channels.email?.idempotencyKey || `${baseKey}:email`
    if (!isChannelEligibleForEvent(eventStr, "email")) {
      return
    }

    if (!channels.email?.to) {
      await recordSkippedDelivery({
        idempotencyKey: emailKey,
        channel: "email",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: inboxUserId,
        recipient: "[missing]",
        reason: "Missing recipient email address",
      })
      return
    }

    const emailCheck = validateEmail(channels.email.to)
    if (!emailCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: emailKey,
        channel: "email",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: inboxUserId,
        recipient: String(channels.email.to),
        reason: emailCheck.error,
      })
      return
    }

    try {
      const allow = await shouldSend(inboxUserId, category, "emailEnabled")
      if (!allow) {
        await recordSkippedDelivery({
          idempotencyKey: emailKey,
          channel: "email",
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId: inboxUserId,
          recipient: emailCheck.value,
          reason: "Muted by user email preference",
        })
        return
      }

      const payload: EmailPayload = {
        ...channels.email,
        to: emailCheck.value,
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        idempotencyKey: emailKey,
      }
      await sendEmail(payload)
    } catch (err) {
      console.warn(`[Orchestrator] email ${eventStr} failed (non-fatal):`, err)
    }
  }

  // 3. SMS Dispatch (Termii - Time-Sensitive / Critical Only)
  const dispatchSms = async () => {
    const smsKey = `${baseKey}:sms`
    if (!isChannelEligibleForEvent(eventStr, "sms")) {
      return
    }

    if (!channels.sms?.to) {
      await recordSkippedDelivery({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: inboxUserId,
        recipient: "[missing]",
        reason: "Missing recipient phone number",
      })
      return
    }

    const phoneCheck = validateAndNormalizePhone(channels.sms.to, channels.sms.countryContext || "NG")
    if (!phoneCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: inboxUserId,
        recipient: String(channels.sms.to),
        reason: phoneCheck.error,
      })
      return
    }

    try {
      const allowSms = await shouldSend(inboxUserId, category, "smsEnabled")
      if (!allowSms) {
        await recordSkippedDelivery({
          idempotencyKey: smsKey,
          channel: "sms",
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId: inboxUserId,
          recipient: phoneCheck.value,
          reason: "Muted by user SMS preference",
        })
        return
      }

      await withChannelIdempotency({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType: "booking",
        entityId: bookingId,
        userId: inboxUserId,
        recipient: phoneCheck.value,
        payloadSummary: channels.sms.message.slice(0, 160),
        send: async () =>
          sendSms({
            to: phoneCheck.value,
            message: channels.sms!.message,
            countryContext: channels.sms?.countryContext,
          }),
      })
    } catch (err) {
      console.warn(`[Orchestrator] sms ${eventStr} failed (non-fatal):`, err)
    }
  }

  // 4. Push Dispatch (FCM & Web Push)
  const dispatchPush = async () => {
    if (channels.push === false || !channels.inbox?.userId) return
    const userId = channels.inbox.userId

    try {
      const allowPush = await shouldSend(userId, category, "pushEnabled")
      if (!allowPush) {
        await recordSkippedDelivery({
          idempotencyKey: `${baseKey}:push`,
          channel: "push",
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId,
          recipient: userId,
          reason: "Muted by user push preference",
        })
        return
      }

      const tokens = await deviceTokensService.listActiveForUser(userId)
      if (tokens.length === 0) {
        await recordSkippedDelivery({
          idempotencyKey: `${baseKey}:push:no_devices`,
          channel: "push",
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId,
          recipient: userId,
          reason: "No active registered devices for user",
        })
        return
      }

      for (const device of tokens) {
        const isWeb = device.platform === "web"
        if (isWeb && !isChannelEligibleForEvent(eventStr, "webPush")) continue
        if (!isWeb && !isChannelEligibleForEvent(eventStr, "mobilePush")) continue

        const channel = isWeb ? "web_push" : "push"
        const tokenValidation = validateDeviceToken(device.token, device.provider as "fcm" | "web_push")
        if (!tokenValidation.valid) {
          await recordSkippedDelivery({
            idempotencyKey: `${baseKey}:${channel}:${device.id}`,
            channel,
            eventType: eventStr,
            entityType: "booking",
            entityId: bookingId,
            userId,
            recipient: String(device.token).slice(0, 32),
            reason: tokenValidation.error,
          })
          continue
        }

        const key = `${baseKey}:${channel}:${device.id}`
        await withChannelIdempotency({
          idempotencyKey: key,
          channel,
          eventType: eventStr,
          entityType: "booking",
          entityId: bookingId,
          userId,
          recipient: tokenValidation.value,
          payloadSummary: channels.inbox.title,
          send: async () => {
            if (channel === "web_push") {
              return sendWebPush({
                endpoint: tokenValidation.value,
                title: channels.inbox!.title,
                body: channels.inbox!.body,
                data: { bookingId, event: eventStr },
              })
            }
            return sendFcmPush({
              token: tokenValidation.value,
              title: channels.inbox!.title,
              body: channels.inbox!.body,
              data: { bookingId, event: eventStr },
              userId,
            })
          },
        }).catch((e) => console.warn(`[Orchestrator] push failed for device ${device.id}:`, e))
      }
    } catch (err) {
      console.warn(`[Orchestrator] push fan-out ${eventStr} failed (non-fatal):`, err)
    }
  }

  // Launch all channels in parallel — complete fault isolation!
  void Promise.allSettled([
    dispatchInbox(),
    dispatchEmail(),
    dispatchSms(),
    dispatchPush(),
  ])
}

/**
 * User / Account / Finance events (non-booking entity).
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
  const eventStr = String(event)
  const rule = getRoutingRule(eventStr)
  const category = channels.category || params.category || rule.category
  const baseKey = `${entityType}:${entityId}:${eventStr}:user`

  // 1. Mandatory In-App Inbox Dispatch
  const dispatchInbox = async () => {
    const inboxKey = `${baseKey}:inbox`
    if (!channels.inbox) return

    const userCheck = validateUserId(channels.inbox.userId || userId)
    if (!userCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: inboxKey,
        channel: "inbox",
        eventType: eventStr,
        entityType,
        entityId,
        recipient: String(userId),
        reason: userCheck.error,
      })
      return
    }

    try {
      const allowInbox = await shouldSend(userCheck.value, category, "inboxEnabled")
      if (!allowInbox) {
        await recordSkippedDelivery({
          idempotencyKey: inboxKey,
          channel: "inbox",
          eventType: eventStr,
          entityType,
          entityId,
          userId: userCheck.value,
          recipient: userCheck.value,
          reason: "Muted by user inbox preference",
        })
        return
      }

      await withChannelIdempotency({
        idempotencyKey: inboxKey,
        channel: "inbox",
        eventType: eventStr,
        entityType,
        entityId,
        userId: userCheck.value,
        recipient: userCheck.value,
        payloadSummary: channels.inbox.title,
        send: async () => {
          await inboxService.upsertInboxItem({
            userId: userCheck.value,
            eventType: eventStr,
            title: channels.inbox!.title,
            body: channels.inbox!.body,
            entityType,
            entityId,
            deepLink: channels.inbox!.deepLink || null,
            idempotencyKey: inboxKey,
          })
          return { ok: true, delivered: true, providerMessageId: inboxKey }
        },
      })
    } catch (err) {
      console.error(`[Orchestrator] user inbox ${eventStr} failed:`, err)
    }
  }

  // 2. Email Dispatch
  const dispatchEmail = async () => {
    const emailKey = channels.email?.idempotencyKey || `${baseKey}:email`
    if (!isChannelEligibleForEvent(eventStr, "email")) return

    if (!channels.email?.to) {
      await recordSkippedDelivery({
        idempotencyKey: emailKey,
        channel: "email",
        eventType: eventStr,
        entityType,
        entityId,
        userId,
        recipient: "[missing]",
        reason: "Missing recipient email address",
      })
      return
    }

    const emailCheck = validateEmail(channels.email.to)
    if (!emailCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: emailKey,
        channel: "email",
        eventType: eventStr,
        entityType,
        entityId,
        userId,
        recipient: String(channels.email.to),
        reason: emailCheck.error,
      })
      return
    }

    try {
      const allow = await shouldSend(userId, category, "emailEnabled")
      if (!allow) {
        await recordSkippedDelivery({
          idempotencyKey: emailKey,
          channel: "email",
          eventType: eventStr,
          entityType,
          entityId,
          userId,
          recipient: emailCheck.value,
          reason: "Muted by user email preference",
        })
        return
      }

      await sendEmail({
        ...channels.email,
        to: emailCheck.value,
        eventType: eventStr,
        entityType,
        entityId,
        idempotencyKey: emailKey,
      })
    } catch (err) {
      console.warn(`[Orchestrator] user email ${eventStr} failed (non-fatal):`, err)
    }
  }

  // 3. SMS Dispatch
  const dispatchSms = async () => {
    const smsKey = `${baseKey}:sms`
    if (!isChannelEligibleForEvent(eventStr, "sms")) return

    if (!channels.sms?.to) {
      await recordSkippedDelivery({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType,
        entityId,
        userId,
        recipient: "[missing]",
        reason: "Missing recipient phone number",
      })
      return
    }

    const phoneCheck = validateAndNormalizePhone(channels.sms.to, channels.sms.countryContext || "NG")
    if (!phoneCheck.valid) {
      await recordSkippedDelivery({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType,
        entityId,
        userId,
        recipient: String(channels.sms.to),
        reason: phoneCheck.error,
      })
      return
    }

    try {
      const allowSms = await shouldSend(userId, category, "smsEnabled")
      if (!allowSms) {
        await recordSkippedDelivery({
          idempotencyKey: smsKey,
          channel: "sms",
          eventType: eventStr,
          entityType,
          entityId,
          userId,
          recipient: phoneCheck.value,
          reason: "Muted by user SMS preference",
        })
        return
      }

      await withChannelIdempotency({
        idempotencyKey: smsKey,
        channel: "sms",
        eventType: eventStr,
        entityType,
        entityId,
        userId,
        recipient: phoneCheck.value,
        payloadSummary: channels.sms.message.slice(0, 160),
        send: async () =>
          sendSms({
            to: phoneCheck.value,
            message: channels.sms!.message,
            countryContext: channels.sms?.countryContext,
          }),
      })
    } catch (err) {
      console.warn(`[Orchestrator] user sms ${eventStr} failed (non-fatal):`, err)
    }
  }

  // 4. Push Dispatch
  const dispatchPush = async () => {
    if (channels.push === false || !userId) return

    try {
      const allowPush = await shouldSend(userId, category, "pushEnabled")
      if (!allowPush) {
        await recordSkippedDelivery({
          idempotencyKey: `${baseKey}:push`,
          channel: "push",
          eventType: eventStr,
          entityType,
          entityId,
          userId,
          recipient: userId,
          reason: "Muted by user push preference",
        })
        return
      }

      const tokens = await deviceTokensService.listActiveForUser(userId)
      if (tokens.length === 0) {
        await recordSkippedDelivery({
          idempotencyKey: `${baseKey}:push:no_devices`,
          channel: "push",
          eventType: eventStr,
          entityType,
          entityId,
          userId,
          recipient: userId,
          reason: "No active registered devices for user",
        })
        return
      }

      const title = channels.inbox?.title || String(eventStr).replace(/_/g, " ")
      const body = channels.inbox?.body || "You have a new update on Ilé."

      for (const device of tokens) {
        const isWeb = device.platform === "web"
        if (isWeb && !isChannelEligibleForEvent(eventStr, "webPush")) continue
        if (!isWeb && !isChannelEligibleForEvent(eventStr, "mobilePush")) continue

        const channel = isWeb ? "web_push" : "push"
        const tokenValidation = validateDeviceToken(device.token, device.provider as "fcm" | "web_push")
        if (!tokenValidation.valid) {
          await recordSkippedDelivery({
            idempotencyKey: `${baseKey}:${channel}:${device.id}`,
            channel,
            eventType: eventStr,
            entityType,
            entityId,
            userId,
            recipient: String(device.token).slice(0, 32),
            reason: tokenValidation.error,
          })
          continue
        }

        const key = `${baseKey}:${channel}:${device.id}`
        await withChannelIdempotency({
          idempotencyKey: key,
          channel,
          eventType: eventStr,
          entityType,
          entityId,
          userId,
          recipient: tokenValidation.value,
          payloadSummary: title,
          send: async () => {
            if (channel === "web_push") {
              return sendWebPush({
                endpoint: tokenValidation.value,
                title,
                body,
                data: { event: eventStr, entityId },
              })
            }
            return sendFcmPush({
              token: tokenValidation.value,
              title,
              body,
              data: { event: eventStr, entityId },
              userId,
            })
          },
        }).catch((e) => console.warn(`[Orchestrator] user push failed for device ${device.id}:`, e))
      }
    } catch (err) {
      console.warn(`[Orchestrator] user push ${eventStr} failed (non-fatal):`, err)
    }
  }

  void Promise.allSettled([
    dispatchInbox(),
    dispatchEmail(),
    dispatchSms(),
    dispatchPush(),
  ])
}
