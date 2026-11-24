import { env } from "../../config/env"
import { validateDeviceToken } from "./recipient-validator"
import type { ChannelSendResult } from "./delivery-ledger"
import { getDb, schema } from "../../db/client"
import { eq } from "drizzle-orm"

export type WebPushSendResult = ChannelSendResult

type PushSubscriptionJson = {
  endpoint: string
  keys?: { p256dh?: string; auth?: string }
}

/** Accept raw endpoint or JSON PushSubscription.toJSON() from the web client. */
export function resolveWebPushEndpoint(tokenOrEndpoint: string): string {
  const raw = tokenOrEndpoint.trim()
  if (!raw.startsWith("{")) return raw
  try {
    const parsed = JSON.parse(raw) as { endpoint?: string }
    return parsed.endpoint || raw
  } catch {
    return raw
  }
}

const parseSubscription = (tokenOrEndpoint: string): PushSubscriptionJson | null => {
  const raw = tokenOrEndpoint.trim()
  if (!raw.startsWith("{")) {
    return { endpoint: raw }
  }
  try {
    const parsed = JSON.parse(raw) as PushSubscriptionJson
    if (!parsed.endpoint) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Web Push adapter.
 * Validates endpoint format, deactivates 404/410 expired subscriptions,
 * distinguishes provider acceptance vs delivery, and never throws to callers.
 */
export async function sendWebPush(params: {
  endpoint: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<WebPushSendResult> {
  // 1. Strict recipient validation
  const validation = validateDeviceToken(params.endpoint, "web_push")
  if (!validation.valid) {
    return {
      ok: false,
      mock: false,
      skipped: true,
      error: validation.error,
    }
  }

  const ready =
    env.WEB_PUSH_PROVIDER === "webpush" &&
    !!env.WEB_PUSH_VAPID_PUBLIC_KEY &&
    !!env.WEB_PUSH_VAPID_PRIVATE_KEY

  // 2. Unconfigured / Console Provider handling
  if (!ready) {
    if (env.NODE_ENV === "production") {
      console.log("ℹ [WebPush] Web push not configured in production — skipping channel.")
      return {
        ok: false,
        mock: false,
        notConfigured: true,
        skipped: true,
        error: "Web push not configured (optional in current environment)",
      }
    }
    const endpoint = resolveWebPushEndpoint(params.endpoint)
    console.log(
      `🌐 [WebPush Mock] endpoint=${endpoint.slice(0, 48)}… | ${params.title}`
    )
    return {
      ok: true,
      mock: true,
      accepted: true,
      providerMessageId: `webpush_mock_${Date.now()}`,
    }
  }

  // 3. Live Web Push dispatch via VAPID
  const subscription = parseSubscription(params.endpoint)
  if (!subscription?.endpoint) {
    return { ok: false, mock: false, error: "Invalid web push subscription" }
  }
  if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
    return {
      ok: false,
      mock: false,
      error: "Web push subscription missing p256dh/auth keys; re-register device",
    }
  }

  try {
    const webpush = await import("web-push")
    webpush.setVapidDetails(
      env.WEB_PUSH_SUBJECT,
      env.WEB_PUSH_VAPID_PUBLIC_KEY as string,
      env.WEB_PUSH_VAPID_PRIVATE_KEY as string
    )
    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      data: params.data || {},
    })
    const result = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      payload
    )
    return {
      ok: true,
      mock: false,
      accepted: true,
      providerMessageId: String(result.statusCode || "webpush_sent"),
    }
  } catch (err: any) {
    console.warn("[WebPush] Encrypted send failed:", err?.message || err)
    // Deactivate expired or unsubscribed subscription
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await deactivateInvalidSubscription(params.endpoint)
    }
    return {
      ok: false,
      mock: false,
      error: err?.message || "Web push send failed",
    }
  }
}

/** Clean up expired / unsubscribed browser endpoints from device_tokens */
async function deactivateInvalidSubscription(endpoint: string): Promise<void> {
  try {
    const db = getDb()
    await db
      .update(schema.deviceTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.deviceTokens.token, endpoint))
    console.log(`[WebPush] Deactivated expired subscription (${endpoint.slice(0, 32)}...)`)
  } catch (e) {
    console.warn("[WebPush] Failed to deactivate expired subscription:", e)
  }
}

export function getWebPushPublicKey(): string | null {
  return env.WEB_PUSH_VAPID_PUBLIC_KEY || null
}
