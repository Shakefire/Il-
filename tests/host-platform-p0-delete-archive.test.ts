import "dotenv/config"
import assert from "node:assert/strict"
import { describe, it, before } from "node:test"
import { eq, and, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { hostsService } from "../backend/src/modules/hosts/hosts.service"
import { PROPERTY_STATUS, BOOKING_STATUS } from "../backend/src/config/constants"

/** Raw user insert avoids drizzle schema columns missing under 0005 drift. */
const insertUserAvoidingDrift = async (
  db: ReturnType<typeof getDb>,
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
  }
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

describe("H-P0-1 soft-archive preserves financial history", () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_arch_${ts}`
  const guestId = `guest_arch_${ts}`
  const propWithHistoryId = `prop_arch_hist_${ts}`
  const propEmptyId = `prop_arch_empty_${ts}`
  const bookingId = `book_arch_${ts}`
  const paymentId = `pay_arch_${ts}`
  const payoutId = `payout_arch_${ts}`
  const refundId = `refund_arch_${ts}`

  before(async () => {
    await insertUserAvoidingDrift(db, {
      id: hostId,
      email: `host_arch_${ts}@test.ile.ng`,
      firstName: "Host",
      lastName: "Archive",
      role: "host",
    })
    await insertUserAvoidingDrift(db, {
      id: guestId,
      email: `guest_arch_${ts}@test.ile.ng`,
      firstName: "Guest",
      lastName: "Archive",
      role: "guest",
    })

    await db.insert(schema.profiles).values({
      id: `prof_arch_${ts}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    }).onConflictDoNothing()

    await db.insert(schema.properties).values([
      {
        id: propWithHistoryId,
        hostId,
        slug: `arch-hist-${ts}`,
        title: "Archive History Stay",
        description: "Has booking and payout history",
        propertyType: "Apartment",
        pricePerNight: 50000,
        hostBasePrice: 45000,
        cleaningFee: 0,
        city: "Abuja",
        neighborhood: "Maitama",
        state: "FCT",
        latitude: 9.08,
        longitude: 7.49,
        powerType: "Solar",
        coverImage: "/images/placeholder-property.jpg",
        status: PROPERTY_STATUS.PUBLISHED,
      },
      {
        id: propEmptyId,
        hostId,
        slug: `arch-empty-${ts}`,
        title: "Empty Draft",
        description: "No booking history at all",
        propertyType: "Apartment",
        pricePerNight: 40000,
        hostBasePrice: 36000,
        cleaningFee: 0,
        city: "Abuja",
        neighborhood: "Wuse",
        state: "FCT",
        latitude: 9.07,
        longitude: 7.48,
        powerType: "Grid",
        coverImage: "/images/placeholder-property.jpg",
        status: PROPERTY_STATUS.DRAFT,
      },
    ]).onConflictDoNothing()

    const checkIn = new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0]
    const checkOut = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]

    await db.insert(schema.bookings).values({
      id: bookingId,
      propertyId: propWithHistoryId,
      guestId,
      referenceCode: `ARCH${ts}`,
      guestFirstName: "Guest",
      guestLastName: "Archive",
      guestEmail: `guest_arch_${ts}@test.ile.ng`,
      guestPhone: "+2348010000000",
      guestCount: 2,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      numberOfNights: 3,
      nightlyPrice: 45000,
      accommodationSubtotal: 135000,
      hostCommissionPct: 10,
      hostCommissionAmount: 13500,
      hostNetAmount: 121500,
      totalAmount: 148500,
      serviceFee: 13500,
      status: BOOKING_STATUS.CONFIRMED,
      accessToken: `tok_arch_${ts}`,
    }).onConflictDoNothing()

    await db.insert(schema.payments).values({
      id: paymentId,
      bookingId,
      reference: `pay_arch_ref_${ts}`,
      amount: 148500,
      currency: "NGN",
      method: "card",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
    }).onConflictDoNothing()

    await db.insert(schema.payouts).values({
      id: payoutId,
      bookingId,
      hostId,
      amount: 121500,
      currency: "NGN",
      status: "PAID",
    }).onConflictDoNothing()

    await db.insert(schema.refunds).values({
      id: refundId,
      bookingId,
      guestId,
      grossPaid: 148500,
      nonRefundableProcessingFee: 0,
      refundableAmount: 135000,
      currency: "NGN",
      status: "REJECTED",
      reason: "fixture",
    }).onConflictDoNothing()

    await db.insert(schema.hostEarnings).values({
      id: `earn_arch_${ts}`,
      hostId,
      bookingId,
      grossAmount: 135000,
      commissionAmount: 13500,
      netAmount: 121500,
      status: "PAID",
    }).onConflictDoNothing()
  })

  it("archives property with history and never deletes bookings/payments/payouts/refunds", async () => {
    const result = await hostsService.deleteProperty(hostId, propWithHistoryId, true, {
      mode: "archive",
    })

    assert.equal(result.action, "archive")
    assert.equal(result.success, true)

    const [prop] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, propWithHistoryId))
      .limit(1)
    assert.ok(prop, "property row must survive")
    assert.equal(prop.status, PROPERTY_STATUS.ARCHIVED)

    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1)
    const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId)).limit(1)
    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, payoutId)).limit(1)
    const [refund] = await db.select().from(schema.refunds).where(eq(schema.refunds.id, refundId)).limit(1)

    assert.ok(booking, "booking must survive archive")
    assert.ok(payment, "payment must survive archive")
    assert.ok(payout, "payout must survive archive")
    assert.ok(refund, "refund must survive archive")
    assert.equal(booking.hostNetAmount, 121500)
    assert.equal(payout.amount, 121500)

    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.entityId, propWithHistoryId),
          eq(schema.auditLogs.action, "PROPERTY_ARCHIVED")
        )
      )
    assert.ok(audits.length >= 1, "archive must write audit log")
  })

  it("hard-deletes only empty listings without history", async () => {
    const result = await hostsService.deleteProperty(hostId, propEmptyId, false, {
      mode: "delete",
    })
    assert.equal(result.action, "delete")

    const [prop] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, propEmptyId))
      .limit(1)
    assert.equal(prop, undefined)
  })

  it("rejects unauthorized delete", async () => {
    await assert.rejects(
      () => hostsService.deleteProperty(guestId, propWithHistoryId),
      (err: any) => err.statusCode === 404 || /not found|unauthorized/i.test(err.message)
    )
  })
})
