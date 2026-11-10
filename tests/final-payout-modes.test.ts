import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { eq, and, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import { adminService } from "../backend/src/modules/admin/admin.service"
import {
  initializeBookingPayment,
  processSuccessfulPayment,
} from "../backend/src/modules/payments/payments.service"

process.env.PAYSTACK_MOCK_TRANSFERS = "true"
process.env.NODE_ENV = process.env.NODE_ENV || "test"

const futureDates = (startOffsetDays: number, nights: number) => {
  const checkIn = new Date(Date.now() + startOffsetDays * 86400000)
  const checkOut = new Date(checkIn.getTime() + nights * 86400000)
  const iso = (d: Date) => d.toISOString().split("T")[0]
  return { checkInDate: iso(checkIn), checkOutDate: iso(checkOut) }
}

describe("FINAL: Host payout AUTOMATIC | MANUAL modes", async () => {
  const db = getDb()
  const ts = Date.now()
  const adminId = `admin_fpm_${ts}`
  const hostAuto = `host_fpm_a_${ts}`
  const hostManual = `host_fpm_m_${ts}`
  const hostNoBank = `host_fpm_nb_${ts}`
  const guestAuto = `guest_fpm_a_${ts}`
  const guestManual = `guest_fpm_m_${ts}`
  const guestNoBank = `guest_fpm_nb_${ts}`
  const propAuto = `prop_fpm_a_${ts}`
  const propManual = `prop_fpm_m_${ts}`
  const propNoBank = `prop_fpm_nb_${ts}`

  // Additive only — aligns Drizzle schema with DB when 0005/0006 not formally migrated.
  // Does not delete data. Still not a substitute for reviewed prod migration apply.
  await db.execute(
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_attempts INT NOT NULL DEFAULT 0`
  )
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_sent_at TIMESTAMPTZ`)
  await db.execute(
    sql`ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS host_payout_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL'`
  )
  await db.execute(
    sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL'`
  )
  await db.execute(sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS exception_code VARCHAR(60)`)
  await db.execute(sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS exception_reason TEXT`)

  await db
    .insert(schema.users)
    .values([
      {
        id: adminId,
        email: `admin_fpm_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Admin",
        lastName: "FPM",
        role: "admin",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: hostAuto,
        email: `host_fpm_a_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Host",
        lastName: "Auto",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: hostManual,
        email: `host_fpm_m_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Host",
        lastName: "Manual",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: hostNoBank,
        email: `host_fpm_nb_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Host",
        lastName: "NoBank",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: guestAuto,
        email: `guest_fpm_a_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Guest",
        lastName: "Auto",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: guestManual,
        email: `guest_fpm_m_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Guest",
        lastName: "Manual",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: guestNoBank,
        email: `guest_fpm_nb_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Guest",
        lastName: "NoBank",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      },
    ])
    .onConflictDoNothing()

  await db
    .insert(schema.profiles)
    .values([
      {
        id: `prof_fpm_a_${ts}`,
        userId: hostAuto,
        isVerified: true,
        verificationStatus: "APPROVED",
        onboardingCompleted: true,
        bankName: "Test Bank",
        bankCode: "058",
        bankAccountNumber: "0123456789",
        bankAccountName: "HOST AUTO",
        bankAccountVerifiedAt: new Date(),
        paystackRecipientCode: `RCP_fpm_a_${ts}`,
      },
      {
        id: `prof_fpm_m_${ts}`,
        userId: hostManual,
        isVerified: true,
        verificationStatus: "APPROVED",
        onboardingCompleted: true,
        bankName: "Test Bank",
        bankCode: "058",
        bankAccountNumber: "0987654321",
        bankAccountName: "HOST MANUAL",
        bankAccountVerifiedAt: new Date(),
        paystackRecipientCode: `RCP_fpm_m_${ts}`,
      },
      {
        id: `prof_fpm_nb_${ts}`,
        userId: hostNoBank,
        isVerified: true,
        verificationStatus: "APPROVED",
        onboardingCompleted: true,
      },
    ])
    .onConflictDoNothing()

  const insertProperty = async (id: string, hostId: string, slug: string) => {
    await db
      .insert(schema.properties)
      .values({
        id,
        hostId,
        slug,
        title: `FPM Stay ${slug}`,
        description: "Payout mode test property",
        propertyType: "Apartment",
        pricePerNight: 100000,
        hostBasePrice: 90000,
        cleaningFee: 0,
        currency: "NGN",
        city: "Abuja",
        neighborhood: "Maitama",
        state: "FCT",
        latitude: 9.08,
        longitude: 7.49,
        powerType: "Solar + Inverter",
        bedrooms: 2,
        bathrooms: 2,
        maxGuests: 4,
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        coverImage: "https://example.com/p.jpg",
      })
      .onConflictDoNothing()
  }

  await insertProperty(propAuto, hostAuto, `fpm-auto-${ts}`)
  await insertProperty(propManual, hostManual, `fpm-manual-${ts}`)
  await insertProperty(propNoBank, hostNoBank, `fpm-nobank-${ts}`)

  await db
    .insert(schema.platformSettings)
    .values({
      id: "default",
      defaultHostCommissionPct: 10,
      defaultHostPayoutPct: 100,
      payoutHoldHours: 24,
      hostPayoutMode: "MANUAL",
      updatedBy: adminId,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()

  let dayOffset = 40

  const createPaidBooking = async (opts: {
    hostId: string
    guestId: string
    propertyId: string
    suffix: string
  }) => {
    dayOffset += 3
    const dates = futureDates(dayOffset, 2)
    const created = await bookingsService.createBooking(
      {
        propertyId: opts.propertyId,
        guestFirstName: "Guest",
        guestLastName: opts.suffix,
        guestEmail: `${opts.suffix}_${ts}@test.ile.ng`,
        guestPhone: "+2348012345678",
        guestCount: 2,
        ...dates,
      },
      { userId: opts.guestId }
    )

    await bookingsService.acceptBooking(created.booking.id, opts.hostId)
    const init = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.ok(init.reference)

    const paymentResult = await processSuccessfulPayment({
      reference: init.reference!,
      gatewayReference: `gw_${opts.suffix}_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })

    return { bookingId: created.booking.id, paymentResult, totalAmount: created.booking.totalAmount }
  }

  it("1. MANUAL mode keeps payout HELD after verified payment (check-in still gates)", async () => {
    await adminService.updateSettings({ hostPayoutMode: "MANUAL" }, adminId)
    const { bookingId, paymentResult } = await createPaidBooking({
      hostId: hostManual,
      guestId: guestManual,
      propertyId: propManual,
      suffix: "man",
    })

    assert.equal(paymentResult.success, true)
    assert.equal((paymentResult as any).automaticPayout?.mode, "MANUAL")
    assert.equal((paymentResult as any).automaticPayout?.attempted, false)

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId))
      .limit(1)

    assert.ok(payout)
    assert.equal(payout.status, "HELD")
    assert.equal(payout.payoutMode, "MANUAL")
  })

  it("2. AUTOMATIC mode releases without check-in and initiates mock transfer", async () => {
    await adminService.updateSettings({ hostPayoutMode: "AUTOMATIC" }, adminId)
    const { bookingId, paymentResult } = await createPaidBooking({
      hostId: hostAuto,
      guestId: guestAuto,
      propertyId: propAuto,
      suffix: "auto",
    })

    assert.equal(paymentResult.success, true)
    assert.equal((paymentResult as any).automaticPayout?.mode, "AUTOMATIC")
    assert.equal((paymentResult as any).automaticPayout?.attempted, true)

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId))
      .limit(1)

    assert.ok(payout)
    assert.equal(payout.payoutMode, "AUTOMATIC")
    assert.notEqual(payout.status, "HELD")
    assert.ok(
      payout.status === "PROCESSING" ||
        payout.status === "PAID" ||
        payout.status === "READY_FOR_PAYOUT",
      `unexpected status ${payout.status}`
    )

    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1)
    assert.ok(booking)
    // PO: check-in must NOT block automatic transfer — guest check-in may be null
    assert.equal(booking.guestCheckInConfirmedAt, null)
  })

  it("3. AUTOMATIC with no bank records NO_VERIFIED_BANK exception (not fake success)", async () => {
    await adminService.updateSettings({ hostPayoutMode: "AUTOMATIC" }, adminId)
    const { bookingId } = await createPaidBooking({
      hostId: hostNoBank,
      guestId: guestNoBank,
      propertyId: propNoBank,
      suffix: "nb",
    })

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId))
      .limit(1)

    assert.ok(payout)
    assert.notEqual(payout.status, "PAID")
    assert.equal(payout.exceptionCode, "NO_VERIFIED_BANK")
    assert.equal(payout.status, "READY_FOR_PAYOUT")
  })

  it("4. Mode switch Manual→Auto does not drain historical HELD payouts", async () => {
    await adminService.updateSettings({ hostPayoutMode: "MANUAL" }, adminId)
    const heldBefore = await db
      .select({ id: schema.payouts.id, status: schema.payouts.status })
      .from(schema.payouts)
      .where(and(eq(schema.payouts.hostId, hostManual), eq(schema.payouts.status, "HELD")))

    assert.ok(heldBefore.length >= 1, "need at least one historical MANUAL HELD payout")

    await adminService.updateSettings({ hostPayoutMode: "AUTOMATIC" }, adminId)

    for (const row of heldBefore) {
      const [fresh] = await db
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, row.id))
        .limit(1)
      assert.equal(fresh.status, "HELD")
      assert.equal(fresh.payoutMode, "MANUAL")
    }
  })

  it("5. Idempotent automatic handler does not double-post settlement journal", async () => {
    const [autoPayout] = await db
      .select()
      .from(schema.payouts)
      .where(and(eq(schema.payouts.hostId, hostAuto), eq(schema.payouts.payoutMode, "AUTOMATIC")))
      .limit(1)

    assert.ok(autoPayout)
    await FinanceService.handlePostPaymentPayout(autoPayout.bookingId)
    await FinanceService.handlePostPaymentPayout(autoPayout.bookingId)

    const journals = await db
      .select()
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, autoPayout.bookingId),
          eq(schema.ledgerJournals.eventType, "CHECKIN_RECOGNITION")
        )
      )
    assert.equal(journals.length, 1)
  })

  it("6. MANUAL approve / hold / reject with reason", async () => {
    const [held] = await db
      .select()
      .from(schema.payouts)
      .where(and(eq(schema.payouts.hostId, hostManual), eq(schema.payouts.status, "HELD")))
      .limit(1)

    assert.ok(held)
    // Admin override still requires calendar check-in + hold elapsed (skips guest confirm only).
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    await db
      .update(schema.bookings)
      .set({ checkInDate: yesterday, updatedAt: new Date() })
      .where(eq(schema.bookings.id, held.bookingId))
    await db
      .update(schema.payouts)
      .set({ scheduledFor: new Date(Date.now() - 3600000), updatedAt: new Date() })
      .where(eq(schema.payouts.id, held.id))

    await FinanceService.adminOverrideSettlement(adminId, {
      bookingId: held.bookingId,
      reason: "Test override for manual queue actions",
    })

    const [ready] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, held.id))
      .limit(1)
    assert.equal(ready.status, "READY_FOR_PAYOUT")

    await FinanceService.holdPayout(adminId, ready.id, "Awaiting host KYC refresh")
    const [heldRow] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, ready.id))
      .limit(1)
    assert.equal(heldRow.exceptionCode, "ADMIN_HOLD")

    await assert.rejects(
      () => FinanceService.disbursePayout(adminId, { payoutId: ready.id }),
      /admin hold/i
    )

    await FinanceService.approvePayout(adminId, ready.id, "KYC cleared")
    const [approved] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, ready.id))
      .limit(1)
    assert.equal(approved.exceptionCode, null)
    assert.ok(approved.approvedAt)

    await FinanceService.rejectPayout(adminId, ready.id, "Policy review failed")
    const [rejected] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, ready.id))
      .limit(1)
    assert.equal(rejected.exceptionCode, "ADMIN_REJECTED")
  })
})
