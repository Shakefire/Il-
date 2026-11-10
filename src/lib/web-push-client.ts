/**
 * Browser Web Push registration (VAPID).
 *
 * When `WEB_PUSH_VAPID_PUBLIC_KEY` is absent, `/api/notifications/web-push/public-key`
 * returns `configured: false` and this module skips without throwing.
 *
 * Permission is only requested from `enableWebPushAfterUserAction`.
 * Cold-start `syncWebPushIfAlreadyGranted` never prompts.
 */

export type WebPushSyncResult =
  | { status: "skipped"; reason: "unsupported" | "unconfigured" | "unauthenticated" | "permission-default" | "permission-denied" }
  | { status: "registered"; endpoint: string }
  | { status: "revoked" }
  | { status: "error"; message: string }

const SW_PATH = "/sw.js"
const STORAGE_KEY = "ile_web_push_endpoint"

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

const isPushSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

const fetchPublicKey = async (): Promise<string | null> => {
  const res = await fetch("/api/notifications/web-push/public-key", {
    credentials: "include",
  })
  if (!res.ok) return null
  const body = (await res.json()) as {
    configured?: boolean
    publicKey?: string | null
  }
  if (!body.configured || !body.publicKey) return null
  return body.publicKey
}

const ensureServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH)
  if (existing) return existing
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" })
}

const postDeviceToken = async (token: string): Promise<void> => {
  const res = await fetch("/api/notifications/devices", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: "web",
      provider: "web_push",
    }),
  })
  if (res.status === 401) {
    throw new Error("unauthenticated")
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `Device register failed (${res.status})`)
  }
}

const deleteDeviceToken = async (token: string): Promise<void> => {
  await fetch("/api/notifications/devices", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
}

const subscriptionToken = (subscription: PushSubscription): string => {
  return JSON.stringify(subscription.toJSON())
}

const registerSubscription = async (
  publicKey: string
): Promise<WebPushSyncResult> => {
  const registration = await ensureServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }
  const token = subscriptionToken(subscription)
  await postDeviceToken(token)
  try {
    window.localStorage.setItem(STORAGE_KEY, subscription.endpoint)
  } catch (_) {
    // ignore storage failures
  }
  return { status: "registered", endpoint: subscription.endpoint }
}

/** Cold-start / login sync — never prompts for permission. */
export const syncWebPushIfAlreadyGranted = async (): Promise<WebPushSyncResult> => {
  if (!isPushSupported()) {
    return { status: "skipped", reason: "unsupported" }
  }
  try {
    const publicKey = await fetchPublicKey()
    if (!publicKey) {
      return { status: "skipped", reason: "unconfigured" }
    }
    if (Notification.permission === "denied") {
      return { status: "skipped", reason: "permission-denied" }
    }
    if (Notification.permission !== "granted") {
      return { status: "skipped", reason: "permission-default" }
    }
    return await registerSubscription(publicKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Web push sync failed"
    if (message === "unauthenticated") {
      return { status: "skipped", reason: "unauthenticated" }
    }
    console.warn("[WebPush]", message)
    return { status: "error", message }
  }
}

/** User-gesture path — may prompt Notification permission. */
export const enableWebPushAfterUserAction = async (): Promise<WebPushSyncResult> => {
  if (!isPushSupported()) {
    return { status: "skipped", reason: "unsupported" }
  }
  try {
    const publicKey = await fetchPublicKey()
    if (!publicKey) {
      return { status: "skipped", reason: "unconfigured" }
    }
    const permission = await Notification.requestPermission()
    if (permission === "denied") {
      return { status: "skipped", reason: "permission-denied" }
    }
    if (permission !== "granted") {
      return { status: "skipped", reason: "permission-default" }
    }
    return await registerSubscription(publicKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Web push enable failed"
    if (message === "unauthenticated") {
      return { status: "skipped", reason: "unauthenticated" }
    }
    console.warn("[WebPush]", message)
    return { status: "error", message }
  }
}

/** Best-effort revoke on logout. */
export const revokeWebPushOnLogout = async (): Promise<WebPushSyncResult> => {
  if (!isPushSupported()) {
    return { status: "skipped", reason: "unsupported" }
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      const token = subscriptionToken(subscription)
      try {
        await deleteDeviceToken(token)
      } catch (_) {
        // session may already be cleared
      }
      await subscription.unsubscribe()
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (_) {
      // ignore
    }
    return { status: "revoked" }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Web push revoke failed"
    console.warn("[WebPush]", message)
    return { status: "error", message }
  }
}
