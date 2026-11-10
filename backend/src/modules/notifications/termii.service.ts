import { env } from "../../config/env"

export type SmsSendResult = {
  ok: boolean
  mock: boolean
  providerMessageId?: string
  error?: string
}

/**
 * Termii SMS adapter. Without TERMII_API_KEY or when SMS_PROVIDER=console,
 * logs the message and returns mock success. Never throws to callers.
 */
export async function sendSms(params: {
  to: string
  message: string
}): Promise<SmsSendResult> {
  const to = normalizeNgPhone(params.to)
  const provider = env.SMS_PROVIDER
  const apiKey = env.TERMII_API_KEY

  if (provider === "console" || !apiKey) {
    console.log(
      `📱 [SMS Mock/Termii] To: ${to} | ${params.message.slice(0, 120)}${params.message.length > 120 ? "…" : ""}`
    )
    return { ok: true, mock: true, providerMessageId: `sms_mock_${Date.now()}` }
  }

  try {
    const res = await fetch(`${env.TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
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

/** Normalize local NG numbers to E.164-ish digits Termii accepts. */
export function normalizeNgPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.startsWith("234") && digits.length >= 13) return digits
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`
  if (digits.length === 10) return `234${digits}`
  return digits || raw.trim()
}
