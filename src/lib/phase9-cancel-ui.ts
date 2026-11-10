/**
 * Phase 9 guest/host cancel UI copy helpers (pure).
 */

export type RefundLike = {
  status?: string | null
  refundableAmount?: number | null
  reason?: string | null
}

export function guestCancelCtaLabel(status: string): string | null {
  if (status === "PENDING_HOST") return "Cancel request"
  if (status === "PAYMENT_PENDING" || status === "PENDING") return "Cancel request"
  if (status === "CONFIRMED" || status === "COMPLETED") {
    return "Cancel booking"
  }
  return null
}

export function guestRefundStatusMessage(refund: RefundLike | null | undefined): string | null {
  if (!refund?.status) return null
  switch (refund.status) {
    case "REQUESTED":
      return "Refund request pending admin review. Your stay stays confirmed until resolved."
    case "APPROVED":
      return "Refund approved — admin is processing the Paystack refund."
    case "REJECTED":
      return "Refund request was declined by Ilé admin. Contact support if you need help."
    case "PROCESSED":
      return "Refund processed. Funds return via Paystack to your original payment method."
    default:
      return `Refund status: ${refund.status}`
  }
}

/** Host-facing note — no guest fee schedule invented for host cancel. */
export function hostCancelDeferredNotice(): string {
  return "Host cancel after confirmation / post-check-in cancel fee schedules are Deferred — admin refund tools remain available for existing REQUESTED→PROCESSED path."
}
