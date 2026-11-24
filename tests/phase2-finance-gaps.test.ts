import test from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import fs from "fs"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { env } from "../backend/src/config/env"
import { initAndSeedDb } from "../backend/src/db/seed"
import { adminService } from "../backend/src/modules/admin/admin.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import {
  FinanceControlError,
  commissionFundsBalance,
  getAdminRefundPreview,
  hostPayableBalance,
} from "../backend/src/modules/finance/admin-refund.service"
import {
  ACCOUNT_CODES,
  ensurePhase2Accounts,
  LedgerService,
} from "../backend/src/modules/finance/ledger.service"
import { resolveStayPricing } from "../backend/src/modules/pricing/pricing.service"
import {
  handlePaystackWebhook,
  verifyPaystackWebhookSignature,
} from "../backend/src/modules/payments/payments.service"

if ((env.DATABASE_URL || "").startsWith("postgres")) {
  throw new Error("Refusing finance gap tests against a configured Postgres URL.")
}

const db = getDb()
const ts = Date.now()

async function ensureUser(id: string, role: string, email: string) {
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (existing) return
  await db.insert(schema.users).values({
    id,
    email,
    passwordHash: "hash",
    firstName: "Gap",
    lastName: role,
    role,
    emailVerified: true,
    status: "ACTIVE",
  })
}

async function fundCommission(reference: string, amount: number) {
  await db.transaction(async (tx) => {
    await ensurePhase2Accounts(tx)
    await LedgerService.postJournalEntry(tx, {
      reference,
      eventType: "COMMISSION_ALLOCATION",
      narration: "Local test commission cash",
      entries: [
        { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "DEBIT", amount },
        { accountCode: ACCOUNT_CODES.PAYSTACK_CLEARING, entryType: "CREDIT", amount },
      ],
    })
  })
}

async function makePaidBooking(input: {
  id: string
  hostId: string
  propertyId: string
  amount: number
  status?: string
  withPayment?: boolean
}) {
  await db.insert(schema.properties).values({
    id: input.propertyId,
    hostId: input.hostId,
    slug: input.propertyId,
    title: "Gap Residence",
    description: "Gap test residence.",
    propertyType: "Apartment",
    pricePerNight: 100000,
    hostBasePrice: 100000,
    city: "Lagos",
    neighborhood: "Ikoyi",
    state: "Lagos",
    latitude: 6.45,
    longitude: 3.42,
    powerType: "Grid",
    coverImage: "/images/prop.jpg",
    status: "PUBLISHED",
    maxGuests: 2,
  })
  await db.insert(schema.bookings).values({
    id: input.id,
    referenceCode: input.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30),
    propertyId: input.propertyId,
    guestFirstName: "Ada",
    guestLastName: "Guest",
    guestEmail: `${input.id}@test.ile.ng`,
    guestPhone: "+2348010000099",
    checkInDate: "2026-12-01",
    checkOutDate: "2026-12-02",
    numberOfNights: 1,
    nightlyPrice: input.amount,
    totalAmount: input.amount,
    accommodationSubtotal: input.amount,
    hostNetAmount: input.amount,
    status: input.status || "CONFIRMED",
    accessToken: crypto.randomBytes(8).toString("hex"),
  })
  if (input.withPayment !== false) {
    await db.insert(schema.payments).values({
      id: `pay_${input.id}`,
      bookingId: input.id,
      reference: `ref_${input.id}`,
      amount: input.amount,
      currency: "NGN",
      method: "card",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
      gatewayReference: `gw_${input.id}`,
      paidAt: new Date(),
    })
  }
}

function sign(body: string) {
  return crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY || "").update(body).digest("hex")
}

test("local schema is available", async () => {
  await initAndSeedDb()
  const trial = await LedgerService.getTrialBalance()
  assert.equal(trial.totals.isBalanced, true)
})

test("commission rounding is once on the stay and caution is not in the price", () => {
  const priced = resolveStayPricing({
    pricePerNight: 40000,
    hostBasePrice: 33333,
    nights: 3,
    commissionRate: 0.1,
  })
  const hostBase = 33333 * 3
  assert.equal(priced.hostEarnings, hostBase)
  assert.equal(priced.accommodationSubtotal, Math.round(hostBase * 1.1))
  assert.equal(priced.platformCommission, priced.accommodationSubtotal - hostBase)
  assert.equal(priced.cleaningFee, 0)
  assert.ok(priced.totalGuestPayment < priced.accommodationSubtotal + 50000)
  const pricingSource = fs.readFileSync("backend/src/modules/pricing/pricing.service.ts", "utf8")
  const detail = fs.readFileSync("apps/mobile/lib/features/property/property_detail_screen.dart", "utf8")
  assert.doesNotMatch(pricingSource, /cautionFee/)
  assert.doesNotMatch(detail, /Refundable Security/)
})

test("commission setting records who, old, new, and when for new bookings only", async () => {
  const adminId = `usr_gap_admin_${ts}`
  await ensureUser(adminId, "admin", `gap_admin_${ts}@test.ile.ng`)
  const before = await adminService.getSettings()
  const next = before.defaultHostCommissionPct === 12 ? 11 : 12
  await adminService.updateSettings({ defaultHostCommissionPct: next }, adminId)
  const logs = await FinanceService.getFinancialAuditLog({ action: "SETTINGS_UPDATED", limit: 5 })
  const details = logs.logs[0]?.details as {
    previousCommissionPct?: number
    commissionPct?: number
    actorId?: string
    changedAt?: string
    appliesToNewBookingsOnly?: boolean
  }
  assert.equal(details.previousCommissionPct, before.defaultHostCommissionPct)
  assert.equal(details.commissionPct, next)
  assert.equal(details.actorId, adminId)
  assert.equal(typeof details.changedAt, "string")
  assert.equal(details.appliesToNewBookingsOnly, true)
  await adminService.updateSettings({ defaultHostCommissionPct: before.defaultHostCommissionPct }, adminId)
})

test("full refund, over-refundable, missing payment, expired stay, and non-admin approval", async () => {
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "success"
  const adminId = `usr_gap_admin_${ts}`
  const hostId = `usr_gap_host_${ts}`
  const guestId = `usr_gap_guest_${ts}`
  const otherId = `usr_gap_support_${ts}`
  await ensureUser(adminId, "admin", `gap_admin_${ts}@test.ile.ng`)
  await ensureUser(hostId, "host", `gap_host_${ts}@test.ile.ng`)
  await ensureUser(guestId, "guest", `gap_guest_${ts}@test.ile.ng`)
  await ensureUser(otherId, "guest", `gap_support_${ts}@test.ile.ng`)

  const fullId = `book_gap_full_${ts}`
  await makePaidBooking({
    id: fullId,
    hostId,
    propertyId: `prop_gap_full_${ts}`,
    amount: 4000,
  })
  await fundCommission(`fund-gap-full-${ts}`, 4000)
  const hostBefore = await hostPayableBalance()
  const full = await FinanceService.processRefund(adminId, {
    bookingId: fullId,
    reason: "full guest refund",
  })
  assert.equal(full.success, true)
  assert.equal(full.status, "SUCCESSFUL")
  assert.equal(full.refundedAmount, 4000)
  assert.equal(await hostPayableBalance(), hostBefore)

  await assert.rejects(
    () => FinanceService.processRefund(adminId, {
      bookingId: fullId,
      reason: "second slice over the remainder",
      amountNaira: 1,
    }),
    (err: any) => err instanceof FinanceControlError && err.code === "EXCEEDS_REFUNDABLE"
  )

  const unpaidId = `book_gap_unpaid_${ts}`
  await makePaidBooking({
    id: unpaidId,
    hostId,
    propertyId: `prop_gap_unpaid_${ts}`,
    amount: 2000,
    withPayment: false,
  })
  await assert.rejects(
    () => FinanceService.processRefund(adminId, { bookingId: unpaidId, reason: "no verified payment", amountNaira: 1000 }),
    (err: any) => err instanceof FinanceControlError && err.code === "NO_VERIFIED_PAYMENT"
  )

  const expiredId = `book_gap_expired_${ts}`
  await makePaidBooking({
    id: expiredId,
    hostId,
    propertyId: `prop_gap_expired_${ts}`,
    amount: 2000,
    status: "EXPIRED",
  })
  await assert.rejects(
    () => FinanceService.processRefund(adminId, { bookingId: expiredId, reason: "do not revive expired", amountNaira: 500 }),
    (err: any) => err instanceof FinanceControlError && err.code === "BOOKING_NOT_REFUNDABLE"
  )

  await assert.rejects(
    () => FinanceService.approveRefund(guestId, "ref_missing"),
    (err: any) => err instanceof FinanceControlError && err.code === "ADMIN_REQUIRED"
  )
  await assert.rejects(
    () => FinanceService.rejectRefund(hostId, "ref_missing", "host cannot reject"),
    (err: any) => err instanceof FinanceControlError && err.code === "ADMIN_REQUIRED"
  )

  const preview = await getAdminRefundPreview(fullId)
  assert.equal(preview.originalPayment, 4000)
  assert.equal(preview.refundable, 0)
  assert.equal(preview.priorRefunds.length, 1)
  assert.equal(preview.fundingAccount, "1040")
})

test("failed, reversed, and unreconciled refunds do not mark success or debit the host", async () => {
  const adminId = `usr_gap_admin_${ts}`
  const hostId = `usr_gap_host_${ts}`
  await ensureUser(adminId, "admin", `gap_admin_${ts}@test.ile.ng`)
  await ensureUser(hostId, "host", `gap_host_${ts}@test.ile.ng`)
  const hostBefore = await hostPayableBalance()

  const failedId = `book_gap_fail_${ts}`
  await makePaidBooking({ id: failedId, hostId, propertyId: `prop_gap_fail_${ts}`, amount: 2500 })
  await fundCommission(`fund-gap-fail-${ts}`, 2500)
  const fundsBefore = await commissionFundsBalance()
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "failed"
  const failed = await FinanceService.processRefund(adminId, {
    bookingId: failedId,
    reason: "provider failed the refund",
    amountNaira: 2500,
  })
  assert.equal(failed.success, false)
  assert.equal(failed.status, "FAILED")
  assert.equal(await commissionFundsBalance(), fundsBefore)
  assert.equal(await hostPayableBalance(), hostBefore)

  const reversedId = `book_gap_rev_${ts}`
  await makePaidBooking({ id: reversedId, hostId, propertyId: `prop_gap_rev_${ts}`, amount: 1800 })
  await fundCommission(`fund-gap-rev-${ts}`, 1800)
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "reversed"
  const reversed = await FinanceService.processRefund(adminId, {
    bookingId: reversedId,
    reason: "provider reversed the refund",
    amountNaira: 1800,
  })
  assert.equal(reversed.success, false)
  assert.equal(reversed.status, "REVERSED")
  assert.equal(await hostPayableBalance(), hostBefore)

  const pendingId = `book_gap_recon_${ts}`
  await makePaidBooking({ id: pendingId, hostId, propertyId: `prop_gap_recon_${ts}`, amount: 1600 })
  await fundCommission(`fund-gap-recon-${ts}`, 1600)
  const beforeReserve = await commissionFundsBalance()
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "unknown"
  const pending = await FinanceService.processRefund(adminId, {
    bookingId: pendingId,
    reason: "provider result was not verified",
    amountNaira: 1600,
  })
  assert.equal(pending.success, false)
  assert.equal(pending.status, "RECONCILIATION_REQUIRED")
  assert.equal(await commissionFundsBalance(), beforeReserve - 1600)
  assert.equal(await hostPayableBalance(), hostBefore)
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "success"
})

test("concurrent refunds cannot spend the same verified payment twice", async () => {
  process.env.PAYSTACK_REFUND_MOCK_RESULT = "success"
  const adminId = `usr_gap_admin_${ts}`
  const hostId = `usr_gap_host_${ts}`
  await ensureUser(adminId, "admin", `gap_admin_${ts}@test.ile.ng`)
  await ensureUser(hostId, "host", `gap_host_${ts}@test.ile.ng`)
  const bookingId = `book_gap_race_${ts}`
  await makePaidBooking({ id: bookingId, hostId, propertyId: `prop_gap_race_${ts}`, amount: 10000 })
  await fundCommission(`fund-gap-race-${ts}`, 20000)
  const hostBefore = await hostPayableBalance()
  const results = await Promise.allSettled([
    FinanceService.processRefund(adminId, { bookingId, reason: "concurrent refund alpha", amountNaira: 8000 }),
    FinanceService.processRefund(adminId, { bookingId, reason: "concurrent refund beta", amountNaira: 8000 }),
  ])
  const fulfilled = results.filter((row) => row.status === "fulfilled") as PromiseFulfilledResult<any>[]
  const rejected = results.filter((row) => row.status === "rejected") as PromiseRejectedResult[]
  assert.equal(fulfilled.length, 1)
  assert.equal(rejected.length, 1)
  assert.equal(fulfilled[0].value.status, "SUCCESSFUL")
  assert.equal((rejected[0].reason as any).code, "EXCEEDS_REFUNDABLE")
  assert.equal(await hostPayableBalance(), hostBefore)
  const preview = await getAdminRefundPreview(bookingId)
  assert.equal(preview.refundable, 2000)
})

test("partial withdrawal failure restores available, over-balance and other hosts are rejected", async () => {
  const hostA = `usr_gap_wd_a_${ts}`
  const hostB = `usr_gap_wd_b_${ts}`
  await ensureUser(hostA, "host", `gap_wd_a_${ts}@test.ile.ng`)
  await ensureUser(hostB, "host", `gap_wd_b_${ts}@test.ile.ng`)
  for (const hostId of [hostA, hostB]) {
    await db.insert(schema.profiles).values({
      id: `prof_${hostId}`,
      userId: hostId,
      bankName: "GTBank",
      bankCode: "058",
      bankAccountNumber: "0123456789",
      bankAccountName: "HOST WALLET",
      bankAccountVerifiedAt: new Date(),
      paystackRecipientCode: "RCP_phase2gaprecipient",
    })
  }
  const bookingA = `book_gap_wd_a_${ts}`
  const bookingB = `book_gap_wd_b_${ts}`
  await makePaidBooking({ id: bookingA, hostId: hostA, propertyId: `prop_gap_wd_a_${ts}`, amount: 100000, withPayment: false })
  await makePaidBooking({ id: bookingB, hostId: hostB, propertyId: `prop_gap_wd_b_${ts}`, amount: 10000, withPayment: false })
  const payoutA = `payo_gap_a_${ts}`
  await db.insert(schema.payouts).values({
    id: payoutA,
    bookingId: bookingA,
    hostId: hostA,
    amount: 100000,
    currency: "NGN",
    status: "READY_FOR_PAYOUT",
    payoutMode: "MANUAL",
  })
  await db.insert(schema.payouts).values({
    id: `payo_gap_b_${ts}`,
    bookingId: bookingB,
    hostId: hostB,
    amount: 10000,
    currency: "NGN",
    status: "READY_FOR_PAYOUT",
    payoutMode: "MANUAL",
  })

  process.env.PAYSTACK_TRANSFER_MOCK_RESULT = "failed"
  const failed = await FinanceService.requestHostWithdrawal(hostA, { amountNaira: 25000 })
  assert.equal(failed.restoredAmount, 25000)
  const afterFail = await FinanceService.getHostWallet(hostA)
  assert.equal(afterFail.balances.available, 100000)
  assert.ok((afterFail.balances.failedWithdrawalCount || 0) >= 1)

  process.env.PAYSTACK_TRANSFER_MOCK_RESULT = "pending"
  const raced = await Promise.allSettled([
    FinanceService.requestHostWithdrawal(hostA, { amountNaira: 70000 }),
    FinanceService.requestHostWithdrawal(hostA, { amountNaira: 70000 }),
  ])
  const walletA = await FinanceService.getHostWallet(hostA)
  assert.equal(walletA.balances.available + walletA.balances.processing, 100000)
  assert.ok(walletA.balances.processing <= 70000)
  assert.equal(raced.filter((row) => row.status === "fulfilled").length, 1)

  await assert.rejects(
    () => FinanceService.requestHostWithdrawal(hostB, { amountNaira: 10000, payoutIds: [payoutA] }),
    (err: any) => err.code === "RESERVE_FAILED" || err.code === "INSUFFICIENT_AVAILABLE"
  )
  const stillA = await FinanceService.getHostWallet(hostA)
  const stillB = await FinanceService.getHostWallet(hostB)
  assert.equal(stillB.balances.available, 10000)
  assert.equal(stillA.balances.available + stillA.balances.processing, 100000)
})

test("duplicate payment, transfer, and refund webhooks do not post twice", async () => {
  assert.equal(typeof env.PAYSTACK_SECRET_KEY, "string")
  assert.equal(verifyPaystackWebhookSignature("{}", "deadbeef"), false)

  const hostId = `usr_gap_hook_${ts}`
  await ensureUser(hostId, "host", `gap_hook_${ts}@test.ile.ng`)
  const bookingId = `book_gap_hook_${ts}`
  const reference = `ref_hook_${ts}`
  await makePaidBooking({
    id: bookingId,
    hostId,
    propertyId: `prop_gap_hook_${ts}`,
    amount: 5000,
    withPayment: false,
  })
  await db.insert(schema.payments).values({
    id: `pay_hook_${ts}`,
    bookingId,
    reference,
    amount: 5000,
    currency: "NGN",
    method: "card",
    status: "SUCCESS",
    gatewayProvider: "PAYSTACK",
    gatewayReference: `gw_hook_${ts}`,
    paidAt: new Date(),
  })
  const journalsBefore = await db.select({ id: schema.ledgerJournals.id }).from(schema.ledgerJournals)
  const charge = JSON.stringify({
    event: "charge.success",
    data: { id: `chg_${ts}`, reference, amount: 500000, currency: "NGN" },
  })
  const firstCharge = await handlePaystackWebhook(charge, sign(charge))
  const secondCharge = await handlePaystackWebhook(charge, sign(charge))
  assert.match(firstCharge.message, /charge\.success|already processed/)
  assert.match(secondCharge.message, /already processed/)
  const journalsAfter = await db.select({ id: schema.ledgerJournals.id }).from(schema.ledgerJournals)
  assert.equal(journalsAfter.length, journalsBefore.length)

  const transfer = JSON.stringify({
    event: "transfer.failed",
    data: { id: `trf_${ts}`, reference: `missing_trf_${ts}`, reason: "mock failure" },
  })
  const firstTransfer = await handlePaystackWebhook(transfer, sign(transfer))
  const secondTransfer = await handlePaystackWebhook(transfer, sign(transfer))
  assert.match(secondTransfer.message, /already processed/)
  assert.match(firstTransfer.message, /transfer\.failed/)

  const refundEvent = JSON.stringify({
    event: "refund.processed",
    data: { id: `rfd_${ts}`, amount: 100000, transaction: { reference: `missing_rfd_${ts}` } },
  })
  await handlePaystackWebhook(refundEvent, sign(refundEvent))
  const secondRefund = await handlePaystackWebhook(refundEvent, sign(refundEvent))
  assert.match(secondRefund.message, /already processed/)
})

test("a reversed transfer returns the payout to available once", async () => {
  const hostId = `usr_gap_revwd_${ts}`
  await ensureUser(hostId, "host", `gap_revwd_${ts}@test.ile.ng`)
  const bookingId = `book_gap_revwd_${ts}`
  const payoutId = `payo_gap_revwd_${ts}`
  const transferRef = `ILE_REV_${ts}`
  await makePaidBooking({ id: bookingId, hostId, propertyId: `prop_gap_revwd_${ts}`, amount: 9000, withPayment: false })
  await db.insert(schema.payouts).values({
    id: payoutId,
    bookingId,
    hostId,
    amount: 9000,
    currency: "NGN",
    status: "READY_FOR_PAYOUT",
    payoutMode: "MANUAL",
  })
  await db.transaction(async (tx) => {
    await ensurePhase2Accounts(tx)
    await LedgerService.recordHostPayout(tx, {
      payoutId,
      bookingId,
      hostId,
      amount: 9000,
      transferRef,
      notes: "local reversal fixture",
    })
  })
  const hostBefore = await hostPayableBalance()
  const body = JSON.stringify({
    event: "transfer.reversed",
    data: { id: `rev_${ts}`, reference: transferRef, transfer_code: `TRF_${ts}`, reason: "bank reversed" },
  })
  const first = await handlePaystackWebhook(body, sign(body))
  const second = await handlePaystackWebhook(body, sign(body))
  assert.match(first.message, /transfer\.reversed/)
  assert.match(second.message, /already processed/)
  const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, payoutId)).limit(1)
  assert.equal(payout.status, "READY_FOR_PAYOUT")
  assert.equal(payout.transferStatus, "REVERSED")
  assert.equal(await hostPayableBalance(), hostBefore + 9000)
  const wallet = await FinanceService.getHostWallet(hostId)
  assert.equal(wallet.balances.available, 9000)
})

test("reconciliation flags a successful refund that has no matching ledger expense", async () => {
  const hostId = `usr_gap_reconrow_${ts}`
  await ensureUser(hostId, "host", `gap_reconrow_${ts}@test.ile.ng`)
  const bookingId = `book_gap_reconrow_${ts}`
  await makePaidBooking({ id: bookingId, hostId, propertyId: `prop_gap_reconrow_${ts}`, amount: 777, withPayment: false })
  const before = await FinanceService.getReconciliationSummary()
  const beforeDiff = (before.discrepancies || []).find((row: { code: string }) => row.code === "REFUND_LEDGER_MISMATCH")?.difference || 0
  await db.insert(schema.refunds).values({
    id: `ref_gap_orphan_${ts}`,
    bookingId,
    grossPaid: 777,
    nonRefundableProcessingFee: 0,
    refundableAmount: 777,
    currency: "NGN",
    status: "SUCCESSFUL",
    reason: "orphan row for reconciliation",
  })
  const after = await FinanceService.getReconciliationSummary()
  const mismatch = after.discrepancies.find((row: { code: string }) => row.code === "REFUND_LEDGER_MISMATCH")
  assert.ok(mismatch)
  assert.equal(mismatch.difference, beforeDiff + 777)
  assert.equal(after.hasDiscrepancy, true)
})
