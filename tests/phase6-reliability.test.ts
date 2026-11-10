import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getDb, schema } from "../backend/src/db/client"
import { eq, and, sql } from "drizzle-orm"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import {
  initializeBookingPayment,
  processSuccessfulPayment,
} from "../backend/src/modules/payments/payments.service"
import {
  sendTransactionalEmail,
  guestHostDeclinedEmail,
} from "../backend/src/modules/notifications/notifications.service"
import {
  buildLifecycleIdempotencyKey,
  LIFECYCLE_EMAIL_EVENT,
} from "../backend/src/modules/notifications/lifecycle-notify"
import { BOOKING_STATUS, CANCELLATION_REASON } from "../backend/src/config/constants"
import crypto from "crypto"

describe("Phase 6: Notifications, recovery, late pay, similar search", async () => {
  const db = getDb()
  const ts = Date.now()
  let hostId = `host_p6_${ts}`
  let propertyId = `prop_p6_${ts}`
  let altPropertyId = `prop_p6b_${ts}`

  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_responded_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response VARCHAR(30)`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_deliveries (
      id VARCHAR(100) PRIMARY KEY,
      idempotency_key VARCHAR(191) NOT NULL,
      event_type VARCHAR(80) NOT NULL,
      entity_type VARCHAR(50) NOT NULL DEFAULT 'booking',
      entity_id VARCHAR(100),
      recipient VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      provider_message_id VARCHAR(191),
      last_error TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_idempotency_uidx
    ON email_deliveries (idempotency_key)
  `)

  const futureDates = (offsetDays: number, nights = 2) => {
    const inD = new Date(Date.now() + offsetDays * 86400000)
    const outD = new Date(Date.now() + (offsetDays + nights) * 86400000)
    return {
      checkInDate: inD.toISOString().split("T")[0],
      checkOutDate: outD.toISOString().split("T")[0],
    }
  }

  const seedProperty = async (
    idSuffix: string,
    host: string,
    prop: string,
    slug: string,
    opts?: { maxGuests?: number; minimumNights?: number; city?: string }
  ) => {
    await db.insert(schema.users).values({
      id: host,
      // Include host id so unique email never collides across suite re-runs
      email: `${host}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Host",
      lastName: idSuffix,
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing()

    await db.insert(schema.profiles).values({
      id: `prof_${host}`,
      userId: host,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    }).onConflictDoNothing()

    await db.insert(schema.properties).values({
      id: prop,
      hostId: host,
      slug,
      title: `Phase 6 Stay ${idSuffix}`,
      description: "Reliability test property",
      propertyType: "Apartment",
      pricePerNight: 120000,
      hostBasePrice: 108000,
      cleaningFee: 0,
      city: opts?.city || "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Grid + Inverter",
      coverImage: "https://example.com/cover.jpg",
      status: "PUBLISHED",
      moderationStatus: "NONE",
      maxGuests: opts?.maxGuests ?? 4,
      minimumNights: opts?.minimumNights ?? 1,
      bedrooms: 2,
      bathrooms: 2,
      beds: 2,
    }).onConflictDoNothing()
  }

  await seedProperty("p6a", hostId, propertyId, `p6-stay-${ts}`)
  await seedProperty("p6b", hostId, altPropertyId, `p6-alt-${ts}`, {
    maxGuests: 6,
    minimumNights: 1,
  })

  it("1. Idempotent lifecycle email: second send skipped after SENT", async () => {
    const bookingId = `bk_email_${ts}`
    const key = buildLifecycleIdempotencyKey(
      LIFECYCLE_EMAIL_EVENT.GUEST_HOST_DECLINED,
      bookingId,
      "guest"
    )
    const payload = {
      ...guestHostDeclinedEmail({
        guestName: "Ada Guest",
        guestEmail: `guest_email_${ts}@test.ile.ng`,
        propertyTitle: "Test Stay",
        referenceCode: `ILE-EMAIL-${ts}`,
        checkIn: "2030-01-10",
        checkOut: "2030-01-12",
      }),
      idempotencyKey: key,
      eventType: LIFECYCLE_EMAIL_EVENT.GUEST_HOST_DECLINED,
      entityId: bookingId,
    }

    const first = await sendTransactionalEmail(payload)
    assert.equal(first.sent, true)
    assert.equal(first.idempotent, undefined)

    const second = await sendTransactionalEmail(payload)
    assert.equal(second.sent, false)
    assert.equal(second.idempotent, true)

    const [row] = await db
      .select()
      .from(schema.emailDeliveries)
      .where(eq(schema.emailDeliveries.idempotencyKey, key))
      .limit(1)
    assert.ok(row)
    assert.equal(row.status, "SENT")
  })

  it("2. Resend failure is logged; attempts bounded; no infinite retry", async () => {
    const key = `booking:fail_${ts}:TEST_FAIL:guest`
    const prevProvider = process.env.EMAIL_PROVIDER
    const prevKey = process.env.RESEND_API_KEY
    const prevEmailKey = process.env.EMAIL_API_KEY
    process.env.EMAIL_PROVIDER = "resend"
    process.env.RESEND_API_KEY = "re_test_invalid_key_phase6"
    process.env.EMAIL_API_KEY = "re_test_invalid_key_phase6"

    // Re-import env is already cached — sendViaResend uses env from module.
    // Force console-fail path by using a unique key and mocking via exhausted attempts manually.
    await db.insert(schema.emailDeliveries).values({
      id: `eml_fail_${ts}`,
      idempotencyKey: key,
      eventType: "TEST_FAIL",
      entityType: "booking",
      entityId: `bk_fail_${ts}`,
      recipient: "fail@test.ile.ng",
      subject: "fail",
      status: "FAILED",
      attempts: 3,
      maxAttempts: 3,
      lastError: "simulated provider failure",
    }).onConflictDoNothing()

    const result = await sendTransactionalEmail({
      to: "fail@test.ile.ng",
      subject: "fail",
      html: "<p>x</p>",
      idempotencyKey: key,
      eventType: "TEST_FAIL",
      entityId: `bk_fail_${ts}`,
      maxAttempts: 3,
    })

    assert.equal(result.sent, false)
    assert.equal(result.exhausted, true)
    assert.ok((result.attempts || 0) >= 3)

    if (prevProvider === undefined) delete process.env.EMAIL_PROVIDER
    else process.env.EMAIL_PROVIDER = prevProvider
    if (prevKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = prevKey
    if (prevEmailKey === undefined) delete process.env.EMAIL_API_KEY
    else process.env.EMAIL_API_KEY = prevEmailKey
  })

  it("3. Recovery getBooking: refresh metadata without recreating", async () => {
    const dates = futureDates(40, 2)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Recovery",
      guestLastName: "Guest",
      guestEmail: `recovery_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      guestCount: 2,
      ...dates,
    })
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST)

    const fetched = await bookingsService.getBooking(created.booking.id)
    assert.equal(fetched.booking.id, created.booking.id)
    assert.equal(fetched.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.equal(fetched.recovery.sourceOfTruth, "backend")
    assert.equal(fetched.recovery.canRefreshWithoutRecreate, true)
    assert.equal(fetched.recovery.canPay, false)
    assert.equal(fetched.recovery.awaitingHost, true)
    assert.ok(fetched.recovery.timers.hostResponseDeadlineAt)

    // Second fetch is same booking — no duplicate create
    const again = await bookingsService.getBooking(created.booking.referenceCode)
    assert.equal(again.booking.id, created.booking.id)
  })

  it("4. Late payment: REQUESTED refund, no confirm, no earnings, idempotent", async () => {
    const dates = futureDates(55, 2)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Late",
      guestLastName: "Pay",
      guestEmail: `late_${ts}@test.ile.ng`,
      guestPhone: "+2348022222222",
      guestCount: 2,
      ...dates,
    })
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const init = await initializeBookingPayment(
      created.booking.id,
      created.accessToken || created.booking.accessToken
    )
    assert.equal(init.success, true)

    // Expire payment window
    await db
      .update(schema.bookings)
      .set({
        paymentDeadlineAt: new Date(Date.now() - 60_000),
        status: BOOKING_STATUS.CANCELLED,
        cancellationReason: CANCELLATION_REASON.PAYMENT_WINDOW_EXPIRED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, created.booking.id))
    await db
      .delete(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id))

    const late = await processSuccessfulPayment({
      reference: init.reference,
      gatewayReference: `gw_late_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
      rawPayload: JSON.stringify({ late: true }),
    })

    assert.equal(late.reconciliationRequired, true)
    assert.equal((late as any).bookingConfirmed, false)

    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.notEqual(booking.status, BOOKING_STATUS.CONFIRMED)
    assert.equal(booking.status, BOOKING_STATUS.CANCELLED)

    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 1)
    assert.equal(refunds[0].status, "REQUESTED")

    const earnings = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, created.booking.id))
    for (const e of earnings) {
      assert.notEqual(e.status, "PENDING")
      assert.notEqual(e.status, "AVAILABLE")
    }

    // Replay — no duplicate refund / financials
    const replay = await processSuccessfulPayment({
      reference: init.reference,
      gatewayReference: `gw_late_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal(replay.success, true)

    const refundsAfter = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refundsAfter.length, 1)

    const recovery = await bookingsService.getBooking(created.booking.id)
    assert.equal(recovery.recovery.reconciliationRequired, true)
    assert.equal(recovery.recovery.resolutionPending, true)
  })

  it("5. Similar properties: filters capacity/min nights/availability; never auto-book", async () => {
    const dates = futureDates(70, 2)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Similar",
      guestLastName: "Search",
      guestEmail: `similar_${ts}@test.ile.ng`,
      guestPhone: "+2348033333333",
      guestCount: 2,
      ...dates,
    })
    await bookingsService.declineBooking(created.booking.id, hostId, "Full")

    // Capacity-too-small property should not match
    const tinyId = `prop_p6tiny_${ts}`
    await seedProperty("p6tiny", hostId, tinyId, `p6-tiny-${ts}`, {
      maxGuests: 1,
      minimumNights: 1,
    })

    // Min nights too high should not match
    const longMinId = `prop_p6long_${ts}`
    await seedProperty("p6long", hostId, longMinId, `p6-long-${ts}`, {
      maxGuests: 6,
      minimumNights: 14,
    })

    const similar = await bookingsService.findSimilarProperties(created.booking.id, 10)
    assert.equal(similar.autoBook, false)
    assert.equal(similar.autoCharge, false)
    assert.equal(similar.criteria.city, "Abuja")
    assert.equal(similar.criteria.checkInDate, dates.checkInDate)
    assert.equal(similar.criteria.guestCount, 2)

    const ids = similar.properties.map((p: any) => p.id)
    assert.ok(!ids.includes(propertyId), "source property excluded")
    assert.ok(!ids.includes(tinyId), "capacity filter")
    assert.ok(!ids.includes(longMinId), "min nights filter")
    assert.ok(ids.includes(altPropertyId), "matching alt included")

    for (const p of similar.properties as any[]) {
      assert.ok(p.pricing?.totalGuestPayment > 0, "backend price present")
      assert.equal(p.preservedSearch.guestCount, 2)
    }

    // Ensure no booking was created for alternatives
    const altBookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.propertyId, altPropertyId))
    assert.equal(altBookings.length, 0)
  })

  it("6. Webhook-style payment replay does not duplicate SUCCESS financials on confirmed path", async () => {
    const dates = futureDates(85, 2)
    const created = await bookingsService.createBooking({
      propertyId: altPropertyId,
      guestFirstName: "Idem",
      guestLastName: "Pay",
      guestEmail: `idempay_${ts}@test.ile.ng`,
      guestPhone: "+2348044444444",
      guestCount: 2,
      ...dates,
    })
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const init = await initializeBookingPayment(
      created.booking.id,
      created.accessToken || created.booking.accessToken
    )

    const first = await processSuccessfulPayment({
      reference: init.reference,
      gatewayReference: `gw_ok_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal(first.success, true)
    assert.notEqual((first as any).reconciliationRequired, true)

    const [confirmed] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.equal(confirmed.status, BOOKING_STATUS.CONFIRMED)

    const earningsBefore = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, created.booking.id))

    const second = await processSuccessfulPayment({
      reference: init.reference,
      gatewayReference: `gw_ok_${ts}`,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal(second.success, true)
    assert.match(second.message || "", /idempotent/i)

    const earningsAfter = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, created.booking.id))
    assert.equal(earningsAfter.length, earningsBefore.length)

    const refunds = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 0)
  })

  it("7. Audit log written for booking create (existing audit_logs)", async () => {
    const dates = futureDates(95, 2)
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Audit",
      guestLastName: "Trail",
      guestEmail: `audit_${ts}@test.ile.ng`,
      guestPhone: "+2348055555555",
      guestCount: 2,
      ...dates,
    })

    // Give async audit a brief moment
    await new Promise((r) => setTimeout(r, 50))

    const logs = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityType, "booking"),
          eq(schema.auditLogs.entityId, created.booking.id),
          eq(schema.auditLogs.action, "BOOKING_REQUEST_CREATED")
        )
      )
    assert.ok(logs.length >= 1)
  })
})
