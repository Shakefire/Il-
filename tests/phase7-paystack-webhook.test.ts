/**
 * Phase 7: Paystack transfer webhook HMAC, invalid signature rejection,
 * fail→READY restore, success pay-once, replay idempotency (no double-pay).
 */
import "dotenv/config"
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { eq, and, sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import {
  verifyPaystackWebhookSignature,
  handlePaystackWebhook,
} from "../backend/src/modules/payments/payments.service"
import { LedgerService } from "../backend/src/modules/finance/ledger.service"

process.env.PAYSTACK_MOCK_TRANSFERS = "true"
process.env.NODE_ENV = process.env.NODE_ENV || "test"
if (!process.env.PAYSTACK_SECRET_KEY) {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_phase7_webhook_hmac"
}

const sign = (body: string): string => {
  const secret = process.env.PAYSTACK_SECRET_KEY as string
  return crypto.createHmac("sha512", secret).update(body).digest("hex")
}

describe("Phase 7: Paystack webhook HMAC + transfer + transfer safety", async () => {
  const db = getDb()
  const ts = Date.now()
  const hostId = `host_p7wh_${ts}`
  const guestId = `guest_p7wh_${ts}`
  const propertyId = `prop_p7wh_${ts}`
  const bookingId = `book_p7wh_${ts}`
  const payoutId = `pay_p7wh_${ts}`
  const transferRef = `ILE_WD_P7WH_${ts}`

  await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_check_in_confirmed_at TIMESTAMPTZ`)

  await db.insert(schema.users).values([
    {
      id: hostId,
      email: `host_p7wh_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Host",
      lastName: "WH",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    },
    {
      id: guestId,
      email: `guest_p7wh_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Guest",
      lastName: "WH",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    },
  ]).onConflictDoNothing()

  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p7-wh-${ts}`,
    title: "Phase 7 Webhook Stay",
    description: "Webhook integrity fixture",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 90000,
    cleaningFee: 0,
    currency: "NGN",
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    city: "Lagos",
    neighborhood: "Ikoyi",
    state: "Lagos",
    latitude: 6.45,
    longitude: 3.4,
    powerType: "Grid",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    coverImage: "https://example.com/wh.jpg",
  }).onConflictDoNothing()

  await db.insert(schema.bookings).values({
    id: bookingId,
    referenceCode: `P7WH${String(ts).slice(-6)}`,
    propertyId,
    guestId,
    guestFirstName: "Guest",
    guestLastName: "WH",
    guestEmail: `guest_p7wh_${ts}@test.ile.ng`,
    guestPhone: "+2348010000099",
    guestCount: 1,
    checkInDate: "2026-11-01",
    checkOutDate: "2026-11-03",
    numberOfNights: 2,
    nightlyPrice: 100000,
    totalAmount: 101500,
    accommodationSubtotal: 100000,
    hostCommissionPct: 10,
    hostCommissionAmount: 10000,
    hostNetAmount: 90000,
    paystackFeeAmount: 1500,
    status: "CONFIRMED",
    accessToken: crypto.randomBytes(16).toString("hex"),
    guestCheckInConfirmedAt: new Date(),
    guestCheckInConfirmedBy: guestId,
  }).onConflictDoNothing()

  await db.insert(schema.payouts).values({
    id: payoutId,
    bookingId,
    hostId,
    amount: 90000,
    currency: "NGN",
    bankCode: "058",
    bankName: "Test Bank",
    accountNumber: "0123456789",
    accountName: "HOST WH",
    status: "PROCESSING",
    transferStatus: "PENDING",
    paystackTransferRef: transferRef,
    paystackRecipientCode: `RCP_p7wh_${ts}`,
  }).onConflictDoNothing()

  // Seed balanced CHECKIN_RECOGNITION so success path can post HOST_PAYOUT_DISBURSED cleanly
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.ledgerJournals.id })
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, bookingId),
          eq(schema.ledgerJournals.eventType, "CHECKIN_RECOGNITION")
        )
      )
      .limit(1)
    if (existing.length === 0) {
      await LedgerService.recognizeCheckInSettlement(tx, {
        bookingId,
        accommodationSubtotal: 100000,
        hostNetAmount: 90000,
        hostCommissionAmount: 10000,
      })
    }
  })

  // recognizeCheckInSettlement may have moved payout to READY — restore PROCESSING for webhook tests
  await db
    .update(schema.payouts)
    .set({
      status: "PROCESSING",
      transferStatus: "PENDING",
      paystackTransferRef: transferRef,
      updatedAt: new Date(),
    })
    .where(eq(schema.payouts.id, payoutId))

  it("1. HMAC verify accepts valid signature and rejects invalid/empty", () => {
    const body = JSON.stringify({ event: "transfer.success", data: { reference: "x" } })
    const valid = sign(body)
    assert.equal(verifyPaystackWebhookSignature(body, valid), true)
    assert.equal(verifyPaystackWebhookSignature(body, valid.slice(0, -2) + "ff"), false)
    assert.equal(verifyPaystackWebhookSignature(body, ""), false)
    assert.equal(verifyPaystackWebhookSignature(body, valid.slice(0, 16)), false)
  })

  it("2. Invalid signature throws before any payout mutation", async () => {
    const body = JSON.stringify({
      id: `evt_bad_${ts}`,
      event: "transfer.failed",
      data: { reference: transferRef, reason: "should not apply" },
    })
    await assert.rejects(
      () => handlePaystackWebhook(body, "deadbeef"),
      /Invalid Paystack webhook signature/i
    )
    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1)
    assert.equal(payout.status, "PROCESSING")
  })

  it("3. transfer.failed restores READY_FOR_PAYOUT (not FAILED wallet status)", async () => {
    const body = JSON.stringify({
      id: `evt_fail_${ts}`,
      event: "transfer.failed",
      data: {
        reference: transferRef,
        transfer_code: `TRF_C_${ts}`,
        reason: "Destination bank unavailable",
      },
    })
    const result = await handlePaystackWebhook(body, sign(body))
    assert.equal(result.processed, true)

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1)
    assert.equal(payout.status, "READY_FOR_PAYOUT")
    assert.equal(payout.transferStatus, "FAILED")
    assert.match(payout.transferFailureReason || "", /unavailable/i)
  })

  it("4. transfer.success pays once; replay is idempotent with no double journal", async () => {
    await db
      .update(schema.payouts)
      .set({
        status: "PROCESSING",
        transferStatus: "PENDING",
        paystackTransferRef: transferRef,
        updatedAt: new Date(),
      })
      .where(eq(schema.payouts.id, payoutId))

    const eventId = `evt_ok_${ts}`
    const body = JSON.stringify({
      id: eventId,
      event: "transfer.success",
      data: {
        id: 88001,
        reference: transferRef,
        transfer_code: `TRF_OK_${ts}`,
        amount: 9000000,
        transferred_at: new Date().toISOString(),
      },
    })
    const sig = sign(body)

    const first = await handlePaystackWebhook(body, sig)
    assert.equal(first.processed, true)

    const [paid] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1)
    assert.equal(paid.status, "PAID")
    assert.equal(paid.transferStatus, "SUCCESS")

    const journalsAfterFirst = await db
      .select()
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, payoutId),
          eq(schema.ledgerJournals.eventType, "HOST_PAYOUT_DISBURSED")
        )
      )
    assert.equal(journalsAfterFirst.length, 1)

    const replay = await handlePaystackWebhook(body, sig)
    assert.equal(replay.processed, true)
    assert.match(replay.message, /already processed \(idempotent\)/i)

    const journalsAfterReplay = await db
      .select()
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, payoutId),
          eq(schema.ledgerJournals.eventType, "HOST_PAYOUT_DISBURSED")
        )
      )
    assert.equal(journalsAfterReplay.length, 1)

    const [stillPaid] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1)
    assert.equal(stillPaid.status, "PAID")
  })

  it("5. Late transfer.failed after PAID does not demote wallet status", async () => {
    const body = JSON.stringify({
      id: `evt_late_fail_${ts}`,
      event: "transfer.failed",
      data: {
        reference: transferRef,
        transfer_code: `TRF_OK_${ts}`,
        reason: "Late fail after success",
      },
    })
    const result = await handlePaystackWebhook(body, sign(body))
    assert.equal(result.processed, true)

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1)
    assert.equal(payout.status, "PAID")
  })
})
