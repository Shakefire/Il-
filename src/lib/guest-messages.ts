/**
 * Central guest-facing copy for statuses, alerts, cancel dialogs, and CTAs.
 * Never surface raw API enums (PAYMENT_PENDING, REQUESTED) or stack traces.
 */

export const GuestMessages = {
  bookNow: "Book Now",
  confirmingStayHeadline: "Waiting for the host",
  confirmingStayBody:
    "We've sent your booking request. Payment unlocks only after the host accepts.",
  acceptedHeadline: "Your stay has been accepted!",
  paymentWaitingHeadline: "Payment is waiting for you.",
  paymentWaitingBody:
    "Complete payment before the window ends to confirm your stay.",
  unpaidCancelTitle: "Cancel booking request?",
  unpaidCancelBody: "This will cancel the booking request you started.",
  unpaidCancelKeep: "Keep request",
  unpaidCancelConfirm: "Cancel request",
  paidCancelTitle: "Cancel booking?",
  paidCancelBody: "Are you sure you want to cancel this booking?",
  paidCancelKeep: "Keep booking",
  paidCancelConfirm: "Cancel booking",
  findAnotherStay: "Find another stay",
} as const

export function guestStatusLabel(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING_HOST":
    case "PENDING":
      return GuestMessages.confirmingStayHeadline
    case "PAYMENT_PENDING":
      return GuestMessages.paymentWaitingHeadline
    case "CONFIRMED":
      return "Confirmed"
    case "COMPLETED":
      return "Completed"
    case "CANCELLED":
    case "FAILED":
      return "Cancelled"
    default:
      return "Reservation update"
  }
}

export function guestStatusDetail(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING_HOST":
    case "PENDING":
      return GuestMessages.confirmingStayBody
    case "PAYMENT_PENDING":
      return GuestMessages.paymentWaitingBody
    case "CONFIRMED":
      return "Payment verified. Arrival details unlock for confirmed stays."
    case "COMPLETED":
      return "Thank you for staying with Ilé."
    default:
      return "Check the details below for the latest update."
  }
}

export function sanitizeGuestAlert(raw?: string | null): string {
  if (!raw || !raw.trim()) return "Something went wrong. Try again."
  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()
  if (upper === "PAYMENT_PENDING") return GuestMessages.paymentWaitingHeadline
  if (upper === "PENDING_HOST" || upper === "PENDING") {
    return GuestMessages.confirmingStayHeadline
  }
  if (upper === "REQUESTED") {
    return "Your refund request is with Ilé admin for review."
  }
  if (
    /status\s*[:=]?\s*\d{3}/i.test(trimmed) ||
    trimmed.includes("Exception") ||
    trimmed.includes("Stack Trace") ||
    trimmed.startsWith("Error:")
  ) {
    return "Something went wrong. Try again."
  }
  return trimmed
}
