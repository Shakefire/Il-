import { env } from "../../config/env"

export type WebPushSendResult = {
  ok: boolean
  mock: boolean
  providerMessageId?: string
  error?: string
}

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
 * - Without VAPID / WEB_PUSH_PROVIDER=console → honest mock log (ok + mock).
 * - With VAPID + provider=webpush → encrypted send via `web-push` package.
 */
export async function sendWebPush(params: {
  endpoint: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<WebPushSendResult> {
  const ready =
    env.WEB_PUSH_PROVIDER === "webpush" &&
    !!env.WEB_PUSH_VAPID_PUBLIC_KEY &&
    !!env.WEB_PUSH_VAPID_PRIVATE_KEY

  if (!ready) {
    const endpoint = resolveWebPushEndpoint(params.endpoint)
    console.log(
      `🌐 [WebPush Mock] endpoint=${endpoint.slice(0, 48)}… | ${params.title}`
    )
    return {
      ok: true,
      mock: true,
      providerMessageId: `webpush_mock_${Date.now()}`,
    }
  }

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
      providerMessageId: String(result.statusCode || "webpush_sent"),
    }
  } catch (err: any) {
    console.warn("[WebPush] Encrypted send failed:", err?.message || err)
    return {
      ok: false,
      mock: false,
      error: err?.message || "Web push send failed",
    }
  }
}

export function getWebPushPublicKey(): string | null {
  return env.WEB_PUSH_VAPID_PUBLIC_KEY || null
}
