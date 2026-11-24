import "dotenv/config"
import test from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import fs from "fs"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import { adminService } from "../backend/src/modules/admin/admin.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import {
  commissionFundsBalance,
  hostPayableBalance,
  FinanceControlError,
} from "../backend/src/modules/finance/admin-refund.service"
import {
  ACCOUNT_CODES,
  ensurePhase2Accounts,
  LedgerService,
} from "../backend/src/modules/finance/ledger.service"
import { resolveStayPricing } from "../backend/src/modules/pricing/pricing.service"
import { defaultThingsToKnow } from "../backend/src/modules/properties/properties.service"
import { env } from "../backend/src/config/env"
import {
  handlePaystackWebhook,
  verifyPaystackWebhookSignature,
} from "../backend/src/modules/payments/payments.service"

const db = getDb()
const ts = Date.now()

async function ensureUser(id: string, role: string, email: string) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (existing) return
  await db.insert(schema.users).values({
    id,
    email,
    passwordHash: "hash",
    firstName: "Phase",
    lastName: role,
    role,
    emailVerified: true,
    status: "ACTIVE",
  })
}

test("commission math is a single markup and rounds the stay once", () => {
  const priced = resolveStayPricing({
    pricePerNight: 110000,
    hostBasePrice: 100000,
    nights: 2,
    commissionRate: 0.1,
  })
  assert.equal(priced.priceSource, "HOST_BASE")
  assert.equal(priced.hostEarnings, 200000)
  assert.equal(priced.accommodationSubtotal, 220000)
  assert.equal(priced.platformCommission, 20000)
  assert.equal(priced.hostEarnings + priced.platformCommission, priced.accommodationSubtotal)
  assert.equal(priced.cleaningFee, 0)
  assert.equal(priced.totalGuestPayment, 222000)
  assert.ok(priced.totalGuestPayment < 220000 + 50000, "caution fee is not added")
})

test("caution fee is absent from active defaults and the mobile proxy", () => {
  assert.equal(defaultThingsToKnow().cautionFeeNgn, 0)
  const proxy = fs.readFileSync("apps/mobile/cors_proxy.js", "utf8")
  assert.match(proxy, /cautionFeeNgn:\s*0/)
  assert.doesNotMatch(proxy, /cautionFeeNgn:\s*50000/)
  const seed = fs.readFileSync("backend/src/db/seed.ts", "utf8")
  assert.match(seed, /cleaningFee:\s*0/)
  assert.doesNotMatch(seed, /pricePerNight \* 0\.05/)
})

test("booking snapshots the host-base commission and ignores a later rate change", async () => {
  const hostId = `usr_p2_host_${ts}`
  const propertyId = `prop_p2_${ts}`
  await ensureUser(hostId, "host", `host_p2_${ts}@test.ile.ng`)
  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p2-${ts}`,
    title: "Phase 2 Residence",
    description: "Snapshot test residence.",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 100000,
    cleaningFee: 50000,
    serviceFeePct: 8,
    city: "Lagos",
    neighborhood: "Ikoyi",
    state: "Lagos",
    latitude: 6.45,
    longitude: 3.42,
    powerType: "Grid",
    coverImage: "/images/prop.jpg",
    status: "PUBLISHED",
    maxGuests: 4,
  })

  const settings = await adminService.getSettings()
  const originalPct = settings.defaultHostCommissionPct
  await adminService.updateSettings({ defaultHostCommissionPct: 10 }, `usr_p2_admin_${ts}`).catch(async () => {
    await ensureUser(`usr_p2_admin_${ts}`, "admin", `admin_p2_${ts}@test.ile.ng`)
    await adminService.updateSettings({ defaultHostCommissionPct: 10 }, `usr_p2_admin_${ts}`)
  })

  const checkIn = new Date(Date.now() + 140 * 86400000).toISOString().slice(0, 10)
  const checkOut = new Date(Date.now() + 142 * 86400000).toISOString().slice(0, 10)
  const created = await bookingsService.createBooking({
    propertyId,
    guestFirstName: "Ada",
    guestLastName: "Guest",
    guestEmail: `ada_${ts}@test.ile.ng`,
    guestPhone: "+2348010000001",
    guestCount: 1,
    checkInDate: checkIn,
    checkOutDate: checkOut,
  })

  assert.equal(created.pricing.cleaningFee, 0)
  assert.equal(created.pricing.accommodationSubtotal, 220000)
  assert.equal(created.pricing.hostNetAmount, 200000)
  assert.equal(created.pricing.hostCommissionAmount, 20000)
  assert.equal(created.booking.cleaningFee, 0)

  await ensureUser(`usr_p2_admin_${ts}`, "admin", `admin_p2_${ts}@test.ile.ng`)
  await adminService.updateSettings({ defaultHostCommissionPct: 20 }, `usr_p2_admin_${ts}`)
  const [unchanged] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
  assert.equal(unchanged.hostCommissionPct, 10)
  assert.equal(unchanged.hostCommissionAmount, 20000)
  assert.equal(unchanged.hostNetAmount, 200000)

  const laterIn = new Date(Date.now() + 150 * 86400000).toISOString().slice(0, 10)
  const laterOut = new Date(Date.now() + 152 * 86400000).toISOString().slice(0, 10)
  const later = await bookingsService.createBooking({
    propertyId,
    guestFirstName: "Bola",
    guestLastName: "Guest",
    guestEmail: `bola_${ts}@test.ile.ng`,
    guestPhone: "+2348010000002",
    guestCount: 1,
    checkInDate: laterIn,
    checkOutDate: laterOut,
  })
  assert.equal(later.pricing.hostCommissionAmount, 40000)
  assert.equal(later.pricing.hostNetAmount, 200000)
  await adminService.updateSettings({ defaultHostCommissionPct: originalPct }, `usr_p2_admin_${ts}`)
})

test("ledger stays balanced and duplicate webhooks do not post twice", async () => {
  const trial = await LedgerService.getTrialBalance()
  assert.equal(trial.totals.isBalanced, true)
  assert.equal(trial.totals.imbalance, 0)

  if (!env.PAYSTACK_SECRET_KEY) {
    assert.equal(verifyPaystackWebhookSignature("{}", "deadbeef"), false)
    console.log("DUPLICATE_WEBHOOK=BLOCKED no PAYSTACK_SECRET_KEY for signature replay")
    return
  }

  const body = JSON.stringify({
    event: "transfer.failed",
    data: { id: `evt_p2_${ts}`, reference: `missing_${ts}`, reason: "test replay" },
  })
  const signature = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(body).digest("hex")
  const first = await handlePaystackWebhook(body, signature)
  const second = await handlePaystackWebhook(body, signature)
  assert.match(first.message, /transfer\.failed/)
  assert.match(second.message, /already processed/)
  const rows = await db
    .select()
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.eventId, `evt_p2_${ts}`))
  assert.equal(rows.length, 1)
})

test("refunds are admin-only, commission-funded, and never debit the host", async () => {
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "success"
  const adminId = `usr_p2_admin_${ts}`
  const hostId = `usr_p2_hostref_${ts}`
  const guestId = `usr_p2_guest_${ts}`
  await ensureUser(adminId, "admin", `admin_p2_${ts}@test.ile.ng`)
  await ensureUser(hostId, "host", `hostref_p2_${ts}@test.ile.ng`)
  await ensureUser(guestId, "guest", `guest_p2_${ts}@test.ile.ng`)

  const propertyId = `prop_p2_ref_${ts}`
  const bookingId = `book_p2_ref_${ts}`
  const paid = 25000
  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p2-ref-${ts}`,
    title: "Refund Residence",
    description: "Refund funding test.",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 100000,
    cleaningFee: 50000,
    city: "Lagos",
    neighborhood: "Lekki",
    state: "Lagos",
    latitude: 6.45,
    longitude: 3.5,
    powerType: "Grid",
    coverImage: "/images/prop.jpg",
    status: "PUBLISHED",
    maxGuests: 2,
  })
  await db.insert(schema.bookings).values({
    id: bookingId,
    referenceCode: `ILE-P2-${String(ts).slice(-8)}`,
    propertyId,
    guestId,
    guestFirstName: "Ada",
    guestLastName: "Guest",
    guestEmail: `ada_${ts}@test.ile.ng`,
    guestPhone: "+2348010000001",
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-03",
    numberOfNights: 2,
    nightlyPrice: 110000,
    cleaningFee: 0,
    serviceFee: 0,
    totalAmount: paid,
    accommodationSubtotal: 220000,
    hostCommissionAmount: 20000,
    hostNetAmount: 200000,
    status: "CONFIRMED",
    accessToken: crypto.randomBytes(8).toString("hex"),
  })
  await db.insert(schema.payments).values({
    id: `pay_p2_${ts}`,
    bookingId,
    reference: `psk_p2_${ts}`,
    amount: paid,
    currency: "NGN",
    method: "card",
    status: "SUCCESS",
    gatewayProvider: "PAYSTACK",
    gatewayReference: `gw_p2_${ts}`,
    paidAt: new Date(),
  })

  await assert.rejects(
    () => FinanceService.processRefund(guestId, { bookingId, reason: "guest wants money back", amountNaira: 1000 }),
    (err: any) => err instanceof FinanceControlError && err.code === "ADMIN_REQUIRED"
  )
  await assert.rejects(
    () => FinanceService.processRefund(hostId, { bookingId, reason: "host wants to refund", amountNaira: 1000 }),
    (err: any) => err instanceof FinanceControlError && err.code === "ADMIN_REQUIRED"
  )

  const available = await commissionFundsBalance()
  const shortAsk = available + 1000
  await db.update(schema.payments).set({ amount: shortAsk }).where(eq(schema.payments.id, `pay_p2_${ts}`))
  await db.update(schema.bookings).set({ totalAmount: shortAsk }).where(eq(schema.bookings.id, bookingId))
  const hostBefore = await hostPayableBalance()
  await assert.rejects(
    () =>
      FinanceService.processRefund(adminId, {
        bookingId,
        reason: "short commission balance",
        amountNaira: shortAsk,
      }),
    (err: any) => err instanceof FinanceControlError && err.code === "INSUFFICIENT_COMMISSION" && err.shortfall === 1000
  )
  assert.equal(await hostPayableBalance(), hostBefore)

  await db.transaction(async (tx) => {
    await ensurePhase2Accounts(tx)
    await LedgerService.postJournalEntry(tx, {
      reference: `fund-p2-${ts}`,
      eventType: "COMMISSION_ALLOCATION",
      narration: "Test commission cash",
      entries: [
        { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "DEBIT", amount: 8000 },
        { accountCode: ACCOUNT_CODES.PAYSTACK_CLEARING, entryType: "CREDIT", amount: 8000 },
      ],
    })
  })
  await db.update(schema.payments).set({ amount: 8000 }).where(eq(schema.payments.id, `pay_p2_${ts}`))
  await db.update(schema.bookings).set({ totalAmount: 8000 }).where(eq(schema.bookings.id, bookingId))
  const fundedHost = await hostPayableBalance()
  const partial = await FinanceService.processRefund(adminId, {
    bookingId,
    reason: "partial guest refund",
    amountNaira: 3000,
  })
  assert.equal(partial.success, true)
  assert.equal(partial.refundedAmount, 3000)
  assert.equal(partial.status, "SUCCESSFUL")
  assert.equal(await hostPayableBalance(), fundedHost)

  const again = await FinanceService.processRefund(adminId, {
    bookingId,
    reason: "partial guest refund",
    amountNaira: 3000,
  })
  assert.equal(again.idempotent, true)
  assert.equal(await hostPayableBalance(), fundedHost)

  const cancelledId = `book_p2_cancel_${ts}`
  await db.insert(schema.bookings).values({
    id: cancelledId,
    referenceCode: `ILE-P2C-${String(ts).slice(-6)}`,
    propertyId,
    guestFirstName: "Ada",
    guestLastName: "Guest",
    guestEmail: `ada_${ts}@test.ile.ng`,
    guestPhone: "+2348010000001",
    checkInDate: "2026-12-10",
    checkOutDate: "2026-12-11",
    numberOfNights: 1,
    nightlyPrice: 1000,
    totalAmount: 1000,
    status: "CANCELLED",
    accessToken: crypto.randomBytes(8).toString("hex"),
  })
  await assert.rejects(
    () => FinanceService.processRefund(adminId, { bookingId: cancelledId, reason: "do not revive", amountNaira: 1000 }),
    (err: any) => err instanceof FinanceControlError && err.code === "BOOKING_NOT_REFUNDABLE"
  )

  const trial = await LedgerService.getTrialBalance()
  assert.equal(trial.totals.isBalanced, true)
})

test("partial withdrawal locks only the requested amount and over-balance is rejected", async () => {
  process.env.PAYSTACK_TRANSFER_MOCK_RESULT = "pending"
  const hostId = `usr_p2_wd_${ts}`
  const propertyId = `prop_p2_wd_${ts}`
  const bookingId = `book_p2_wd_${ts}`
  await ensureUser(hostId, "host", `wd_${ts}@test.ile.ng`)
  await db.insert(schema.profiles).values({
    id: `prof_p2_wd_${ts}`,
    userId: hostId,
    bankName: "GTBank",
    bankCode: "058",
    bankAccountNumber: "0123456789",
    bankAccountName: "HOST WALLET",
    bankAccountVerifiedAt: new Date(),
    paystackRecipientCode: "RCP_phase2testrecipient",
  })
  await db.insert(schema.properties).values({
    id: propertyId,
    hostId,
    slug: `p2-wd-${ts}`,
    title: "Withdrawal Residence",
    description: "Withdrawal test.",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 100000,
    city: "Abuja",
    neighborhood: "Wuse",
    state: "FCT",
    latitude: 9.06,
    longitude: 7.49,
    powerType: "Grid",
    coverImage: "/images/prop.jpg",
    status: "PUBLISHED",
    maxGuests: 2,
  })
  await db.insert(schema.bookings).values({
    id: bookingId,
    referenceCode: `ILE-WD-${String(ts).slice(-8)}`,
    propertyId,
    guestFirstName: "Ken",
    guestLastName: "Guest",
    guestEmail: `ken_${ts}@test.ile.ng`,
    guestPhone: "+2348010000003",
    checkInDate: "2026-12-20",
    checkOutDate: "2026-12-21",
    numberOfNights: 1,
    nightlyPrice: 100000,
    totalAmount: 110000,
    hostNetAmount: 100000,
    status: "CONFIRMED",
    accessToken: crypto.randomBytes(8).toString("hex"),
  })
  await db.insert(schema.payouts).values({
    id: `payo_p2_${ts}`,
    bookingId,
    hostId,
    amount: 100000,
    currency: "NGN",
    status: "READY_FOR_PAYOUT",
    payoutMode: "MANUAL",
  })

  await assert.rejects(
    () => FinanceService.requestHostWithdrawal(hostId, { amountNaira: 100001 }),
    (err: any) => err.code === "INSUFFICIENT_AVAILABLE"
  )
  const before = await FinanceService.getHostWallet(hostId)
  assert.equal(before.balances.available, 100000)
  assert.equal("hostCommissionAmount" in (before.history[0] || {}), false)

  const withdrawn = await FinanceService.requestHostWithdrawal(hostId, { amountNaira: 40000 })
  assert.equal(withdrawn.reservedAmount, 40000)
  const after = await FinanceService.getHostWallet(hostId)
  assert.equal(after.balances.available, 60000)
  assert.equal(after.balances.processing, 40000)
  assert.ok(after.balances.available >= 0)
})
