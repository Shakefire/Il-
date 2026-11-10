import "dotenv/config"
import assert from "node:assert/strict"
import { describe, it, before } from "node:test"
import { sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { hostsService } from "../backend/src/modules/hosts/hosts.service"
import { PROPERTY_STATUS, BOOKING_STATUS } from "../backend/src/config/constants"

const insertUserAvoidingDrift = async (
  db: ReturnType<typeof getDb>,
  user: { id: string; email: string; firstName: string; lastName: string; role: string }
) => {
  await db.execute(sql`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, email_verified, status)
    VALUES (
      ${user.id},
      ${user.email},
      ${"hash"},
      ${user.firstName},
      ${user.lastName},
      ${user.role},
      true,
      ${"ACTIVE"}
    )
    ON CONFLICT (id) DO NOTHING
  `)
}

describe("H-P1-1 getDashboard aggregates beyond last 10 bookings", () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_dash_${ts}`
  const guestId = `guest_dash_${ts}`
  const propertyId = `prop_dash_${ts}`
  const bookingCount = 15
  const netPerBooking = 90000
  const grossPerBooking = 100000

  before(async () => {
    await insertUserAvoidingDrift(db, {
      id: hostId,
      email: `host_dash_${ts}@test.ile.ng`,
      firstName: "Host",
      lastName: "Dash",
      role: "host",
    })
    await insertUserAvoidingDrift(db, {
      id: guestId,
      email: `guest_dash_${ts}@test.ile.ng`,
      firstName: "Guest",
      lastName: "Dash",
      role: "guest",
    })

    await db.insert(schema.profiles).values({
      id: `prof_dash_${ts}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
      bankName: "Test Bank",
      bankCode: "058",
      bankAccountNumber: "0123456789",
      bankAccountName: "HOST DASH",
      bankAccountVerifiedAt: new Date(),
    }).onConflictDoNothing()

    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `dash-earn-${ts}`,
      title: "Dashboard Earnings Stay",
      description: "Many confirmed bookings for aggregation",
      propertyType: "Apartment",
      pricePerNight: 50000,
      hostBasePrice: 45000,
      cleaningFee: 0,
      city: "Lagos",
      neighborhood: "Ikoyi",
      state: "Lagos",
      latitude: 6.45,
      longitude: 3.43,
      powerType: "Solar",
      coverImage: "/images/placeholder-property.jpg",
      status: PROPERTY_STATUS.PUBLISHED,
    }).onConflictDoNothing()

    const rows = []
    const payoutRows = []
    for (let i = 0; i < bookingCount; i++) {
      const bookingId = `book_dash_${ts}_${i}`
      const checkIn = new Date(Date.now() - (30 + i) * 86400000).toISOString().split("T")[0]
      const checkOut = new Date(Date.now() - (28 + i) * 86400000).toISOString().split("T")[0]
      rows.push({
        id: bookingId,
        propertyId,
        guestId,
        referenceCode: `DSH${ts}${i}`,
        guestFirstName: "Guest",
        guestLastName: `N${i}`,
        guestEmail: `guest_dash_${ts}@test.ile.ng`,
        guestPhone: "+2348010000000",
        guestCount: 2,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfNights: 2,
        nightlyPrice: 50000,
        accommodationSubtotal: grossPerBooking,
        hostCommissionPct: 10,
        hostCommissionAmount: 10000,
        hostNetAmount: netPerBooking,
        totalAmount: 110000,
        serviceFee: 10000,
        status: BOOKING_STATUS.CONFIRMED,
        accessToken: `tok_dash_${ts}_${i}`,
      })
      payoutRows.push({
        id: `payout_dash_${ts}_${i}`,
        bookingId,
        hostId,
        amount: netPerBooking,
        currency: "NGN",
        status: i < 5 ? "PAID" : i < 10 ? "READY_FOR_PAYOUT" : "HELD",
      })
    }
    await db.insert(schema.bookings).values(rows).onConflictDoNothing()
    await db.insert(schema.payouts).values(payoutRows).onConflictDoNothing()
  })

  it("sums lifetime host earnings across all 15 confirmed bookings", async () => {
    const dash = await hostsService.getDashboard(hostId)
    assert.equal(dash.earnings.lifetimeHostEarnings, netPerBooking * bookingCount)
    assert.equal(dash.earnings.totalNet, netPerBooking * bookingCount)
    assert.equal(dash.earnings.lifetimeGross, grossPerBooking * bookingCount)
    assert.equal(dash.earnings.totalGross, grossPerBooking * bookingCount)
    assert.ok(dash.recentBookings.length <= 10)
    assert.ok(
      dash.earnings.byProperty.some(
        (p: { propertyId: string; bookingCount: number }) =>
          p.propertyId === propertyId && p.bookingCount === bookingCount
      )
    )
  })

  it("reconciles wallet projection with payout statuses", async () => {
    const dash = await hostsService.getDashboard(hostId)
    assert.equal(dash.earnings.wallet.paid, netPerBooking * 5)
    assert.equal(dash.earnings.wallet.available, netPerBooking * 5)
    assert.equal(dash.earnings.wallet.pending, netPerBooking * 5)
    assert.ok(dash.occupancy)
    assert.ok(typeof dash.occupancy.occupancyRate === "number")
    assert.ok(Array.isArray(dash.alerts))
  })
})
