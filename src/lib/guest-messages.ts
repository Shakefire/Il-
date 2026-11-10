/**
 * Central guest-facing copy for statuses, alerts, cancel dialogs, and CTAs.
 * Never surface raw API enums (PAYMENT_PENDING, REQUESTED) or stack traces.
 */

export const GuestMessages = {
  bookNow: "Request to book",
  confirmingStayHeadline: "Waiting for the host",
  confirmingStayBody:
    "We've sent your booking request. You'll only pay after the host accepts.",
  acceptedHeadline: "Your stay has been accepted",
  /** Exact lifecycle badge/label for PAYMENT_PENDING */
  paymentWaitingHeadline: "Payment waiting",
  paymentWaitingBody:
    "Complete payment before the window ends to confirm your stay.",
  proceedToPayment: "Proceed to payment",
  completePayment: "Complete payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Host declined",
  requestExpired: "Request expired",
  paymentWindowClosed: "Payment window closed",
  unpaidCancelTitle: "Cancel booking request?",
  unpaidCancelBody: "This will cancel the booking request you started. No payment was taken.",
  unpaidCancelKeep: "Keep request",
  unpaidCancelConfirm: "Cancel request",
  paidCancelTitle: "Cancel booking?",
  paidCancelBody:
    "Request cancellation for this confirmed stay. Ilé reviews refunds — you won't trigger a bank refund yourself.",
  paidCancelKeep: "Keep booking",
  paidCancelConfirm: "Request cancellation",
  findAnotherStay: "Find another stay",
  exploreStays: "Explore stays",
  paymentConfirmedTitle: "Payment confirmed",
  paymentConfirmedBody:
    "Your stay is confirmed. Arrival details are unlocked for this booking.",
  paymentProcessingTitle: "Confirming your payment",
  paymentProcessingBody:
    "We're verifying your payment. Don't pay again — refresh in a moment if the status hasn't updated.",
  paymentFailedTitle: "Payment not completed",
  paymentFailedBody:
    "We couldn't confirm this payment. If your bank shows a debit, it usually reverses automatically, or write support@ilestays.ng.",
  latePaymentTitle: "Payment received — stay not confirmed",
  latePaymentBody:
    "A payment arrived after this booking was no longer payable. Your stay was not confirmed. Ilé is reviewing a refund — do not pay again.",
  emptyTripsTitle: "No trips yet",
  emptyTripsBody: "When you request a stay, it will show up here with its status.",
  genericError: "Something went wrong. Try again.",
} as const

export function guestStatusLabel(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING_HOST":
    case "PENDING":
      return GuestMessages.confirmingStayHeadline
    case "PAYMENT_PENDING":
      return GuestMessages.paymentWaitingHeadline
    case "CONFIRMED":
      return GuestMessages.confirmed
    case "COMPLETED":
      return GuestMessages.completed
    case "CANCELLED":
    case "FAILED":
      return GuestMessages.cancelled
    default:
      return "Booking update"
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
    case "CANCELLED":
    case "FAILED":
      return "This booking is no longer active."
    default:
      return "Check the details below for the latest update."
  }
}

export function sanitizeGuestAlert(raw?: string | null): string {
  if (!raw || !raw.trim()) return GuestMessages.genericError
  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()
  if (upper === "PAYMENT_PENDING") return GuestMessages.paymentWaitingHeadline
  if (upper === "PENDING_HOST" || upper === "PENDING") {
    return GuestMessages.confirmingStayHeadline
  }
  if (upper === "CONFIRMED") return GuestMessages.confirmed
  if (upper === "COMPLETED") return GuestMessages.completed
  if (upper === "CANCELLED" || upper === "FAILED") return GuestMessages.cancelled
  if (upper === "REQUESTED") {
    return "Your refund request is with Ilé for review."
  }
  if (
    /status\s*[:=]?\s*\d{3}/i.test(trimmed) ||
    trimmed.includes("Exception") ||
    trimmed.includes("Stack Trace") ||
    trimmed.startsWith("Error:") ||
    /^[A-Z][A-Z0-9_]{3,}$/.test(trimmed)
  ) {
    return GuestMessages.genericError
  }
  return trimmed
}
