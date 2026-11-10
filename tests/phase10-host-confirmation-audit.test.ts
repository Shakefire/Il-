import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BOOKING_STATUS, CANCELLATION_REASON } from "../backend/src/config/constants"
import { guestReservationOutcome, paymentUnlocked } from "../src/lib/phase11-guest-outcome"

describe("phase 10 host confirmation gates", () => {
  it("maps the live statuses without renaming them", () => {
    assert.equal(BOOKING_STATUS.PENDING_HOST, "PENDING_HOST")
    assert.equal(BOOKING_STATUS.PAYMENT_PENDING, "PAYMENT_PENDING")
    assert.equal(BOOKING_STATUS.CONFIRMED, "CONFIRMED")
  })

  it("blocks payment until the booking is PAYMENT_PENDING", () => {
    assert.equal(paymentUnlocked(BOOKING_STATUS.PENDING_HOST), false)
    assert.equal(paymentUnlocked(BOOKING_STATUS.CANCELLED), false)
    assert.equal(paymentUnlocked(BOOKING_STATUS.CONFIRMED), false)
    assert.equal(paymentUnlocked(BOOKING_STATUS.PAYMENT_PENDING), true)
    const waiting = guestReservationOutcome({ status: BOOKING_STATUS.PENDING_HOST })
    assert.equal(waiting.kind, "waiting_host")
    assert.equal(waiting.paymentAvailable, false)
  })

  it("keeps decline and expiry as CANCELLED reasons, not new statuses", () => {
    assert.equal(CANCELLATION_REASON.HOST_DECLINED, "HOST_DECLINED")
    assert.equal(CANCELLATION_REASON.HOST_WINDOW_EXPIRED, "HOST_WINDOW_EXPIRED")
    const declined = guestReservationOutcome({
      status: BOOKING_STATUS.CANCELLED,
      cancellationReason: CANCELLATION_REASON.HOST_DECLINED,
    })
    assert.equal(declined.paymentAvailable, false)
    assert.equal(declined.headline, "Host declined")
  })
})
