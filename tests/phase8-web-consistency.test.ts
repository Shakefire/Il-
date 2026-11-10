import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  BACKEND_BOOKING_STATUSES,
  canGuestCancelUnpaid,
  guestPaidCancelRequiresAdminRefund,
  guestStatusHeadline,
  expectedAfterStep,
} from "../src/lib/phase8-consistency"
import { canConfirmGuestCheckIn } from "../src/lib/phase7-guest-host-ui"
import { hostBookingStatusLabel, hostPayoutStatusLabel } from "../src/lib/host-messages"

describe("Phase 8: web/Flutter consistency helpers", () => {
  it("exposes the known backend booking statuses", () => {
    assert.ok(BACKEND_BOOKING_STATUSES.includes("PENDING_HOST"))
    assert.ok(BACKEND_BOOKING_STATUSES.includes("PAYMENT_PENDING"))
    assert.ok(BACKEND_BOOKING_STATUSES.includes("CONFIRMED"))
  })

  it("guest cancel / refund gates match product rules", () => {
    for (const s of ["PENDING_HOST", "PAYMENT_PENDING", "PENDING"] as const) {
      assert.equal(canGuestCancelUnpaid(s), true)
      assert.equal(guestPaidCancelRequiresAdminRefund(s), false)
    }
    assert.equal(canGuestCancelUnpaid("CONFIRMED"), false)
    assert.equal(guestPaidCancelRequiresAdminRefund("CONFIRMED"), true)
  })

  it("status headlines stay guest-readable and stable", () => {
    assert.equal(guestStatusHeadline("PENDING_HOST"), "Waiting for the host")
    assert.equal(guestStatusHeadline("PAYMENT_PENDING"), "Payment waiting")
    assert.equal(guestStatusHeadline("CONFIRMED"), "Confirmed")
    assert.equal(guestStatusHeadline("COMPLETED"), "Completed")
    assert.ok(!guestStatusHeadline("PAYMENT_PENDING").includes("PAYMENT_PENDING"))
    assert.ok(!guestStatusHeadline("PENDING_HOST").includes("PENDING_HOST"))
  })

  it("journey expectations and check-in CTA align", () => {
    assert.deepEqual(expectedAfterStep("SETTLEMENT_READY").payoutStatus, "READY_FOR_PAYOUT")
    assert.equal(
      canConfirmGuestCheckIn(
        { status: "CONFIRMED", checkInDate: "2020-01-01", guestCheckInConfirmed: false },
        "2026-11-09"
      ),
      true
    )
    assert.equal(
      canConfirmGuestCheckIn(
        { status: "PAYMENT_PENDING", checkInDate: "2020-01-01" },
        "2026-11-09"
      ),
      false
    )
  })

  it("host payout and booking labels never echo raw enums", () => {
    assert.equal(hostPayoutStatusLabel("HELD"), "Held for settlement")
    assert.equal(hostPayoutStatusLabel("READY_FOR_PAYOUT"), "Ready to withdraw")
    assert.equal(hostPayoutStatusLabel("PROCESSING"), "Transfer in progress")
    assert.equal(hostPayoutStatusLabel("PAID"), "Paid to your bank")
    assert.ok(!hostPayoutStatusLabel("HELD").toLowerCase().includes("ready"))
    assert.equal(hostBookingStatusLabel("PENDING_HOST"), "Waiting for your response")
    assert.equal(hostBookingStatusLabel("PAYMENT_PENDING"), "Waiting for guest payment")
    assert.ok(!hostBookingStatusLabel("PENDING_HOST").includes("PENDING_HOST"))
  })
})
