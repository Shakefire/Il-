import { env } from "../../config/env"
import { validateAndNormalizePhone } from "./recipient-validator"
import type { ChannelSendResult } from "./delivery-ledger"

export type SmsSendResult = ChannelSendResult

/**
 * Termii SMS adapter.
 * Enforces international E.164 normalization, strictly rejects emails and invalid numbers,
 * distinguishes acceptance vs delivery, and never throws to callers.
 */
export async function sendSms(params: {
  to: string
  message: string
  countryContext?: string
}): Promise<SmsSendResult> {
  // 1. Strict recipient validation & E.164 normalization
  const phoneValidation = validateAndNormalizePhone(params.to, params.countryContext || "NG")
  if (!phoneValidation.valid) {
    return {
      ok: false,
      mock: false,
      skipped: true,
      error: phoneValidation.error,
    }
  }

  const normalizedPhone = phoneValidation.value
  const provider = env.SMS_PROVIDER
  const apiKey = env.TERMII_API_KEY

  // 2. Unconfigured / Console Provider handling
  if (provider === "console" || !apiKey) {
    if (env.NODE_ENV === "production") {
      console.log(
        `ℹ [SMS] Termii not configured in production (provider=${provider}, key=${apiKey ? "set" : "missing"}) — skipping SMS channel.`
      )
      return {
        ok: false,
        mock: false,
        notConfigured: true,
        skipped: true,
        error: "SMS provider not configured (optional in current environment)",
      }
    }
    console.log(
      `📱 [SMS Mock/Termii] To: ${normalizedPhone} | ${params.message.slice(0, 120)}${params.message.length > 120 ? "…" : ""}`
    )
    return {
      ok: true,
      mock: true,
      accepted: true,
      providerMessageId: `sms_mock_${Date.now()}`,
    }
  }

  // 3. Live Termii API dispatch
  try {
    // Termii accepts format without leading plus (e.g. 2348031234567) or standard international
    const termiiTo = normalizedPhone.startsWith("+") ? normalizedPhone.slice(1) : normalizedPhone

    const res = await fetch(`${env.TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        to: termiiTo,
        from: env.TERMII_SENDER_ID,
        sms: params.message,
        type: "plain",
        channel: "generic",
        api_key: apiKey,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      message_id?: string
      message?: string
      code?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        mock: false,
        error: data.message || `Termii HTTP ${res.status}`,
      }
    }
    return {
      ok: true,
      mock: false,
      accepted: true,
      providerMessageId: data.message_id || data.code || `termii_${Date.now()}`,
    }
  } catch (err: any) {
    return {
      ok: false,
      mock: false,
      error: err?.message || "Termii request failed",
    }
  }
}

/** Re-export phone normalizer for backwards compatibility */
export function normalizeNgPhone(raw: string): string {
  const result = validateAndNormalizePhone(raw, "NG")
  if (result.valid) {
    // Strip leading '+' for legacy NG format tests expecting 2348...
    return result.value.startsWith("+") ? result.value.slice(1) : result.value
  }
  return raw.replace(/\D/g, "")
}
