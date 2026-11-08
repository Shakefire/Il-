import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getDb, schema } from "../backend/src/db/client"
import { eq, and, sql } from "drizzle-orm"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import {
  initializeBookingPayment,
  processSuccessfulPayment,
  expireStalePendingBookings,
} from "../backend/src/modules/payments/payments.service"
import { adminService } from "../backend/src/modules/admin/admin.service"
import { BOOKING_STATUS, HOST_RESPONSE, CANCELLATION_REASON } from "../backend/src/config/constants"
import crypto from "crypto"

describe("Phase 3: Reservation lifecycle, host accept/decline, payment gates", async () => {
  const db = getDb()
  const ts = Date.now()
  let hostId = `host_p3_${ts}`
  let guestHostId = `host_p3b_${ts}`
  let propertyId = `prop_p3_${ts}`
  let propertyId2 = `prop_p3b_${ts}`

  // Ensure Phase 3 columns exist (additive)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_responded_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response VARCHAR(30)`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS default_host_payout_pct INT NOT NULL DEFAULT 100`)
  await db.execute(sql`
    INSERT INTO platform_settings (id, default_host_commission_pct, default_host_payout_pct, payout_hold_hours, updated_at)
    VALUES ('default', 10, 100, 24, NOW())
    ON CONFLICT (id) DO UPDATE SET default_host_payout_pct = COALESCE(platform_settings.default_host_payout_pct, 100)
  `)

  const futureDates = (offsetDays: number, nights = 2) => {
    const inD = new Date(Date.now() + offsetDays * 86400000)
    const outD = new Date(Date.now() + (offsetDays + nights) * 86400000)
    return {
      checkInDate: inD.toISOString().split("T")[0],
      checkOutDate: outD.toISOString().split("T")[0],
    }
  }

  const seedHostProperty = async (idSuffix: string, host: string, prop: string, slug: string) => {
    await db.insert(schema.users).values({
      id: host,
      email: `${idSuffix}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Host",
      lastName: idSuffix,
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing()

    await db.insert(schema.profiles).values({
      id: `prof_${idSuffix}`,
      userId: host,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    }).onConflictDoNothing()

    await db.insert(schema.properties).values({
      id: prop,
      hostId: host,
      slug,
      title: `Phase 3 Stay ${idSuffix}`,
      description: "Lifecycle test property",
      propertyType: "Apartment",
      pricePerNight: 100000,
      hostBasePrice: 90000,
      cleaningFee: 0,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      maxGuests: 4,
      minimumNights: 1,
      powerType: "Solar + Inverter",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    }).onConflictDoNothing()
  }

  await seedHostProperty(`p3a_${ts}`, hostId, propertyId, `p3-a-${ts}`)
  await seedHostProperty(`p3b_${ts}`, guestHostId, propertyId2, `p3-b-${ts}`)

  it("1. Create → PENDING_HOST with 120s deadline, hold, pricing snapshot, no Paystack", async () => {
    const dates = futureDates(200)
    const result = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Okeke",
      guestEmail: `ada_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      guestCount: 2,
      ...dates,
    })

    assert.equal(result.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.ok(result.timers?.hostResponseDeadlineAt)
    assert.equal(result.timers.hostResponseSecondsRemaining, 120)
    assert.equal((result as any).paymentReference, undefined)

    const deadline = new Date(result.booking.hostResponseDeadlineAt || result.timers.hostResponseDeadlineAt).getTime()
    const created = new Date(result.booking.createdAt).getTime()
    assert.ok(Math.abs(deadline - created - 120_000) < 5000, "host deadline ≈ create+120s")

    assert.equal(result.pricing.hostPayoutPct, 100)
    // classic host earnings = 90000 * 2; at 100% payout hostNet = classic
    assert.equal(result.pricing.classicHostEarnings, 180000)
    assert.equal(result.pricing.hostNetAmount, 180000)
    assert.equal(result.pricing.accommodationSubtotal, 200000)

    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, result.booking.id))
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].type, "REQUEST_HOLD")

    const payments = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bookingId, result.booking.id))
    assert.equal(payments.length, 0, "No Paystack/payment row at create")
  })

  it("2. Availability counts PENDING_HOST holds", async () => {
    const dates = futureDates(210)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Bola",
      guestLastName: "Ade",
      guestEmail: `bola_${ts}@test.ile.ng`,
      guestPhone: "+2348022222222",
      guestCount: 1,
      ...dates,
    })
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST)

    const avail = await bookingsService.checkAvailability(
      propertyId,
      dates.checkInDate,
      dates.checkOutDate
    )
    assert.equal(avail.available, false)
    assert.ok(avail.conflictsCount >= 1)
  })

  it("3. Concurrency: only one active overlapping reservation succeeds", async () => {
    const dates = futureDates(220)
    const body = {
      propertyId,
      guestFirstName: "Chi",
      guestLastName: "One",
      guestPhone: "+2348033333333",
      guestCount: 1,
      ...dates,
    }

    const [a, b] = await Promise.allSettled([
      bookingsService.createBooking({ ...body, guestEmail: `chi1_${ts}@test.ile.ng`, guestLastName: "One" }),
      bookingsService.createBooking({ ...body, guestEmail: `chi2_${ts}@test.ile.ng`, guestLastName: "Two" }),
    ])

    const successes = [a, b].filter((r) => r.status === "fulfilled")
    const failures = [a, b].filter((r) => r.status === "rejected")
    assert.equal(successes.length, 1, "Exactly one create succeeds")
    assert.equal(failures.length, 1, "Other create conflicts")
    const err: any = (failures[0] as PromiseRejectedResult).reason
    assert.equal(err.statusCode || err.code === "DATE_CONFLICT" ? 409 : err.statusCode, 409)
  })

  it("4. Host accept → PAYMENT_PENDING + payment deadline; idempotent re-accept", async () => {
    const dates = futureDates(230)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Demi",
      guestLastName: "Ola",
      guestEmail: `demi_${ts}@test.ile.ng`,
      guestPhone: "+2348044444444",
      guestCount: 1,
      ...dates,
    })

    const accepted = await bookingsService.acceptBooking(created.booking.id, hostId)
    assert.equal(accepted.booking.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.equal(accepted.booking.hostResponse, HOST_RESPONSE.ACCEPTED)
    assert.ok(accepted.paymentDeadlineAt)
    const payDeadline = new Date(accepted.paymentDeadlineAt).getTime()
    const responded = new Date(accepted.booking.hostRespondedAt!).getTime()
    assert.ok(Math.abs(payDeadline - responded - 10 * 60_000) < 5000)

    const again = await bookingsService.acceptBooking(created.booking.id, hostId)
    assert.equal(again.idempotent, true)
    assert.equal(again.booking.status, BOOKING_STATUS.PAYMENT_PENDING)
  })

  it("5. Non-host cannot accept; accept after deadline fails", async () => {
    const dates = futureDates(240)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Efe",
      guestLastName: "Ojo",
      guestEmail: `efe_${ts}@test.ile.ng`,
      guestPhone: "+2348055555555",
      guestCount: 1,
      ...dates,
    })

    await assert.rejects(
      () => bookingsService.acceptBooking(created.booking.id, guestHostId),
      (e: any) => e.statusCode === 403
    )

    // Force deadline into the past
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 1000) })
      .where(eq(schema.bookings.id, created.booking.id))

    await assert.rejects(
      () => bookingsService.acceptBooking(created.booking.id, hostId),
      (e: any) => e.code === "HOST_WINDOW_EXPIRED" || e.statusCode === 409
    )
  })

  it("6. Host decline → CANCELLED HOST_DECLINED, hold released, no refund", async () => {
    const dates = futureDates(250)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Femi",
      guestLastName: "Bello",
      guestEmail: `femi_${ts}@test.ile.ng`,
      guestPhone: "+2348066666666",
      guestCount: 1,
      ...dates,
    })

    const declined = await bookingsService.declineBooking(created.booking.id, hostId, "Dates blocked")
    assert.equal(declined.booking.status, BOOKING_STATUS.CANCELLED)
    assert.equal(declined.booking.hostResponse, HOST_RESPONSE.DECLINED)
    assert.match(declined.booking.cancellationReason || "", /HOST_DECLINED/)

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

    const avail = await bookingsService.checkAvailability(
      propertyId,
      dates.checkInDate,
      dates.checkOutDate
    )
    assert.equal(avail.available, true)
  })

  it("7. Payment init gated: PENDING_HOST rejected; PAYMENT_PENDING requires token + deadline", async () => {
    const dates = futureDates(260)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Gani",
      guestLastName: "Musa",
      guestEmail: `gani_${ts}@test.ile.ng`,
      guestPhone: "+2348077777777",
      guestCount: 1,
      ...dates,
    })

    const blocked = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.equal(blocked.success, false)
    assert.match(blocked.error || "", /host accepts/i)

    await bookingsService.acceptBooking(created.booking.id, hostId)

    const noToken = await initializeBookingPayment(created.booking.id)
    assert.equal(noToken.success, false)

    const ok = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.equal(ok.success, true)
    assert.ok(ok.reference)
    assert.equal(ok.amount, created.booking.totalAmount)

    // Expire payment window then reject init
    await db
      .update(schema.bookings)
      .set({ paymentDeadlineAt: new Date(Date.now() - 1000) })
      .where(eq(schema.bookings.id, created.booking.id))

    const lateInit = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.equal(lateInit.success, false)
    assert.match(lateInit.error || "", /expired/i)
  })

  it("8. Happy path pay confirm after accept; late pay after cancel flags recon", async () => {
    const dates = futureDates(270)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Hana",
      guestLastName: "Ibe",
      guestEmail: `hana_${ts}@test.ile.ng`,
      guestPhone: "+2348088888888",
      guestCount: 1,
      ...dates,
    })
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const init = await initializeBookingPayment(created.booking.id, created.accessToken)
    assert.equal(init.success, true)

    const paid = await processSuccessfulPayment({
      reference: init.reference,
      gatewayReference: `gw_ok_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal(paid.success, true)
    assert.equal(paid.booking?.status, BOOKING_STATUS.CONFIRMED)

    const earnings = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, created.booking.id))
    assert.equal(earnings.length, 1)
    assert.equal(earnings[0].netAmount, created.booking.hostNetAmount)

    // Late payment scenario on a different booking
    const dates2 = futureDates(280)
    const lateCreated = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Ife",
      guestLastName: "Dan",
      guestEmail: `ife_${ts}@test.ile.ng`,
      guestPhone: "+2348099999999",
      guestCount: 1,
      ...dates2,
    })
    await bookingsService.acceptBooking(lateCreated.booking.id, hostId)
    const lateInit = await initializeBookingPayment(lateCreated.booking.id, lateCreated.accessToken)
    await bookingsService.cancelBooking(
      lateCreated.booking.id,
      lateCreated.accessToken,
      "Guest abandoned"
    )

    const latePay = await processSuccessfulPayment({
      reference: lateInit.reference!,
      gatewayReference: `gw_late_${ts}`,
      paidAmountNaira: lateCreated.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal((latePay as any).reconciliationRequired, true)
    assert.notEqual(latePay.booking?.status, BOOKING_STATUS.CONFIRMED)

    const [bookingRow] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, lateCreated.booking.id))
    assert.equal(bookingRow.status, BOOKING_STATUS.CANCELLED)

    const lateEarnings = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, lateCreated.booking.id))
    assert.equal(lateEarnings.length, 0)

    const reconRefunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, lateCreated.booking.id))
    assert.equal(reconRefunds.length, 1)
    assert.equal(reconRefunds[0].status, "REQUESTED")
    assert.match(reconRefunds[0].reason || "", /LATE_PAYMENT/)
  })

  it("9. Free cancel before pay; paid cancel requires refund path", async () => {
    const dates = futureDates(290)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Jide",
      guestLastName: "Kay",
      guestEmail: `jide_${ts}@test.ile.ng`,
      guestPhone: "+2348001010101",
      guestCount: 1,
      ...dates,
    })
    const cancelled = await bookingsService.cancelBooking(
      created.booking.id,
      created.accessToken
    )
    assert.equal(cancelled.success, true)
    assert.equal(cancelled.booking.status, BOOKING_STATUS.CANCELLED)

    const dates2 = futureDates(300)
    const paidPath = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Kemi",
      guestLastName: "Law",
      guestEmail: `kemi_${ts}@test.ile.ng`,
      guestPhone: "+2348002020202",
      guestCount: 1,
      ...dates2,
    })
    await bookingsService.acceptBooking(paidPath.booking.id, hostId)
    const init = await initializeBookingPayment(paidPath.booking.id, paidPath.accessToken)
    await processSuccessfulPayment({
      reference: init.reference!,
      gatewayReference: `gw_paid_cancel_${ts}`,
      paidAmountNaira: paidPath.booking.totalAmount,
      currency: "NGN",
    })

    await assert.rejects(
      () => bookingsService.cancelBooking(paidPath.booking.id, paidPath.accessToken),
      (e: any) => e.code === "REFUND_REQUIRED" || e.statusCode === 409
    )
  })

  it("10. Expire due PENDING_HOST and PAYMENT_PENDING by absolute deadlines", async () => {
    const dates = futureDates(310)
    const hostWindow = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Lara",
      guestLastName: "Nne",
      guestEmail: `lara_${ts}@test.ile.ng`,
      guestPhone: "+2348003030303",
      guestCount: 1,
      ...dates,
    })
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 2000) })
      .where(eq(schema.bookings.id, hostWindow.booking.id))

    const dates2 = futureDates(320)
    const payWindow = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Mo",
      guestLastName: "Tai",
      guestEmail: `mo_${ts}@test.ile.ng`,
      guestPhone: "+2348004040404",
      guestCount: 1,
      ...dates2,
    })
    await bookingsService.acceptBooking(payWindow.booking.id, hostId)
    await db
      .update(schema.bookings)
      .set({ paymentDeadlineAt: new Date(Date.now() - 2000) })
      .where(eq(schema.bookings.id, payWindow.booking.id))

    const result = await expireStalePendingBookings()
    assert.ok(result.expired >= 2)
    assert.ok((result.hostExpired || 0) >= 1)
    assert.ok((result.paymentExpired || 0) >= 1)

    const [h] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, hostWindow.booking.id))
    const [p] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, payWindow.booking.id))
    assert.equal(h.status, BOOKING_STATUS.CANCELLED)
    assert.equal(h.hostResponse, HOST_RESPONSE.EXPIRED)
    assert.equal(h.cancellationReason, CANCELLATION_REASON.HOST_WINDOW_EXPIRED)
    assert.equal(p.status, BOOKING_STATUS.CANCELLED)
    assert.equal(p.cancellationReason, CANCELLATION_REASON.PAYMENT_WINDOW_EXPIRED)
  })

  it("11. Host payout % snapshot applies to new bookings only (59%)", async () => {
    await adminService.updateSettings({ defaultHostPayoutPct: 59 }, "usr_admin_default")

    const dates = futureDates(330)
    const created = await bookingsService.createBooking({
      propertyId: propertyId2,
      guestFirstName: "Ngo",
      guestLastName: "Zi",
      guestEmail: `ngo_${ts}@test.ile.ng`,
      guestPhone: "+2348005050505",
      guestCount: 1,
      ...dates,
    })

    assert.equal(created.pricing.hostPayoutPct, 59)
    // classic = 90000 * 2 = 180000; 59% = 106200
    assert.equal(created.pricing.classicHostEarnings, 180000)
    assert.equal(created.pricing.hostNetAmount, 106200)
    assert.equal(created.pricing.hostCommissionAmount, 200000 - 106200)
    assert.equal(created.pricing.accommodationSubtotal, 200000, "Guest price unchanged")

    // Restore 100% for other suites
    await adminService.updateSettings({ defaultHostPayoutPct: 100 }, "usr_admin_default")
  })
})
