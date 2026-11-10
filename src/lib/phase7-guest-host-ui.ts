/**
 * Pure Phase 7 UI helpers — guest check-in CTA + host withdraw gating.
 * Kept free of React so node:test can cover web UI rules without Playwright.
 */

export type CheckInBookingLike = {
  status?: string | null
  checkInDate?: string | null
  guestCheckInConfirmedAt?: string | null
  guestCheckInConfirmed?: boolean | null
}

export type WithdrawValidationInput = {
  availableNaira: number
  requestedNaira?: number | null
  bankVerified: boolean
  /** Held/pending funds — not withdrawable */
  pendingNaira?: number
}

export type WithdrawValidationResult =
  | { ok: true; amountNaira: number }
  | { ok: false; code: string; message: string }

/** Mirrors Trips page eligibility for the guest check-in CTA. */
export const canConfirmGuestCheckIn = (
  booking: CheckInBookingLike,
  todayIsoDate: string = new Date().toISOString().split("T")[0]
): boolean => {
  if (booking.guestCheckInConfirmedAt || booking.guestCheckInConfirmed) {
    return false
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    return false
  }
  if (!booking.checkInDate) return false
  return booking.checkInDate <= todayIsoDate
}

/** Client-side withdraw gate before calling /api/host/wallet/withdraw. */
export const validateHostWithdrawRequest = (
  input: WithdrawValidationInput
): WithdrawValidationResult => {
  if (!input.bankVerified) {
    return {
      ok: false,
      code: "BANK_REQUIRED",
      message: "Add and verify a bank account before withdrawing.",
    }
  }
  const available = Math.floor(Number(input.availableNaira) || 0)
  if (available <= 0) {
    const pending = Math.floor(Number(input.pendingNaira) || 0)
    if (pending > 0) {
      return {
        ok: false,
        code: "FUNDS_HELD",
        message:
          "Earnings are still held pending guest check-in / hold period.",
      }
    }
    return {
      ok: false,
      code: "NO_AVAILABLE_BALANCE",
      message: "No available earnings to withdraw.",
    }
  }
  const requested =
    input.requestedNaira === undefined || input.requestedNaira === null
      ? available
      : Math.floor(Number(input.requestedNaira))
  if (!Number.isFinite(requested) || requested <= 0) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: "Withdrawal amount must be a positive integer (naira).",
    }
  }
  if (requested > available) {
    return {
      ok: false,
      code: "INSUFFICIENT_AVAILABLE",
      message: `Requested ₦${requested.toLocaleString()} exceeds available ₦${available.toLocaleString()}.`,
    }
  }
  return { ok: true, amountNaira: requested }
}
