/**
 * Guest and host API payloads must not expose platform commission.
 * Admin payloads keep the snapshot. Host payloads may keep host net only.
 */

type Audience = "guest" | "host" | "admin"

const COMMISSION_KEYS = [
  "hostCommissionPct",
  "hostCommissionAmount",
  "paystackFeeAmount",
  "hostPayoutPct",
  "classicHostEarnings",
] as const

export function redactBookingFinance<T extends Record<string, any>>(
  booking: T,
  audience: Audience
): T {
  if (!booking || audience === "admin") return booking
  const copy: Record<string, any> = { ...booking }
  for (const key of COMMISSION_KEYS) delete copy[key]
  if (audience === "guest") delete copy.hostNetAmount
  return copy as T
}

export function presentGuestCreateResult<T extends { booking?: any; pricing?: any }>(result: T): T {
  if (!result) return result
  const pricing = result.pricing ? { ...result.pricing } : undefined
  if (pricing) {
    for (const key of COMMISSION_KEYS) delete pricing[key]
    delete pricing.hostNetAmount
  }
  return {
    ...result,
    pricing,
    booking: result.booking ? redactBookingFinance(result.booking, "guest") : result.booking,
  }
}
