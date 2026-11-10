import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { guestFlowError } from "../src/lib/phase13-guest-errors"

describe("phase 13 guest error copy", () => {
  it("names offline, capacity, dates, availability, and payment failures", () => {
    assert.equal(guestFlowError(new Error("Failed to fetch")).title, "No internet")
    assert.equal(
      guestFlowError(new Error("Guest count (8) exceeds property maximum of 4.")).title,
      "Guest count exceeds capacity"
    )
    assert.equal(
      guestFlowError(new Error("Minimum stay for this property is 2 nights.")).title,
      "Invalid dates"
    )
    assert.equal(
      guestFlowError(new Error("Property is not available for the selected dates."), "request").title,
      "Property unavailable"
    )
    assert.equal(
      guestFlowError(new Error("Failed to initialize payment gateway."), "payment").title,
      "Payment initialization failure"
    )
    assert.equal(
      guestFlowError(new Error("Payment still processing with Paystack"), "payment").title,
      "Payment verification pending"
    )
    assert.equal(guestFlowError(new Error("boom"), "search").title, "Search failed")
    assert.equal(guestFlowError({ message: "nope", statusCode: 401 }).title, "Authentication required")
  })
})
