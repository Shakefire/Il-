/**
 * Guest-facing labels for the live request-to-pay statuses.
 * Does not rename backend statuses. Reference names such as
 * PENDING_HOST_CONFIRMATION map to PENDING_HOST.
 */

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
      "Waiting for the host",
      "We've sent your booking request to the host."
    )
  }

  if (status === "PAYMENT_PENDING") {
    return {
      kind: "payment_due",
      headline: "Payment is waiting for you.",
      body: "Your stay has been accepted! Complete payment before the window ends.",
      paymentAvailable: true,
    }
  }

  if (status === "CONFIRMED") {
    return locked(
      "confirmed",
      "Confirmed",
      "Payment verified. Arrival details unlock for confirmed stays."
    )
  }

  if (status === "COMPLETED") {
    return locked("completed", "Completed", "Thank you for staying with Ilé.")
  }

  if (status === "CANCELLED" || status === "FAILED") {
    const reason = blob(input)
    if (reason.includes("LATE_PAYMENT_RECONCILIATION")) {
      return locked(
        "late_reconciliation",
        "Payment window closed",
        "This hold closed after the payment window. Late payment reconciliation is handled by Ilé admin — this is not a confirmed stay."
      )
    }
    if (reason.includes("PAYMENT_WINDOW_EXPIRED")) {
      return locked(
        "payment_expired",
        "Payment window closed",
        "The payment window ended before Paystack verified a payment. This is not a confirmed stay."
      )
    }
    if (reason.includes("HOST_WINDOW_EXPIRED") || reason.includes("EXPIRED")) {
      return locked(
        "request_expired",
        "Request expired",
        "The host did not respond in time. The dates were released. No payment was taken."
      )
    }
    if (reason.includes("HOST_DECLINED") || reason.includes("DECLINED")) {
      return locked(
        "declined",
        "Host declined",
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
      "Cancelled",
      "This reservation was cancelled. No new charge was created from this screen."
    )
  }

  return locked("other", status || "Reservation", `Status from server: ${status || "unknown"}.`)
}
