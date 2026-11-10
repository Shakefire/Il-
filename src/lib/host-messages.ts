/**
 * Central host-facing copy for requests, earnings, and identity verification.
 * Prefer hospitality language over ops jargon (KYC, ledger, PAYMENT_PENDING).
 */

import {
  hostPayoutStatusLabel,
  hostVerificationDetail,
  hostVerificationLabel,
  IleTerms,
} from "./product-language"

export const HostMessages = {
  overviewTitle: "Your listings and earnings",
  overviewBody:
    "Guest list prices include Ilé’s platform fee. Your earnings use the host amount saved on each confirmed stay.",
  respondNow: "Respond now",
  manageListings: "Manage listings",
  identityStatus: "Identity verification",
  /** Balance card title for withdrawable amount */
  availableToWithdraw: "Available to withdraw",
  lifetimeEarnings: "Lifetime earnings (confirmed)",
  pendingHeld: IleTerms.heldEarnings,
  readyToWithdraw: IleTerms.readyToWithdraw,
  transferring: IleTerms.transferring,
  paidToBank: IleTerms.paidToBank,
  noPayoutsTitle: "No payouts yet",
  noPayoutsBody:
    "After a stay is confirmed and settlement rules are met, your host earnings appear here. Held amounts are not yet ready to withdraw.",
  noRequestsTitle: "No open requests",
  noRequestsBody:
    "When a guest requests your stay, you’ll have a short window to accept or decline.",
  noListingsTitle: "No listings yet",
  noListingsBody:
    "Create a listing after identity verification. Publish is allowed only when Ilé marks you verified.",
  bankRequiredTitle: "Add a payout bank account",
  bankRequiredBody:
    "Withdrawals need a verified Nigerian bank account. Saving an account does not send money by itself.",
  withdrawAvailable: "Withdraw available",
  earningsReleaseNote:
    "Earnings release follows settlement rules for your payout mode — held funds are not spendable yet.",
  requestAwaitingTitle: "Booking request waiting for you",
  kycIncompleteTitle: "Identity verification incomplete",
  waitingForYourResponse: "Waiting for your response",
  waitingForGuestPayment: "Waiting for guest payment",
} as const

/** Host booking request badges — never show raw PENDING_HOST / PAYMENT_PENDING. */
export function hostBookingStatusLabel(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING_HOST":
    case "PENDING":
      return HostMessages.waitingForYourResponse
    case "PAYMENT_PENDING":
      return HostMessages.waitingForGuestPayment
    case "CONFIRMED":
      return "Confirmed"
    case "COMPLETED":
      return "Completed"
    case "CANCELLED":
    case "FAILED":
      return "Cancelled"
    default:
      return "Booking update"
  }
}

export {
  hostPayoutStatusLabel,
  hostVerificationDetail,
  hostVerificationLabel,
  IleTerms,
}
