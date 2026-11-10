/**
 * Phase 4 — Web booking lifecycle contract tests.
 * Asserts guest/host flows the Next.js UI depends on against the Phase 3 backend SoT.
 * No invented statuses. Guests cannot execute refunds on CONFIRMED.
 */
import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getDb, schema } from "../backend/src/db/client"
import { eq, sql } from "drizzle-orm"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import { initializeBookingPayment } from "../backend/src/modules/payments/payments.service"
import { hostsService } from "../backend/src/modules/hosts/hosts.service"
import { BOOKING_STATUS } from "../backend/src/config/constants"

describe("Phase 4: Web guest/host lifecycle against Phase 3 API", async () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_p4_${ts}`
  const propertyId = `prop_p4_${ts}`

  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response VARCHAR(30)`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_responded_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100`)

  await db
    .insert(schema.users)
    .values({
      id: hostId,
      email: `p4host_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "P4",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    })
    .onConflictDoNothing()

  await db
    .insert(schema.profiles)
    .values({
      id: `prof_p4_${ts}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    })
    .onConflictDoNothing()

  await db
    .insert(schema.properties)
    .values({
      id: propertyId,
      hostId,
      slug: `p4-stay-${ts}`,
      title: "Phase 4 Web Stay",
      description: "Web lifecycle property",
      propertyType: "Apartment",
      pricePerNight: 80000,
      hostBasePrice: 72000,
      cleaningFee: 0,
      city: "Abuja",
      neighborhood: "Wuse",
      state: "FCT",
      latitude: 9.07,
      longitude: 7.48,
      maxGuests: 4,
      minimumNights: 2,
      powerType: "Solar + Inverter",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    .onConflictDoNothing()

  const futureDates = (offsetDays: number, nights = 2) => {
    const inD = new Date(Date.now() + offsetDays * 86400000)
    const outD = new Date(Date.now() + (offsetDays + nights) * 86400000)
    return {
      checkInDate: inD.toISOString().split("T")[0],
      checkOutDate: outD.toISOString().split("T")[0],
    }
  }

  let dateSlot = 40
  const guestBody = (suffix: string, nights = 2) => {
    // Unique non-overlapping windows — holds block dates until cancelled/expired
    dateSlot += nights + 3
    const dates = futureDates(dateSlot, nights)
    return {
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `ada.p4.${suffix}.${ts}@guest.ile.ng`,
      guestPhone: "+2348011110000",
      guestCount: 2,
      ...dates,
    }
  }

  it("1. Create → PENDING_HOST with host deadline; never PAYMENT_PENDING on create", async () => {
    const result = await bookingsService.createBooking(guestBody("a"))
    assert.equal(result.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.ok(result.booking.hostResponseDeadlineAt || result.timers?.hostResponseDeadlineAt)
    assert.ok(result.accessToken || result.booking.accessToken)
    assert.notEqual(result.booking.status, BOOKING_STATUS.PAYMENT_PENDING)
  })

  it("2. Payment init rejected while PENDING_HOST (web must not call pay early)", async () => {
    const created = await bookingsService.createBooking(guestBody("b"))
    const token = created.accessToken || created.booking.accessToken
    const init = await initializeBookingPayment(created.booking.id, token)
    assert.equal(init.success, false)
    assert.match(String(init.error || ""), /host accepts|not available/i)
  })

  it("3. Host accept → PAYMENT_PENDING; host list exposes deadlines; idempotent re-accept", async () => {
    const created = await bookingsService.createBooking(guestBody("c"))
    const accepted = await bookingsService.acceptBooking(created.booking.id, hostId)
    assert.equal(accepted.booking.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.ok(accepted.paymentDeadlineAt || accepted.booking.paymentDeadlineAt)

    const again = await bookingsService.acceptBooking(created.booking.id, hostId)
    assert.equal(again.idempotent, true)
    assert.equal(again.booking.status, BOOKING_STATUS.PAYMENT_PENDING)

    const hostList = await hostsService.getHostBookings(hostId)
    const row = hostList.bookings.find((b: any) => b.id === created.booking.id)
    assert.ok(row)
    assert.equal(row.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.ok(row.paymentDeadlineAt)
  })

  it("4. Host decline → CANCELLED with confirm path (service)", async () => {
    const created = await bookingsService.createBooking(guestBody("d"))
    const declined = await bookingsService.declineBooking(
      created.booking.id,
      hostId,
      "Host declined from dashboard test"
    )
    assert.equal(declined.booking.status, BOOKING_STATUS.CANCELLED)
  })

  it("5. Guest cancel unpaid PENDING_HOST / PAYMENT_PENDING OK", async () => {
    const pendingHost = await bookingsService.createBooking(guestBody("e"))
    const token1 = pendingHost.accessToken || pendingHost.booking.accessToken
    const c1 = await bookingsService.cancelBooking(pendingHost.booking.id, token1)
    assert.equal(c1.booking.status, BOOKING_STATUS.CANCELLED)

    const pendingPay = await bookingsService.createBooking(guestBody("f"))
    await bookingsService.acceptBooking(pendingPay.booking.id, hostId)
    const token2 = pendingPay.accessToken || pendingPay.booking.accessToken
    const c2 = await bookingsService.cancelBooking(pendingPay.booking.id, token2)
    assert.equal(c2.booking.status, BOOKING_STATUS.CANCELLED)
  })

  it("6. CONFIRMED cancel returns REFUND_REQUIRED — guest must not execute refund", async () => {
    const created = await bookingsService.createBooking(guestBody("g"))
    await bookingsService.acceptBooking(created.booking.id, hostId)
    await db
      .update(schema.bookings)
      .set({ status: BOOKING_STATUS.CONFIRMED, updatedAt: new Date() })
      .where(eq(schema.bookings.id, created.booking.id))

    const token = created.accessToken || created.booking.accessToken
    await assert.rejects(
      () => bookingsService.cancelBooking(created.booking.id, token),
      (err: any) => err.code === "REFUND_REQUIRED" || err.statusCode === 409
    )
  })

  it("7. Capacity / min nights enforced (panel must not bypass)", async () => {
    await assert.rejects(
      () =>
        bookingsService.createBooking({
          ...guestBody("h", 1),
          guestCount: 2,
        }),
      (err: any) => /minimum stay/i.test(String(err.message))
    )
    await assert.rejects(
      () =>
        bookingsService.createBooking({
          ...guestBody("i", 2),
          guestCount: 99,
        }),
      (err: any) => /guest/i.test(String(err.message))
    )
  })

  it("8. Status recovery: getBooking returns authoritative status + deadlines", async () => {
    const created = await bookingsService.createBooking(guestBody("j"))
    const got = await bookingsService.getBooking(created.booking.id)
    assert.equal(got.booking.status, BOOKING_STATUS.PENDING_HOST)
    assert.ok(got.booking.hostResponseDeadlineAt)

    await bookingsService.acceptBooking(created.booking.id, hostId)
    const got2 = await bookingsService.getBooking(created.booking.id)
    assert.equal(got2.booking.status, BOOKING_STATUS.PAYMENT_PENDING)
    assert.ok(got2.booking.paymentDeadlineAt)
  })
})
