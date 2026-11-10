import { env } from "../../config/env"

export type PushSendResult = {
  ok: boolean
  mock: boolean
  providerMessageId?: string
  error?: string
}

/**
 * FCM Admin HTTP v1 adapter (no firebase-admin dependency).
 * Without credentials or PUSH_PROVIDER=console → mock log success.
 * Never throws to callers.
 */
export async function sendFcmPush(params: {
  token: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<PushSendResult> {
  const ready =
    env.PUSH_PROVIDER === "fcm" &&
    !!env.FIREBASE_PROJECT_ID &&
    !!env.FIREBASE_CLIENT_EMAIL &&
    !!env.FIREBASE_PRIVATE_KEY

  if (!ready) {
    console.log(
      `🔔 [FCM Mock] token=${params.token.slice(0, 16)}… | ${params.title} — ${params.body.slice(0, 80)}`
    )
    return { ok: true, mock: true, providerMessageId: `fcm_mock_${Date.now()}` }
  }

  try {
    const accessToken = await getGoogleAccessToken()
    if (!accessToken) {
      return { ok: false, mock: false, error: "Unable to mint Firebase access token" }
    }

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: params.token,
            notification: { title: params.title, body: params.body },
            data: params.data || {},
          },
        }),
      }
    )
    const data = (await res.json().catch(() => ({}))) as {
      name?: string
      error?: { message?: string }
    }
    if (!res.ok) {
      return {
        ok: false,
        mock: false,
        error: data.error?.message || `FCM HTTP ${res.status}`,
      }
    }
    return {
      ok: true,
      mock: false,
      providerMessageId: data.name || `fcm_${Date.now()}`,
    }
  } catch (err: any) {
    return { ok: false, mock: false, error: err?.message || "FCM send failed" }
  }
}

/** Minimal JWT assertion for Google OAuth (service account). */
async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: "RS256", typ: "JWT" }
    const claim = {
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }
    const { createSign } = await import("crypto")
    const encode = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url")
    const unsigned = `${encode(header)}.${encode(claim)}`
    const signer = createSign("RSA-SHA256")
    signer.update(unsigned)
    const signature = signer.sign(privateKey, "base64url")
    const jwt = `${unsigned}.${signature}`

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { access_token?: string }
    return data.access_token || null
  } catch (err) {
    console.warn("[FCM] Access token mint failed:", err)
    return null
  }
}
