/**
 * Phase 1 core transaction reliability.
 * Providers are not called: payment rows are inserted locally, Paystack verify/transfer
 * HTTP is not used, and this file expects console/mock notification providers.
 */
import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { eq, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { bookingsService, authorizeBookingView } from "../backend/src/modules/bookings/bookings.service"
import {
  processSuccessfulPayment,
  processFailedPayment,
  verifyPaystackWebhookSignature,
  handlePaystackWebhook,
  paymentAssociationProblem,
} from "../backend/src/modules/payments/payments.service"
import { adminService } from "../backend/src/modules/admin/admin.service"
import { env } from "../backend/src/config/env"
import { BOOKING_STATUS } from "../backend/src/config/constants"

describe("Phase 1 core transaction reliability", async () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_p1core_${ts}`
  const otherHostId = `host_p1other_${ts}`
  const guestId = `guest_p1core_${ts}`
  const propertyId = `prop_p1core_${ts}`

  const futureDates = (offsetDays: number) => {
    const inD = new Date(Date.now() + offsetDays * 86400000)
    const outD = new Date(Date.now() + (offsetDays + 2) * 86400000)
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
      lastName: "Core",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: otherHostId,
      email: `${otherHostId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Other",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: guestId,
      email: `${guestId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Guest",
      lastName: "Core",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
  ])

  await db.insert(schema.profiles).values({
    id: `prof_${hostId}`,
    userId: hostId,
    isVerified: true,
    verificationStatus: "APPROVED",
    onboardingCompleted: true,
  })

  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p1-core-${ts}`,
    title: "Phase 1 Core Stay",
    description: "Transaction reliability fixture",
    propertyType: "Apartment",
    pricePerNight: 80000,
    hostBasePrice: 72000,
    cleaningFee: 0,
    city: "Abuja",
    neighborhood: "Wuse",
    state: "FCT",
    latitude: 9.07,
    longitude: 7.48,
    powerType: "Grid + Inverter",
    coverImage: "https://example.com/cover.jpg",
    status: "PUBLISHED",
    moderationStatus: "NONE",
    maxGuests: 4,
    minimumNights: 1,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
  })

  const insertPayment = async (bookingId: string, amount: number) => {
    const reference = `ile_p1_${bookingId}_${crypto.randomBytes(4).toString("hex")}`
    await db.insert(schema.payments).values({
      id: `pay_${crypto.randomUUID()}`,
      bookingId,
      reference,
      amount,
      currency: "NGN",
      method: "CARD",
      status: "INITIALIZED",
      gatewayProvider: "PAYSTACK",
    })
    return reference
  }

  it("request, accept, decline, and cross-host rejection", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Ada",
        guestLastName: "Guest",
        guestEmail: `${guestId}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 2,
        ...futureDates(40),
      },
      { userId: guestId, role: "guest" }
    )
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.ok(created.timers.hostResponseDeadlineAt)

    await assert.rejects(
      () => bookingsService.acceptBooking(created.booking.id, otherHostId),
      (err: any) => err.statusCode === 403
    )

    const declined = await bookingsService.declineBooking(created.booking.id, hostId, "Unavailable")
    assert.equal(declined.booking.status, BOOKING_STATUS.CANCELLED)
    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id))
    assert.equal(blocks.length, 0)
  })

  it("concurrent accept leaves a single PAYMENT_PENDING booking", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Ada",
        guestLastName: "Guest",
        guestEmail: `race_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(50),
      },
      { userId: guestId, role: "guest" }
    )
    const results = await Promise.allSettled([
      bookingsService.acceptBooking(created.booking.id, hostId),
      bookingsService.acceptBooking(created.booking.id, hostId),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    assert.ok(fulfilled.length >= 1)
    const [row] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, created.booking.id))
      .limit(1)
    assert.equal(row.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.equal(row.hostResponse, "ACCEPTED")
    const fresh = fulfilled.filter((r) => r.status === "fulfilled" && (r as any).value.idempotent === false)
    assert.equal(fresh.length, 1)
  })

  it("overlapping requests cannot both hold inventory", async () => {
    const dates = futureDates(60)
    const first = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "A",
        guestLastName: "One",
        guestEmail: `overlap_a_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...dates,
      },
      { userId: guestId, role: "guest" }
    )
    await assert.rejects(
      () =>
        bookingsService.createBooking(
          {
            propertyId,
            guestFirstName: "B",
            guestLastName: "Two",
            guestEmail: `overlap_b_${ts}@test.ile.ng`,
            guestPhone: "123456",
            guestCount: 1,
            ...dates,
          },
          null
        ),
      (err: any) => err.statusCode === 409
    )
    assert.equal(first.booking.status, BOOKING_STATUS.PENDING_HOST)
  })

  it("payment confirm is idempotent and a failed attempt does not release the window", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Pay",
        guestLastName: "Guest",
        guestEmail: `pay_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 2,
        ...futureDates(70),
      },
      { userId: guestId, role: "guest" }
    )
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const reference = await insertPayment(created.booking.id, created.booking.totalAmount)
    const payload = JSON.stringify({
      event: "charge.success",
      data: {
        metadata: { bookingId: created.booking.id },
        customer: { email: `pay_${ts}@test.ile.ng` },
      },
    })

    const [first, second] = await Promise.all([
      processSuccessfulPayment({
        reference,
        gatewayReference: `gw_${ts}`,
        paidAmountNaira: created.booking.totalAmount,
        currency: "NGN",
        method: "CARD",
        rawPayload: payload,
      }),
      processSuccessfulPayment({
        reference,
        gatewayReference: `gw_${ts}`,
        paidAmountNaira: created.booking.totalAmount,
        currency: "NGN",
        method: "CARD",
        rawPayload: payload,
      }),
    ])
    assert.equal(first.success && second.success, true)
    const confirmedFlags = [first, second].filter((r: any) => r.bookingConfirmed === true)
    assert.ok(confirmedFlags.length >= 1)
    assert.equal((first as any).booking?.accessToken, undefined)
    assert.equal((first as any).booking?.privateDetails, undefined)

    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(booking.status, BOOKING_STATUS.CONFIRMED)
    const earnings = await db.select().from(schema.hostEarnings).where(eq(schema.hostEarnings.bookingId, created.booking.id))
    assert.equal(earnings.length, 1)

    const failedRef = await insertPayment(created.booking.id, created.booking.totalAmount)
    const failed = await processFailedPayment({ reference: failedRef, reason: "Card declined", outcome: "failed" })
    assert.equal(failed.bookingStatus, BOOKING_STATUS.CONFIRMED)
    const [still] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(still.status, BOOKING_STATUS.CONFIRMED)
  })

  it("failed attempt during an open payment window keeps the hold", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Retry",
        guestLastName: "Guest",
        guestEmail: `retry_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(80),
      },
      { userId: guestId, role: "guest" }
    )
    await bookingsService.acceptBooking(created.booking.id, hostId)
    const reference = await insertPayment(created.booking.id, created.booking.totalAmount)
    const result = await processFailedPayment({ reference, reason: "Abandoned checkout", outcome: "abandoned" })
    assert.match(result.message, /ABANDONED/)
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(booking.status, BOOKING_STATUS.PAYMENT_PENDING)
    const blocks = await db.select().from(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.bookingId, created.booking.id))
    assert.equal(blocks.length, 1)
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.reference, reference)).limit(1)
    assert.equal(payment.status, "ABANDONED")
  })

  it("late and mismatched payments do not confirm the stay", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Late",
        guestLastName: "Guest",
        guestEmail: `late_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(90),
      },
      { userId: guestId, role: "guest" }
    )
    await bookingsService.acceptBooking(created.booking.id, hostId)
    await db
      .update(schema.bookings)
      .set({
        status: BOOKING_STATUS.CANCELLED,
        cancellationReason: "PAYMENT_WINDOW_EXPIRED",
        cancelledAt: new Date(),
      })
      .where(eq(schema.bookings.id, created.booking.id))
    const reference = await insertPayment(created.booking.id, created.booking.totalAmount)
    const late = await processSuccessfulPayment({
      reference,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
      rawPayload: JSON.stringify({
        data: { metadata: { bookingId: created.booking.id }, customer: { email: `late_${ts}@test.ile.ng` } },
      }),
    })
    assert.equal((late as any).reconciliationRequired, true)
    assert.equal((late as any).bookingConfirmed, false)
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(booking.status, BOOKING_STATUS.CANCELLED)
    const replay = await processSuccessfulPayment({
      reference,
      paidAmountNaira: created.booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    })
    const refunds = await db.select().from(schema.refunds).where(eq(schema.refunds.bookingId, created.booking.id))
    assert.equal(refunds.length, 1)
    assert.equal(replay.success, true)

    const open = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Mismatch",
        guestLastName: "Guest",
        guestEmail: `mismatch_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(100),
      },
      { userId: guestId, role: "guest" }
    )
    await bookingsService.acceptBooking(open.booking.id, hostId)
    const badRef = await insertPayment(open.booking.id, open.booking.totalAmount)
    const mismatch = await processSuccessfulPayment({
      reference: badRef,
      paidAmountNaira: open.booking.totalAmount + 5000,
      currency: "NGN",
      method: "CARD",
    })
    assert.equal((mismatch as any).bookingConfirmed, false)
    assert.equal((mismatch as any).reconciliationRequired, true)
    const [openRow] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, open.booking.id)).limit(1)
    assert.equal(openRow.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.equal(
      paymentAssociationProblem(
        { paidAmountNaira: 1, currency: "USD", rawPayload: "{}" },
        { id: "b", totalAmount: 1, guestEmail: "a@b.co" }
      ),
      "currency USD"
    )
  })

  it("webhook signature rejects a bad HMAC and accepts the documented SHA512 hex digest", async () => {
    const body = JSON.stringify({ event: "charge.failed", data: { reference: `missing_${ts}`, id: ts } })
    assert.equal(verifyPaystackWebhookSignature(body, "not-a-signature"), false)
    if (!env.PAYSTACK_SECRET_KEY) {
      assert.equal(verifyPaystackWebhookSignature(body, "abc"), false)
      return
    }
    const good = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(body).digest("hex")
    assert.equal(verifyPaystackWebhookSignature(body, good), true)
    const first = await handlePaystackWebhook(body, good)
    const second = await handlePaystackWebhook(body, good)
    assert.equal(first.processed, true)
    assert.match(second.message, /already processed|charge.failed/i)
  })

  it("email lookup cannot read the access token or house pass", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Lookup",
        guestLastName: "Guest",
        guestEmail: `lookup_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(110),
      },
      { userId: guestId, role: "guest" }
    )
    const full = await bookingsService.getBooking(created.booking.id)
    const redacted = authorizeBookingView(full, { email: `lookup_${ts}@test.ile.ng` })
    assert.equal(redacted.booking.accessToken, undefined)
    assert.equal(redacted.booking.guestPhone, undefined)
    await assert.rejects(
      () => bookingsService.getBookingContact(created.booking.id, `lookup_${ts}@test.ile.ng`),
      (err: any) => err.statusCode === 401 || err.statusCode === 403
    )
  })

  it("admin cannot hard-delete booking or payment history", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Keep",
        guestLastName: "Guest",
        guestEmail: `keep_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(120),
      },
      { userId: guestId, role: "guest" }
    )
    await assert.rejects(
      () => adminService.deleteBooking(created.booking.id, hostId),
      (err: any) => err.statusCode === 409
    )
    const reference = await insertPayment(created.booking.id, created.booking.totalAmount)
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.reference, reference)).limit(1)
    await assert.rejects(
      () => adminService.deleteTransaction(payment.id, hostId),
      (err: any) => err.statusCode === 409
    )
    const [still] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(still.status, BOOKING_STATUS.PENDING_HOST)
  })

  it("expiry releases an unpaid hold", async () => {
    const created = await bookingsService.createBooking(
      {
        propertyId,
        guestFirstName: "Expire",
        guestLastName: "Guest",
        guestEmail: `expire_${ts}@test.ile.ng`,
        guestPhone: "123456",
        guestCount: 1,
        ...futureDates(130),
      },
      { userId: guestId, role: "guest" }
    )
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 5000) })
      .where(eq(schema.bookings.id, created.booking.id))
    const expired = await bookingsService.expireDueBookings(5, created.booking.id)
    assert.ok(expired.bookingIds.includes(created.booking.id))
    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id))
    assert.equal(blocks.length, 0)
    await db.execute(sql`SELECT 1`)
  })
})
