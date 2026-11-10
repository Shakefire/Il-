/**
 * Ilé product language — customer-facing terms only.
 * Backend enums stay unchanged; map them here before UI display.
 */

export const IleTerms = {
  brand: "Ilé",
  stay: "stay",
  stays: "stays",
  booking: "booking",
  bookingRequest: "booking request",
  waitingForHost: "Waiting for the host",
  proceedToPayment: "Proceed to payment",
  completePayment: "Complete payment",
  identityVerification: "Identity verification",
  earnings: "Earnings",
  payout: "Payout",
  heldEarnings: "Held for settlement",
  readyToWithdraw: "Ready to withdraw",
  transferring: "Transfer in progress",
  paidToBank: "Paid to your bank",
  findAnotherStay: "Find another stay",
  exploreStays: "Explore stays",
} as const

/** Host-facing payout status labels (never show raw READY_FOR_PAYOUT alone). */
export function hostPayoutStatusLabel(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "HELD":
    case "SCHEDULED":
      return IleTerms.heldEarnings
    case "READY_FOR_PAYOUT":
      return IleTerms.readyToWithdraw
    case "PROCESSING":
      return IleTerms.transferring
    case "PAID":
    case "DISBURSED":
      return IleTerms.paidToBank
    case "FAILED":
      return "Transfer failed — contact support"
    case "CANCELLED":
    case "REVERSED":
      return "Payout cancelled"
    default:
      return "Payout update"
  }
}

/** Host verification status — customer UI, not admin ops. */
export function hostVerificationLabel(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "Verified host"
    case "UNDER_REVIEW":
      return "Identity under review"
    case "REJECTED":
    case "NEEDS_MORE_INFO":
      return "More information needed"
    case "NOT_STARTED":
    case "REGISTERED":
    case "PROFILE_COMPLETED":
      return "Identity verification incomplete"
    default:
      return "Identity verification"
  }
}

export function hostVerificationDetail(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "You can publish listings and receive guest requests."
    case "UNDER_REVIEW":
      return "Ilé is reviewing your documents. Publishing stays locked until approval."
    case "REJECTED":
    case "NEEDS_MORE_INFO":
      return "Update your documents to continue. Check your email for what we need."
    default:
      return "Complete identity verification before publishing listings."
  }
}
