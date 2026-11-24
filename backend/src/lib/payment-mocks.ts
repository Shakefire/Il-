/**
 * Payment / transfer mock gates.
 * Mock Paystack paths are allowed only outside production (dev + automated tests).
 */

import { env } from "../config/env"

const isRuntimeProduction = (): boolean =>
  env.NODE_ENV === "production" && process.env.NODE_ENV !== "test"

/** True when transfer/refund code may skip live Paystack (never in production). */
export function isPaystackMockTransfersEnabled(): boolean {
  if (isRuntimeProduction()) return false
  return env.PAYSTACK_MOCK_TRANSFERS === true || env.NODE_ENV === "test" || process.env.NODE_ENV === "test"
}

/**
 * True when init/verify/transfer may return MOCK_DEV responses.
 * Production always requires a real Paystack secret key.
 */
export function canUsePaystackDevMocks(): boolean {
  if (isRuntimeProduction()) return false
  if (env.NODE_ENV === "test" || process.env.NODE_ENV === "test") return true
  if (env.PAYSTACK_MOCK_TRANSFERS === true) return true
  return !env.PAYSTACK_SECRET_KEY
}

/** Error payload when production (or locked) env refuses mock payments. */
export function paystackNotConfiguredError(): string {
  return "Paystack is not configured. Live payments require PAYSTACK_SECRET_KEY."
}
