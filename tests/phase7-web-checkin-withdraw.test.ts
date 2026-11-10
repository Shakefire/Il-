/**
 * Phase 7 web UI / client integration tests (no Playwright in repo).
 * Covers guest check-in CTA rules + host withdraw validation + mocked api client.
 */
import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import {
  canConfirmGuestCheckIn,
  validateHostWithdrawRequest,
} from "../src/lib/phase7-guest-host-ui"

describe("Phase 7 web: check-in CTA + withdraw UI (mocked)", () => {
  it("eligible CONFIRMED booking on/after check-in shows CTA", () => {
    assert.equal(
      canConfirmGuestCheckIn(
        {
          status: "CONFIRMED",
          checkInDate: "2026-11-01",
          guestCheckInConfirmedAt: null,
        },
        "2026-11-08"
      ),
      true
    )
  })

  it("unauthorized / wrong lifecycle states hide CTA", () => {
    assert.equal(
      canConfirmGuestCheckIn({
        status: "PENDING_HOST",
        checkInDate: "2026-11-01",
      }, "2026-11-08"),
      false
    )
    assert.equal(
      canConfirmGuestCheckIn({
        status: "CONFIRMED",
        checkInDate: "2099-01-01",
      }, "2026-11-08"),
      false
    )
    assert.equal(
      canConfirmGuestCheckIn({
        status: "CONFIRMED",
        checkInDate: "2026-11-01",
        guestCheckInConfirmedAt: "2026-11-01T12:00:00.000Z",
      }, "2026-11-08"),
      false
    )
    assert.equal(
      canConfirmGuestCheckIn({
        status: "CANCELLED",
        checkInDate: "2026-11-01",
      }, "2026-11-08"),
      false
    )
  })

  it("withdraw validation: bank, insufficient, held-only funds", () => {
    const noBank = validateHostWithdrawRequest({
      availableNaira: 50000,
      bankVerified: false,
    })
    assert.equal(noBank.ok, false)
    if (!noBank.ok) assert.equal(noBank.code, "BANK_REQUIRED")

    const heldOnly = validateHostWithdrawRequest({
      availableNaira: 0,
      pendingNaira: 81000,
      bankVerified: true,
    })
    assert.equal(heldOnly.ok, false)
    if (!heldOnly.ok) assert.equal(heldOnly.code, "FUNDS_HELD")

    const insufficient = validateHostWithdrawRequest({
      availableNaira: 72000,
      requestedNaira: 999999,
      bankVerified: true,
    })
    assert.equal(insufficient.ok, false)
    if (!insufficient.ok) assert.equal(insufficient.code, "INSUFFICIENT_AVAILABLE")

    const ok = validateHostWithdrawRequest({
      availableNaira: 72000,
      requestedNaira: 72000,
      bankVerified: true,
    })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.amountNaira, 72000)
  })

  describe("api client mocked fetch", () => {
    const originalFetch = globalThis.fetch
    let lastUrl = ""
    let lastInit: RequestInit | undefined
    let nextResponse: { status: number; body: unknown } = {
      status: 200,
      body: {},
    }

    before(() => {
      // Avoid AuthContext / window cookie paths — getAuthHeader reads localStorage when present
      ;(globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
      globalThis.fetch = (async (input: any, init?: RequestInit) => {
        lastUrl = String(input)
        lastInit = init
        return {
          ok: nextResponse.status >= 200 && nextResponse.status < 300,
          status: nextResponse.status,
          async json() {
            return nextResponse.body
          },
        } as Response
      }) as typeof fetch
    })

    after(() => {
      globalThis.fetch = originalFetch
    })

    it("confirmCheckIn success + unauthorized rejection", async () => {
      const { api } = await import("../src/lib/api")

      nextResponse = {
        status: 200,
        body: {
          success: true,
          guestCheckInConfirmedAt: "2026-11-01T10:00:00.000Z",
          message: "Check-in confirmed",
        },
      }
      const ok = await api.confirmCheckIn("book_1", "tok_1")
      assert.match(lastUrl, /confirm-check-in/)
      assert.equal(lastInit?.method, "POST")
      assert.equal(ok.success, true)

      nextResponse = {
        status: 403,
        body: {
          error: "Only the guest on this booking can confirm check-in.",
          code: "FORBIDDEN",
        },
      }
      await assert.rejects(
        () => api.confirmCheckIn("book_2"),
        /Only the guest/
      )
    })

    it("requestHostWithdrawal maps insufficient / held errors", async () => {
      const { api } = await import("../src/lib/api")

      nextResponse = {
        status: 400,
        body: {
          error: "Requested ₦999999 exceeds available ₦72000.",
          code: "INSUFFICIENT_AVAILABLE",
        },
      }
      await assert.rejects(
        () => api.requestHostWithdrawal(999999),
        /exceeds available/
      )

      nextResponse = {
        status: 400,
        body: {
          error: "No available earnings to withdraw.",
          code: "NO_AVAILABLE_BALANCE",
        },
      }
      await assert.rejects(
        () => api.requestHostWithdrawal(1000),
        /No available earnings/
      )

      nextResponse = {
        status: 200,
        body: { success: true, message: "Withdrawal submitted." },
      }
      const ok = await api.requestHostWithdrawal(72000)
      assert.equal(ok.success, true)
      assert.match(lastUrl, /wallet\/withdraw/)
    })
  })
})
