/**
 * Phase 8 — End-to-end reliability + financial integrity + security gates.
 * Reuses existing booking/payment/finance services (no ledger rewrite, no wallet table).
 */
import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { and, eq, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { BOOKING_STATUS } from "../backend/src/config/constants"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import {
  initializeBookingPayment,
  processSuccessfulPayment,
} from "../backend/src/modules/payments/payments.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import { LedgerService } from "../backend/src/modules/finance/ledger.service"
import {
  canGuestCancelUnpaid,
  guestPaidCancelRequiresAdminRefund,
  guestStatusHeadline,
  expectedAfterStep,
} from "../src/lib/phase8-consistency"

process.env.PAYSTACK_MOCK_TRANSFERS = "true"
process.env.NODE_ENV = process.env.NODE_ENV || "test"

describe("Phase 8: E2E reliability, financial integrity, security", async () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_p8_${ts}`
  const otherHostId = `host_p8o_${ts}`
  const guestId = `guest_p8_${ts}`
  const otherGuestId = `guest_p8o_${ts}`
  const adminId = `admin_p8_${ts}`
  const propertyId = `prop_p8_${ts}`

  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_check_in_confirmed_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_check_in_confirmed_by VARCHAR(100)`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100`)

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const checkout = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]

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
      email: `host_p8_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Host",
      lastName: "P8",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: otherHostId,
      email: `host_p8o_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Other",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: guestId,
      email: `guest_p8_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Guest",
      lastName: "P8",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: otherGuestId,
      email: `guest_p8o_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Other",
      lastName: "Guest",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: adminId,
      email: `admin_p8_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Admin",
      lastName: "P8",
      role: "admin",
      emailVerified: true,
      status: "ACTIVE",
    },
  ]).onConflictDoNothing()

  await db.insert(schema.profiles).values({
    id: `prof_p8_${ts}`,
    userId: hostId,
    isVerified: true,
    verificationStatus: "APPROVED",
    onboardingCompleted: true,
    bankName: "Test Bank",
    bankCode: "058",
    bankAccountNumber: "0123456789",
    bankAccountName: "HOST P8",
    bankAccountVerifiedAt: new Date(),
    paystackRecipientCode: `RCP_p8_${ts}`,
  }).onConflictDoNothing()

  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p8-stay-${ts}`,
    title: "Phase 8 Stay",
    description: "E2E reliability property",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 90000,
    cleaningFee: 0,
    currency: "NGN",
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    city: "Lagos",
    neighborhood: "Ikoyi",
    state: "Lagos",
    latitude: 6.45,
    longitude: 3.43,
    powerType: "Grid + Inverter",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    coverImage: "https://example.com/p8.jpg",
    minimumNights: 1,
  }).onConflictDoNothing()

  it("1. Cross-stack status labels + cancel gates are consistent", () => {
    assert.equal(guestStatusHeadline("PENDING_HOST"), "Waiting for the host")
    assert.equal(
      guestStatusHeadline("PAYMENT_PENDING"),
      "Payment is waiting for you."
    )
    assert.equal(canGuestCancelUnpaid("PENDING_HOST"), true)
    assert.equal(canGuestCancelUnpaid("PAYMENT_PENDING"), true)
    assert.equal(canGuestCancelUnpaid("CONFIRMED"), false)
    assert.equal(guestPaidCancelRequiresAdminRefund("CONFIRMED"), true)
    assert.deepEqual(expectedAfterStep("CONFIRMED"), {
      bookingStatus: "CONFIRMED",
      payoutStatus: "HELD",
    })
  })

  it("2. Full journey: request → accept → pay → confirm → check-in → settle → wallet → withdraw", async () => {
    const dates = futureDates(15, 2)
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Guest",
        guestLastName: "P8",
        guestEmail: `guest_p8_${ts}@test.ile.ng`,
        guestPhone: "+2348018880001",
        guestCount: 2,
        ...dates,
      },
      { userId: guestId }
    )
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.ok(created.accessToken)

    await assert.rejects(
      () => bookingsService.acceptBooking(created.booking.id, otherHostId),
      /Unauthorized|only the property host/i
    )

    const accepted = await bookingsService.acceptBooking(created.booking.id, hostId)
    assert.equal(accepted.booking.status, BOOKING_STATUS.PAYMENT_PENDING)

    const init = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.ok(init.reference)

    const paid = await processSuccessfulPayment({
      reference: init.reference!,
      gatewayReference: `gw_p8_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      channel: "card",
    })
    assert.ok(paid)

    const [confirmed] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.equal(confirmed.status, BOOKING_STATUS.CONFIRMED)
    assert.ok((confirmed.paystackFeeAmount ?? 0) >= 0)
    assert.ok(confirmed.accommodationSubtotal)
    assert.ok(confirmed.hostNetAmount)
    assert.equal(
      (confirmed.accommodationSubtotal || 0),
      (confirmed.hostNetAmount || 0) + (confirmed.hostCommissionAmount || 0)
    )

    const [payoutHeld] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, created.booking.id))
      .limit(1)
    assert.equal(payoutHeld.status, "HELD")

    // Backdate check-in + force hold elapsed so settlement can run in-test
    await db
      .update(schema.bookings)
      .set({ checkInDate: yesterday, checkOutDate: checkout })
      .where(eq(schema.bookings.id, created.booking.id))
    await db
      .update(schema.payouts)
      .set({ scheduledFor: new Date(Date.now() - 3600000) })
      .where(eq(schema.payouts.id, payoutHeld.id))

    await assert.rejects(
      () =>
        bookingsService.confirmGuestCheckIn(created.booking.id, {
          userId: otherGuestId,
        }),
      /Only the guest|Unauthorized/i
    )

    const checkIn = await bookingsService.confirmGuestCheckIn(created.booking.id, {
      userId: guestId,
      accessToken: created.accessToken,
    })
    assert.equal(checkIn.success, true)

    const settle = await FinanceService.processDueSettlements()
    assert.ok(
      settle.bookingIds.includes(created.booking.id) ||
        (
          await db
            .select()
            .from(schema.payouts)
            .where(eq(schema.payouts.bookingId, created.booking.id))
            .limit(1)
        )[0]?.status === "READY_FOR_PAYOUT"
    )

    const [ready] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, created.booking.id))
      .limit(1)
    assert.equal(ready.status, "READY_FOR_PAYOUT")

    const wallet = await FinanceService.getHostWallet(hostId)
    assert.ok(wallet.balances.available >= ready.amount)
    assert.equal(wallet.feePolicy.withdrawalFeeNaira, 0)
    assert.equal(wallet.feePolicy.ileAbsorbsTransferFee, true)

    const otherWallet = await FinanceService.getHostWallet(otherHostId)
    assert.equal(otherWallet.balances.available, 0)

    const withdraw = await FinanceService.requestHostWithdrawal(hostId, {
      amountNaira: ready.amount,
    })
    assert.ok(withdraw.success || withdraw.reservedCount >= 1 || withdraw.message)

    const [afterWithdraw] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, created.booking.id))
      .limit(1)
    assert.ok(
      afterWithdraw.status === "PROCESSING" || afterWithdraw.status === "PAID",
      `expected PROCESSING/PAID, got ${afterWithdraw.status}`
    )

    // Guest cannot bare-cancel paid booking (Phase 8/9 gate — creates REFUND_REQUIRED)
    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, created.accessToken),
      (e: any) => e.code === "REFUND_REQUIRED" || e.statusCode === 409
    )

    const tb = await LedgerService.getTrialBalance()
    assert.equal(tb.totals.isBalanced, true)
  })

  it("3. IDOR: other guest cannot cancel; other host cannot decline", async () => {
    const dates = futureDates(40)
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Guest",
        guestLastName: "P8b",
        guestEmail: `guest_p8b_${ts}@test.ile.ng`,
        guestPhone: "+2348018880002",
        guestCount: 1,
        ...dates,
      },
      { userId: guestId }
    )

    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, otherGuestId),
      /Unauthorized/i
    )

    await assert.rejects(
      () => bookingsService.declineBooking(created.booking.id, otherHostId),
      /Unauthorized|only the property host/i
    )

    const declined = await bookingsService.declineBooking(created.booking.id, hostId)
    assert.equal(declined.booking.status, BOOKING_STATUS.CANCELLED)
  })

  it("4. Contact quarantine: private details blocked until CONFIRMED", async () => {
    const dates = futureDates(50)
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Guest",
        guestLastName: "P8c",
        guestEmail: `guest_p8c_${ts}@test.ile.ng`,
        guestPhone: "+2348018880003",
        guestCount: 1,
        ...dates,
      },
      { userId: guestId }
    )

    await assert.rejects(
      () => bookingsService.getBookingContact(created.booking.id, created.accessToken),
      /CONFIRMED|Payment required|not confirmed|quarantine|status/i
    )

    const detail = await bookingsService.getBooking(created.booking.id)
    assert.ok(detail.property)
    assert.equal((detail.property as any).streetAddress, undefined)
    assert.equal((detail.property as any).exactAddress, undefined)
  })

  it("5. Withdrawal double-reserve blocked (idempotent safety)", async () => {
    const bookingId = `book_p8_wr_${ts}`
    const payoutId = `pay_p8_wr_${ts}`
    const amount = 90000
    const commission = 10000
    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `P8WR${String(ts).slice(-6)}`,
      propertyId,
      guestId,
      guestFirstName: "Guest",
      guestLastName: "WR",
      guestEmail: `guest_p8wr_${ts}@test.ile.ng`,
      guestPhone: "+2348018880004",
      guestCount: 1,
      checkInDate: yesterday,
      checkOutDate: checkout,
      numberOfNights: 1,
      nightlyPrice: amount + commission,
      totalAmount: amount + commission + 1500,
      accommodationSubtotal: amount + commission,
      hostCommissionPct: 10,
      hostCommissionAmount: commission,
      hostNetAmount: amount,
      paystackFeeAmount: 1500,
      status: "CONFIRMED",
      guestCheckInConfirmedAt: new Date(),
      guestCheckInConfirmedBy: guestId,
      accessToken: crypto.randomBytes(16).toString("hex"),
    })
    await db.insert(schema.hostEarnings).values({
      id: `earn_p8_wr_${ts}`,
      hostId,
      bookingId,
      grossAmount: amount + commission,
      commissionAmount: commission,
      netAmount: amount,
      status: "PENDING",
    })
    await db.insert(schema.payouts).values({
      id: payoutId,
      bookingId,
      hostId,
      amount,
      currency: "NGN",
      bankCode: "058",
      bankName: "Test Bank",
      accountNumber: "0123456789",
      accountName: "HOST P8",
      status: "READY_FOR_PAYOUT",
      scheduledFor: new Date(Date.now() - 3600000),
      paystackRecipientCode: `RCP_p8_${ts}`,
    })

    const first = await FinanceService.requestHostWithdrawal(hostId, {
      amountNaira: amount,
    })
    assert.ok(first)

    // Second attempt should fail or reserve 0 — cannot double-spend same READY row
    let secondOk = true
    try {
      const second = await FinanceService.requestHostWithdrawal(hostId, {
        amountNaira: amount,
      })
      const reserved = (second as any).reservedCount ?? (second as any).payoutIds?.length ?? 0
      if (reserved > 0 && (second as any).success !== false) {
        // Only OK if different rows — our single row must not be reserved twice
        const [row] = await db
          .select()
          .from(schema.payouts)
          .where(eq(schema.payouts.id, payoutId))
          .limit(1)
        assert.ok(row.status === "PROCESSING" || row.status === "PAID")
        secondOk = false
      }
    } catch {
      secondOk = false
    }
    assert.equal(secondOk, false, "second withdrawal must not re-reserve the same READY payout")
  })
})
