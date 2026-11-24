import { env } from "../../config/env"
import { validateDeviceToken } from "./recipient-validator"
import type { ChannelSendResult } from "./delivery-ledger"
import { getDb, schema } from "../../db/client"
import { eq } from "drizzle-orm"

export type PushSendResult = ChannelSendResult

export interface FirebaseCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

let cachedCreds: FirebaseCredentials | null = null

export function getFirebaseCredentials(): FirebaseCredentials | null {
  if (cachedCreds) return cachedCreds

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    cachedCreds = {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }
    return cachedCreds
  }

  try {
    const fs = require("fs")
    const path = require("path")
    const candidates = [
      (env as any).FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      path.resolve(__dirname, "../../config/firebase-service-account.json"),
      path.resolve(process.cwd(), "backend/src/config/firebase-service-account.json"),
      path.resolve(process.cwd(), "src/config/firebase-service-account.json"),
    ].filter(Boolean) as string[]

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const sa = JSON.parse(fs.readFileSync(p, "utf8"))
        if (sa.project_id && sa.client_email && sa.private_key) {
          cachedCreds = {
            projectId: sa.project_id,
            clientEmail: sa.client_email,
            privateKey: sa.private_key,
          }
          return cachedCreds
        }
      }
    }
  } catch (err) {
    // ignore
  }

  return null
}

/**
 * FCM Admin HTTP v1 adapter.
 * Validates FCM token format, strictly forbids emails/phones,
 * automatically deactivates stale/unregistered tokens,
 * distinguishes provider acceptance vs delivery, and never throws to callers.
 */
export async function sendFcmPush(params: {
  token: string
  title: string
  body: string
  data?: Record<string, string>
  userId?: string
}): Promise<PushSendResult> {
  // 1. Strict device token validation
  const tokenValidation = validateDeviceToken(params.token, "fcm")
  if (!tokenValidation.valid) {
    return {
      ok: false,
      mock: false,
      skipped: true,
      error: tokenValidation.error,
    }
  }

  const token = tokenValidation.value

  const creds = getFirebaseCredentials()
  const ready = env.PUSH_PROVIDER === "fcm" && !!creds

  // 2. Unconfigured / Console Provider handling
  if (!ready) {
    if (env.NODE_ENV === "production") {
      console.log("ℹ [FCM] Firebase not configured in production — skipping push channel.")
      return {
        ok: false,
        mock: false,
        notConfigured: true,
        skipped: true,
        error: "FCM not configured (optional in current environment)",
      }
    }
    console.log(
      `🔔 [FCM Mock] token=${token.slice(0, 16)}… | ${params.title} — ${params.body.slice(0, 80)}`
    )
    return {
      ok: true,
      mock: true,
      accepted: true,
      providerMessageId: `fcm_mock_${Date.now()}`,
    }
  }

  // 3. Live Google FCM HTTP v1 dispatch
  try {
    const accessToken = await getGoogleAccessToken(creds!)
    if (!accessToken) {
      return { ok: false, mock: false, error: "Unable to mint Firebase access token" }
    }

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${creds!.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          message: {
            token,
            notification: { title: params.title, body: params.body },
            data: params.data || {},
          },
        }),
      }
    )
    const data = (await res.json().catch(() => ({}))) as {
      name?: string
      error?: { message?: string; status?: string; code?: number }
    }

    if (!res.ok) {
      const errMsg = data.error?.message || `FCM HTTP ${res.status}`
      const errStatus = data.error?.status || ""

      // Clean up stale or unregistered token
      if (
        res.status === 404 ||
        errStatus === "NOT_FOUND" ||
        errStatus === "UNREGISTERED" ||
        errMsg.toLowerCase().includes("unregistered") ||
        errMsg.toLowerCase().includes("invalid_argument")
      ) {
        await deactivateInvalidDeviceToken(token)
      }

      return {
        ok: false,
        mock: false,
        error: errMsg,
      }
    }

    return {
      ok: true,
      mock: false,
      accepted: true,
      providerMessageId: data.name || `fcm_${Date.now()}`,
    }
  } catch (err: any) {
    return { ok: false, mock: false, error: err?.message || "FCM send failed" }
  }
}

/** Automatically deactivate invalid or expired device tokens from database */
async function deactivateInvalidDeviceToken(token: string): Promise<void> {
  try {
    const db = getDb()
    await db
      .update(schema.deviceTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.deviceTokens.token, token))
    console.log(`[FCM] Deactivated invalid/unregistered device token (${token.slice(0, 16)}...)`)
  } catch (err) {
    console.warn("[FCM] Failed to deactivate invalid device token:", err)
  }
}

/** Minimal JWT assertion for Google OAuth (service account). */
async function getGoogleAccessToken(creds: FirebaseCredentials): Promise<string | null> {
  try {
    const privateKey = (creds.privateKey || "").replace(/\\n/g, "\n")
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: "RS256", typ: "JWT" }
    const claim = {
      iss: creds.clientEmail,
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
      signal: AbortSignal.timeout(10000),
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
