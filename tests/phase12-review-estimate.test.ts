import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { REVIEW_NO_PAYMENT_COPY, estimateGuestStay } from "../src/lib/phase12-guest-estimate"
import { calculatePaystackFee } from "../src/lib/utils"

describe("phase 12 review estimate", () => {
  it("uses the Paystack helper and never marks the estimate payable", () => {
    const estimate = estimateGuestStay(45000, 3)
    assert.equal(estimate.accommodationSubtotal, 135000)
    assert.equal(estimate.processingFee, calculatePaystackFee(135000))
    assert.equal(estimate.processingFee, 2000)
    assert.equal(estimate.estimatedTotal, 137000)
    assert.equal(estimate.isFinalPayable, false)
  })

  it("tells the guest payment waits for the host", () => {
    assert.match(REVIEW_NO_PAYMENT_COPY, /No payment is required yet/)
    assert.match(REVIEW_NO_PAYMENT_COPY, /estimate/i)
    assert.equal(/do not need to accept/i.test(REVIEW_NO_PAYMENT_COPY), false)
  })

  it("fee on a small stay matches the uncapped formula", () => {
    const estimate = estimateGuestStay(1000, 1)
    assert.equal(estimate.processingFee, calculatePaystackFee(1000))
    assert.equal(estimate.processingFee, 16)
  })
})
