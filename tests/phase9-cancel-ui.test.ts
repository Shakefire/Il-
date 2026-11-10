import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  guestCancelCtaLabel,
  guestRefundStatusMessage,
  hostCancelDeferredNotice,
} from "../src/lib/phase9-cancel-ui"

describe("Phase 9 cancel/refund UI helpers", () => {
  it("labels unpaid vs paid cancel CTAs", () => {
    assert.equal(guestCancelCtaLabel("PENDING_HOST"), "Cancel request")
    assert.equal(guestCancelCtaLabel("PAYMENT_PENDING"), "Cancel request")
    assert.equal(guestCancelCtaLabel("CONFIRMED"), "Cancel booking")
    assert.equal(guestCancelCtaLabel("CANCELLED"), null)
  })

  it("maps refund statuses to guest-readable messages", () => {
    assert.match(
      guestRefundStatusMessage({ status: "REQUESTED" }) || "",
      /pending admin/i
    )
    assert.match(
      guestRefundStatusMessage({ status: "PROCESSED" }) || "",
      /processed/i
    )
    assert.equal(guestRefundStatusMessage(null), null)
  })

  it("documents deferred host-cancel fee schedule", () => {
    assert.match(hostCancelDeferredNotice(), /Deferred/i)
  })
})
