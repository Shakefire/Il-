/**
 * Guest-facing labels for the live request-to-pay statuses.
 * Does not rename backend statuses. Reference names such as
 * PENDING_HOST_CONFIRMATION map to PENDING_HOST.
 */

import { GuestMessages, guestStatusLabel } from "./guest-messages"

export type GuestOutcomeKind =
  | "waiting_host"
  | "payment_due"
  | "confirmed"
  | "completed"
  | "declined"
  | "request_expired"
  | "payment_expired"
  | "guest_cancelled"
  | "superseded"
  | "late_reconciliation"
  | "cancelled"
  | "other"

export type GuestReservationOutcome = {
  kind: GuestOutcomeKind
  headline: string
  body: string
  /** True only for PAYMENT_PENDING. Never for PENDING_HOST. */
  paymentAvailable: boolean
}

export type GuestOutcomeInput = {
  status?: string | null
  cancellationReason?: string | null
  hostResponse?: string | null
}

function blob(input: GuestOutcomeInput): string {
  return `${input.cancellationReason || ""} ${input.hostResponse || ""}`.toUpperCase()
}

/** Payment init is allowed only after host accept. */
export function paymentUnlocked(status?: string | null): boolean {
  return status === "PAYMENT_PENDING"
}

export function guestReservationOutcome(
  input: GuestOutcomeInput
): GuestReservationOutcome {
  const status = (input.status || "").toUpperCase()
  const locked = (kind: GuestOutcomeKind, headline: string, body: string): GuestReservationOutcome => ({
    kind,
    headline,
    body,
    paymentAvailable: false,
  })

  if (status === "PENDING_HOST" || status === "PENDING") {
    return locked(
      "waiting_host",
      GuestMessages.confirmingStayHeadline,
      GuestMessages.confirmingStayBody
    )
  }

  if (status === "PAYMENT_PENDING") {
    return {
      kind: "payment_due",
      headline: GuestMessages.paymentWaitingHeadline,
      body: `${GuestMessages.acceptedHeadline}. ${GuestMessages.paymentWaitingBody}`,
      paymentAvailable: true,
    }
  }

  if (status === "CONFIRMED") {
    return locked(
      "confirmed",
      GuestMessages.confirmed,
      "Payment verified. Arrival details unlock for confirmed stays."
    )
  }

  if (status === "COMPLETED") {
    return locked(
      "completed",
      GuestMessages.completed,
      "Thank you for staying with Ilé."
    )
  }

  if (status === "CANCELLED" || status === "FAILED") {
    const reason = blob(input)
    if (reason.includes("LATE_PAYMENT_RECONCILIATION")) {
      return locked(
        "late_reconciliation",
        GuestMessages.latePaymentTitle,
        GuestMessages.latePaymentBody
      )
    }
    if (reason.includes("PAYMENT_WINDOW_EXPIRED")) {
      return locked(
        "payment_expired",
        GuestMessages.paymentWindowClosed,
        "The payment window ended before we could confirm a payment. This is not a confirmed stay."
      )
    }
    if (reason.includes("HOST_WINDOW_EXPIRED") || reason.includes("EXPIRED")) {
      return locked(
        "request_expired",
        GuestMessages.requestExpired,
        "The host did not respond in time. The dates were released. No payment was taken."
      )
    }
    if (reason.includes("HOST_DECLINED") || reason.includes("DECLINED")) {
      return locked(
        "declined",
        GuestMessages.declined,
        "The host declined this request. No payment was taken."
      )
    }
    if (reason.includes("SUPERSEDED")) {
      return locked(
        "superseded",
        "Request replaced",
        "This unpaid request was replaced by a newer one from you. No payment was taken."
      )
    }
    if (reason.includes("GUEST_CANCELLED")) {
      return locked(
        "guest_cancelled",
        "Request cancelled",
        "You cancelled this unpaid request. No payment was taken."
      )
    }
    return locked(
      "cancelled",
      GuestMessages.cancelled,
      "This booking was cancelled. No new charge was created from this screen."
    )
  }

  return locked(
    "other",
    guestStatusLabel(status || ""),
    "Check the details below for the latest update on this booking."
  )
}
