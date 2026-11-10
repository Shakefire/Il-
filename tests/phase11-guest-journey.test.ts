import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { guestReservationOutcome, paymentUnlocked } from "../src/lib/phase11-guest-outcome"

describe("phase 11 guest journey outcomes", () => {
  it("separates decline, expiry, and guest cancel", () => {
    assert.equal(
      guestReservationOutcome({ status: "CANCELLED", cancellationReason: "HOST_DECLINED" }).kind,
      "declined"
    )
    assert.equal(
      guestReservationOutcome({
        status: "CANCELLED",
        cancellationReason: "HOST_WINDOW_EXPIRED",
        hostResponse: "EXPIRED",
      }).headline,
      "Request expired"
    )
    assert.equal(
      guestReservationOutcome({
        status: "CANCELLED",
        cancellationReason: "GUEST_CANCELLED_BEFORE_PAYMENT",
      }).headline,
      "Request cancelled"
    )
  })

  it("unlocks payment only after host accept", () => {
    assert.equal(paymentUnlocked("PENDING_HOST"), false)
    assert.equal(guestReservationOutcome({ status: "PAYMENT_PENDING" }).paymentAvailable, true)
    assert.equal(guestReservationOutcome({ status: "CONFIRMED" }).paymentAvailable, false)
    const prefixed = guestReservationOutcome({
      status: "CANCELLED",
      cancellationReason: "HOST_DECLINED: dates taken",
    })
    assert.equal(prefixed.kind, "declined")
    assert.equal(prefixed.paymentAvailable, false)
  })
})
