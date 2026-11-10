/**
 * Phase 8 cross-stack consistency helpers (pure — node:test friendly).
 * Status labels must match backend BOOKING_STATUS + Flutter IleBooking headlines.
 */

import { guestStatusLabel } from "./guest-messages"

export const BACKEND_BOOKING_STATUSES = [
  "PENDING",
  "PENDING_HOST",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const

export type BackendBookingStatus = (typeof BACKEND_BOOKING_STATUSES)[number]

/** Guest-facing headline — single source: guest-messages.guestStatusLabel */
export function guestStatusHeadline(status: string): string {
  return guestStatusLabel(status)
}

/** Whether guest UI may call cancel for unpaid holds (backend cancelBooking gate). */
export function canGuestCancelUnpaid(status: string): boolean {
  return (
    status === "PENDING_HOST" ||
    status === "PAYMENT_PENDING" ||
    status === "PENDING"
  )
}

/** Paid cancel must not bare-cancel — admin refund workflow (Phase 9). */
export function guestPaidCancelRequiresAdminRefund(status: string): boolean {
  return status === "CONFIRMED" || status === "COMPLETED"
}

export type JourneyStep =
  | "PENDING_HOST"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "CHECK_IN"
  | "SETTLEMENT_READY"
  | "WITHDRAW_PROCESSING"
  | "WITHDRAW_PAID"

/** Expected next booking/payout projection after a successful step. */
export function expectedAfterStep(step: JourneyStep): {
  bookingStatus?: BackendBookingStatus
  payoutStatus?: string
} {
  switch (step) {
    case "PENDING_HOST":
      return { bookingStatus: "PENDING_HOST" }
    case "PAYMENT_PENDING":
      return { bookingStatus: "PAYMENT_PENDING" }
    case "CONFIRMED":
      return { bookingStatus: "CONFIRMED", payoutStatus: "HELD" }
    case "CHECK_IN":
      return { bookingStatus: "CONFIRMED", payoutStatus: "HELD" }
    case "SETTLEMENT_READY":
      return { bookingStatus: "CONFIRMED", payoutStatus: "READY_FOR_PAYOUT" }
    case "WITHDRAW_PROCESSING":
      return { bookingStatus: "CONFIRMED", payoutStatus: "PROCESSING" }
    case "WITHDRAW_PAID":
      return { bookingStatus: "CONFIRMED", payoutStatus: "PAID" }
  }
}
