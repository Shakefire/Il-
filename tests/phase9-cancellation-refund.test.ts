/**
 * Phase 9 — Approved cancellation / refund / reconciliation rules.
 */
import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { BOOKING_STATUS, CANCELLATION_REASON } from "../backend/src/config/constants"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import {
  initializeBookingPayment,
  processSuccessfulPayment,
} from "../backend/src/modules/payments/payments.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import { LedgerService } from "../backend/src/modules/finance/ledger.service"

process.env.PAYSTACK_MOCK_TRANSFERS = "true"
process.env.NODE_ENV = process.env.NODE_ENV || "test"

describe("Phase 9: Cancellation, refund request, reconciliation", async () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_p9_${ts}`
  const guestId = `guest_p9_${ts}`
  const otherGuestId = `guest_p9o_${ts}`
  const adminId = `admin_p9_${ts}`
  const propertyId = `prop_p9_${ts}`

  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100`)

  const futureDates = (offsetDays: number, nights = 2) => {
    const inD = new Date(Date.now() + offsetDays * 86400000)
    const outD = new Date(Date.now() + (offsetDays + nights) * 86400000)
    return {
      checkInDate: inD.toISOString().split("T")[0],
      checkOutDate: outD.toISOString().split("T")[0],
    }
  }

  await db.insert(schema.users).values([
    {
      id: hostId,
      email: `${hostId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Host",
      lastName: "P9",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: guestId,
      email: `${guestId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Guest",
      lastName: "P9",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: otherGuestId,
      email: `${otherGuestId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Other",
      lastName: "Guest",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: adminId,
      email: `${adminId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Admin",
      lastName: "P9",
      role: "admin",
      emailVerified: true,
      status: "ACTIVE",
    },
  ]).onConflictDoNothing()

  await db.insert(schema.profiles).values({
    id: `prof_${hostId}`,
    userId: hostId,
    isVerified: true,
    verificationStatus: "APPROVED",
    onboardingCompleted: true,
  }).onConflictDoNothing()

  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p9-stay-${ts}`,
    title: "Phase 9 Stay",
    description: "Cancel/refund test property",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 90000,
    cleaningFee: 0,
    currency: "NGN",
    maxGuests: 4,
    city: "Lagos",
    neighborhood: "VI",
    state: "Lagos",
    latitude: 6.43,
    longitude: 3.42,
    powerType: "Grid + Inverter",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    coverImage: "https://example.com/p9.jpg",
    minimumNights: 1,
  }).onConflictDoNothing()

  const createUnpaid = async (offset: number, emailSuffix: string) => {
    return bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Guest",
        guestLastName: emailSuffix,
        guestEmail: `g_${emailSuffix}_${ts}@test.ile.ng`,
        guestPhone: "+2348019990001",
        guestCount: 1,
        ...futureDates(offset),
      },
      { userId: guestId }
    )
  }

  it("1. Guest cancel PENDING_HOST: free cancel, release hold, no refund", async () => {
    const created = await createUnpaid(60, "ph")
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST)
    const cancelled = await bookingsService.cancelBooking(
      created.booking.id,
      created.accessToken,
      "guest pre-accept cancel"
    )
    assert.equal(cancelled.success, true)
    assert.equal(cancelled.booking.status, BOOKING_STATUS.CANCELLED)

    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id))
    assert.equal(blocks.length, 0)

    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 0)
  })

  it("2. Guest cancel PAYMENT_PENDING: free cancel, release hold, no refund", async () => {
    const created = await createUnpaid(70, "pp")
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const cancelled = await bookingsService.cancelBooking(
      created.booking.id,
      created.accessToken
    )
    assert.equal(cancelled.booking.status, BOOKING_STATUS.CANCELLED)
    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 0)
  })

  it("3. Guest cancel CONFIRMED: no bare-cancel; REQUESTED refund = paid − fee; booking stays CONFIRMED", async () => {
    const created = await createUnpaid(80, "cf")
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const init = await initializeBookingPayment(created.booking.id, created.accessToken)
    await processSuccessfulPayment({
      reference: init.reference!,
      gatewayReference: `gw_p9_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
    })

    const [confirmed] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.equal(confirmed.status, BOOKING_STATUS.CONFIRMED)

    let refundPayload: any = null
    await assert.rejects(
      () =>
        bookingsService.cancelBooking(
          created.booking.id,
          created.accessToken,
          CANCELLATION_REASON.GUEST_REFUND_REQUESTED_AFTER_PAYMENT
        ),
      (e: any) => {
        refundPayload = e
        return e.code === "REFUND_REQUIRED" && e.statusCode === 409
      }
    )

    assert.ok(refundPayload.refund)
    const fee = confirmed.paystackFeeAmount || 0
    const expected = Math.max(0, (confirmed.totalAmount || 0) - fee)
    assert.equal(refundPayload.refund.refundableAmount, expected)
    assert.equal(refundPayload.refund.nonRefundableProcessingFee, fee)
    assert.equal(refundPayload.refund.status, "REQUESTED")

    const [still] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.equal(still.status, BOOKING_STATUS.CONFIRMED, "must not bare-cancel paid stay")

    // Idempotent second request keeps single open refund
    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, created.accessToken),
      (e: any) => e.code === "REFUND_REQUIRED"
    )
    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.filter((r) => r.status === "REQUESTED" || r.status === "APPROVED").length, 1)

    const recovery = await bookingsService.getBooking(created.booking.id)
    assert.equal(recovery.recovery.guestRefundPending, true)
    assert.equal(recovery.recovery.resolutionPending, true)
    assert.ok(recovery.recovery.refund)

    // Unauthorized guest cannot open refund
    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, otherGuestId),
      /Unauthorized/i
    )
  })

  it("4. Admin approve → reject path and approve → process path; ledger stays balanced", async () => {
    const created = await createUnpaid(90, "adm")
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const init = await initializeBookingPayment(created.booking.id, created.accessToken)
    await processSuccessfulPayment({
      reference: init.reference!,
      gatewayReference: `gw_p9_adm_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
    })

    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, created.accessToken),
      (e: any) => e.code === "REFUND_REQUIRED"
    )

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(
        and(
          eq(schema.refunds.bookingId, created.booking.id),
          eq(schema.refunds.status, "REQUESTED")
        )
      )
      .limit(1)
    assert.ok(refund)

    // Reject path on a duplicate booking's sibling — create second booking for reject
    const created2 = await createUnpaid(100, "rej")
    await bookingsService.acceptBooking(created2.booking.id, hostId)
    const init2 = await initializeBookingPayment(created2.booking.id, created2.accessToken)
    await processSuccessfulPayment({
      reference: init2.reference!,
      gatewayReference: `gw_p9_rej_${ts}`,
      paidAmountNaira: created2.booking.totalAmount,
      currency: "NGN",
    })
    await assert.rejects(
      () => bookingsService.cancelBooking(created2.booking.id, created2.accessToken),
      (e: any) => e.code === "REFUND_REQUIRED"
    )
    const [refund2] = await db
      .select()
      .from(schema.refunds)
      .where(
        and(
          eq(schema.refunds.bookingId, created2.booking.id),
          eq(schema.refunds.status, "REQUESTED")
        )
      )
      .limit(1)
    const rejected = await FinanceService.rejectRefund(adminId, refund2.id, "Out of policy")
    assert.equal(rejected.status, "REJECTED")

    // Approve + process (no live Paystack key → ledger path without gateway call)
    const approved = await FinanceService.approveRefund(adminId, refund.id)
    assert.equal(approved.status, "APPROVED")

    // Avoid live Paystack: clear secret for this process step if set — use processApprovedRefund
    // which posts ledger when key absent for payment without gateway ref handling.
    const processed = await FinanceService.processApprovedRefund(adminId, refund.id, {
      paystackRefundId: `mock_ref_${ts}`,
    })
    assert.ok(processed)

    const [refundDone] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, refund.id))
      .limit(1)
    assert.equal(refundDone.status, "PROCESSED")

    const allRefundsForBooking = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(
      allRefundsForBooking.length,
      1,
      "processApprovedRefund must not insert a duplicate PROCESSED refund row"
    )
    assert.equal(allRefundsForBooking[0].id, refund.id)

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, created.booking.id))
      .limit(1)
    if (payout) {
      assert.equal(payout.status, "CANCELLED")
    }

    const tb = await LedgerService.getTrialBalance()
    assert.equal(tb.totals.isBalanced, true)
  })

  it("5. Host decline PENDING_HOST still CANCELLED with no refund (Phase 3 behavior)", async () => {
    const created = await createUnpaid(110, "hd")
    const declined = await bookingsService.declineBooking(created.booking.id, hostId)
    assert.equal(declined.booking.status, BOOKING_STATUS.CANCELLED)
    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 0)
  })

  it("6. Fee policy interim remains Ile absorbs ₦0 host withdrawal fee", async () => {
    const wallet = await FinanceService.getHostWallet(hostId)
    assert.equal(wallet.feePolicy.withdrawalFeeNaira, 0)
    assert.equal(wallet.feePolicy.ileAbsorbsTransferFee, true)
  })
})
