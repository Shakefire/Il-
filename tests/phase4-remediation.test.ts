/**
 * Phase 4 remediation tests. Prefer scripts/run_phase4_tests.ps1.
 * Uses configured DATABASE_URL (dev) like prior phase suites; rows are uniquely prefixed.
 * SQL migrations for 0008–0011 are applied only on disposable PGlite via apply_migrations_pglite.ts.
 */
import "dotenv/config"
import test, { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import { getStayDetails } from "../backend/src/modules/bookings/stay-details"
import {
  executeAdminRefund,
  getAdminRefundPreview,
  commissionFundsBalance,
} from "../backend/src/modules/finance/admin-refund.service"
import { ensurePhase2Accounts, LedgerService, ACCOUNT_CODES } from "../backend/src/modules/finance/ledger.service"
import { defaultThingsToKnow } from "../backend/src/modules/properties/properties.service"
import { consumeRateLimitAsync, isGlobalRateLimitExempt, resetRateLimits } from "../backend/src/lib/rate-limit"

const testEnv = process.env as Record<string, string | undefined>
testEnv.NODE_ENV = "test"
testEnv.PAYSTACK_MOCK_TRANSFERS = "true"
testEnv.PAYSTACK_REFUND_MOCK_RESULT = "success"

const db = getDb()
const ts = Date.now()

async function seedAdmin(): Promise<string> {
  const adminId = `usr_p4_admin_${ts}`
  try {
    await db.insert(schema.users).values({
      id: adminId,
      email: `${adminId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Admin",
      lastName: "Phase4",
      role: "admin",
      emailVerified: true,
      status: "ACTIVE",
    })
  } catch {
    // already exists
  }
  return adminId
}

async function fundCommission(amount: number, ref: string) {
  await db.transaction(async (tx: any) => {
    await ensurePhase2Accounts(tx)
    await LedgerService.postJournalEntry(tx, {
      reference: ref,
      eventType: "TEST_COMMISSION_FUND",
      narration: "Test fund commission account 1040",
      entries: [
        { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "DEBIT", amount },
        { accountCode: ACCOUNT_CODES.COMMISSION_REVENUE, entryType: "CREDIT", amount },
      ],
    })
  })
}

async function setupPaidBooking(opts: {
  suffix: string
  status: string
  amount?: number
  cancellationReason?: string | null
}) {
  const amount = opts.amount ?? 110000
  const hostId = `host_p4_${opts.suffix}_${ts}`
  const guestId = `guest_p4_${opts.suffix}_${ts}`
  const propertyId = `prop_p4_${opts.suffix}_${ts}`
  const bookingId = `bkg_p4_${opts.suffix}_${ts}`
  const paymentId = `pay_p4_${opts.suffix}_${ts}`

  for (const [id, role, email] of [
    [hostId, "host", `${hostId}@test.ile.ng`],
    [guestId, "guest", `${guestId}@test.ile.ng`],
  ] as const) {
    try {
      await db.insert(schema.users).values({
        id,
        email,
        passwordHash: "hash",
        firstName: "P4",
        lastName: role,
        role,
        emailVerified: true,
        status: "ACTIVE",
      })
    } catch {
      // ignore
    }
  }

  try {
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p4-${opts.suffix}-${ts}`,
      title: `Phase4 ${opts.suffix}`,
      description: "Phase 4 test listing",
      propertyType: "Apartment",
      pricePerNight: 100000,
      hostBasePrice: 90000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Grid",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
  } catch (err: any) {
    throw new Error(`property insert failed for ${propertyId}: ${err?.cause?.message || err?.message || err}`)
  }

  await db.insert(schema.bookings).values({
    id: bookingId,
    propertyId,
    guestId,
    referenceCode: `P4${opts.suffix}${String(ts).slice(-6)}`.slice(0, 20),
    accessToken: crypto.randomBytes(16).toString("hex"),
    status: opts.status,
    guestFirstName: "Guest",
    guestLastName: "Phase4",
    guestEmail: `${guestId}@test.ile.ng`,
    guestPhone: "+2348011111111",
    guestCount: 2,
    checkInDate: "2026-12-10",
    checkOutDate: "2026-12-12",
    numberOfNights: 2,
    nightlyPrice: 100000,
    cleaningFee: 0,
    serviceFee: 10000,
    totalAmount: amount,
    currency: "NGN",
    accommodationSubtotal: 100000,
    hostCommissionPct: 10,
    hostCommissionAmount: 10000,
    hostNetAmount: 90000,
    cancellationReason: opts.cancellationReason || null,
    cancelledAt: opts.status === "CANCELLED" || opts.status === "EXPIRED" ? new Date() : null,
  })

  await db.insert(schema.payments).values({
    id: paymentId,
    bookingId,
    reference: `psk_p4_${opts.suffix}_${ts}`,
    gatewayReference: `psk_p4_${opts.suffix}_${ts}`,
    amount,
    currency: "NGN",
    method: "card",
    status: "SUCCESS",
    paidAt: new Date(),
  })

  return { hostId, guestId, propertyId, bookingId, paymentId, amount }
}

describe("Phase 4 — House Pass removal", () => {
  it("repo no longer ships house-pass module or residual routes/aliases", () => {
    assert.equal(fs.existsSync("backend/src/modules/bookings/house-pass.ts"), false)
    assert.equal(fs.existsSync("backend/src/modules/bookings/stay-details.ts"), true)
    assert.equal(fs.existsSync("src/app/api/bookings/[id]/house-pass/route.ts"), false)
    const routes = fs.readFileSync("backend/src/modules/bookings/bookings.routes.ts", "utf8")
    assert.doesNotMatch(routes, /house-pass/)
    assert.doesNotMatch(routes, /HOUSE_PASS_REMOVED/)
    assert.doesNotMatch(routes, /sendHousePass/)
    const flutterApi = fs.readFileSync("apps/mobile/lib/core/api/ile_api.dart", "utf8")
    assert.doesNotMatch(flutterApi, /getHousePass/)
    assert.match(flutterApi, /getStayDetails/)
  })

  it("defaults do not invent check-in times, Solar+Inverter, or caution fees", () => {
    const defaults = defaultThingsToKnow({ maxGuests: 3, powerType: "Grid" })
    assert.equal(defaults.checkInAfter, "")
    assert.equal(defaults.checkInMethod, "")
    assert.equal(defaults.safetyAndPower.hasSolarInverter, false)
    assert.equal(defaults.safetyAndPower.hasExteriorCCTV, false)
    assert.equal(defaults.cautionFeeNgn, 0)
    assert.deepEqual(defaults.customRules, [])
  })
})

describe("Phase 4 — Expiration targeting", () => {
  it("targeted expire cannot sweep globally and never touches CONFIRMED", async () => {
    const hostId = `host_p4_exp_${ts}`
    const guestA = `guest_p4_exp_a_${ts}`
    const guestB = `guest_p4_exp_b_${ts}`
    const propId = `prop_p4_exp_${ts}`
    const dueId = `bkg_p4_exp_due_${ts}`
    const confirmedId = `bkg_p4_exp_ok_${ts}`
    const otherDueId = `bkg_p4_exp_other_${ts}`

    for (const [id, role] of [
      [hostId, "host"],
      [guestA, "guest"],
      [guestB, "guest"],
    ] as const) {
      try {
        await db.insert(schema.users).values({
          id,
          email: `${id}@test.ile.ng`,
          passwordHash: "hash",
          firstName: "E",
          lastName: role,
          role,
          emailVerified: true,
          status: "ACTIVE",
        })
      } catch {
        // ignore duplicate
      }
    }

    try {
      await db.insert(schema.properties).values({
        id: propId,
        hostId,
        slug: `p4-exp-${ts}`,
        title: "Expire target",
        description: "Expire",
        propertyType: "Apartment",
        pricePerNight: 80000,
        city: "Lagos",
        neighborhood: "Ikoyi",
        state: "LA",
        latitude: 6.45,
        longitude: 3.43,
        powerType: "Grid",
        coverImage: "/images/prop.jpg",
        status: "PUBLISHED",
      })
    } catch (err: any) {
      throw new Error(`expire property insert failed: ${err?.cause?.message || err?.message || err}`)
    }

    const past = new Date(Date.now() - 60_000)
    for (const row of [
      { id: dueId, guestId: guestA, status: "PENDING_HOST", ref: `EXPDUE${String(ts).slice(-8)}` },
      { id: otherDueId, guestId: guestB, status: "PENDING_HOST", ref: `EXPOTH${String(ts).slice(-8)}` },
      { id: confirmedId, guestId: guestA, status: "CONFIRMED", ref: `EXPOK${String(ts).slice(-8)}` },
    ]) {
      await db.insert(schema.bookings).values({
        id: row.id,
        propertyId: propId,
        guestId: row.guestId,
        referenceCode: row.ref,
        accessToken: crypto.randomBytes(16).toString("hex"),
        status: row.status,
        guestFirstName: "G",
        guestLastName: "E",
        guestEmail: `${row.guestId}@test.ile.ng`,
        guestPhone: "+2348022222222",
        guestCount: 1,
        checkInDate: "2026-12-20",
        checkOutDate: "2026-12-22",
        numberOfNights: 2,
        nightlyPrice: 80000,
        cleaningFee: 0,
        serviceFee: 0,
        totalAmount: 160000,
        currency: "NGN",
        hostResponseDeadlineAt: past,
      })
      if (row.status === "PENDING_HOST") {
        await db.insert(schema.availabilityBlocks).values({
          id: `ab_${row.id}`,
          propertyId: propId,
          bookingId: row.id,
          startDate: "2026-12-20",
          endDate: "2026-12-22",
          type: "REQUEST_HOLD",
        })
      }
    }

    const targeted = await bookingsService.expireDueBookings(50, dueId)
    assert.equal(targeted.scope, "targeted")
    assert.deepEqual(targeted.bookingIds, [dueId])
    assert.ok(!targeted.bookingIds.includes(otherDueId))
    assert.ok(!targeted.bookingIds.includes(confirmedId))

    const [confirmed] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, confirmedId))
    assert.equal(confirmed.status, "CONFIRMED")

    const [other] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, otherDueId))
    assert.equal(other.status, "PENDING_HOST")

    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, dueId))
    assert.equal(blocks.length, 0)

    await assert.rejects(() => bookingsService.expireDueBookingsTargeted(""), /booking id/i)
  })
})

describe("Phase 4 — Refund contradiction & funding", () => {
  it("1 payment before deadline stays refundable while confirmed", async () => {
    const adminId = await seedAdmin()
    await fundCommission(500000, `fund_ok_${ts}`)
    const ctx = await setupPaidBooking({ suffix: "before", status: "CONFIRMED" })
    const preview = await getAdminRefundPreview(ctx.bookingId)
    assert.equal(preview.executable, true)
    assert.ok(preview.refundable > 0)
    const result = await executeAdminRefund({
      adminId,
      bookingId: ctx.bookingId,
      reason: "Guest cancelled within policy window",
      idempotencyKey: `idem_before_${ts}`,
      amountNaira: 10000,
    })
    assert.equal(result.success, true)
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, ctx.bookingId))
    assert.equal(booking.status, "CONFIRMED")
  })

  it("2-3 late payment after cancel: recon refund allowed, no revival, no host earnings", async () => {
    const adminId = await seedAdmin()
    await fundCommission(500000, `fund_late_${ts}`)
    const ctx = await setupPaidBooking({
      suffix: "late_cancel",
      status: "CANCELLED",
      cancellationReason: "PAYMENT_WINDOW_EXPIRED",
    })
    await db.insert(schema.refunds).values({
      id: `ref_req_${ctx.bookingId}`,
      bookingId: ctx.bookingId,
      guestId: ctx.guestId,
      grossPaid: ctx.amount,
      nonRefundableProcessingFee: 0,
      refundableAmount: ctx.amount,
      currency: "NGN",
      status: "APPROVED",
      approvedBy: adminId,
      approvedAt: new Date(),
      reason: "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
    })
    const preview = await getAdminRefundPreview(ctx.bookingId)
    assert.equal(preview.blockReason, null)
    assert.equal(preview.executable, true)
    assert.equal(preview.latePaymentReconciliation, true)

    const result = await executeAdminRefund({
      adminId,
      bookingId: ctx.bookingId,
      existingRefundId: `ref_req_${ctx.bookingId}`,
      reason: "Late payment reconciliation refund",
      idempotencyKey: `idem_late_cancel_${ts}`,
      amountNaira: Math.min(20000, ctx.amount),
    })
    assert.equal(result.bookingStatus, "CANCELLED")
    assert.notEqual(result.bookingStatus, "CONFIRMED")

    const earnings = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, ctx.bookingId))
    assert.equal(earnings.length, 0)
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, ctx.bookingId))
    assert.equal(booking.status, "CANCELLED")
  })

  it("4-5 duplicate payment recon keeps booking terminal and refundable", async () => {
    const adminId = await seedAdmin()
    await fundCommission(500000, `fund_dup_${ts}`)
    const ctx = await setupPaidBooking({
      suffix: "dup",
      status: "CANCELLED",
      cancellationReason: "PAYMENT_WINDOW_EXPIRED",
    })
    await db.insert(schema.payments).values({
      id: `pay_p4_dup2_${ts}`,
      bookingId: ctx.bookingId,
      reference: `psk_p4_dup2_${ts}`,
      gatewayReference: `psk_p4_dup2_${ts}`,
      amount: 50000,
      currency: "NGN",
      method: "card",
      status: "SUCCESS",
      paidAt: new Date(),
    })
    const preview = await getAdminRefundPreview(ctx.bookingId)
    assert.ok(preview.originalPayment >= ctx.amount + 50000)
    assert.equal(preview.executable, true)
    const result = await executeAdminRefund({
      adminId,
      bookingId: ctx.bookingId,
      reason: "Duplicate charge reconciliation",
      idempotencyKey: `idem_dup_${ts}`,
      amountNaira: 50000,
    })
    assert.equal(result.bookingStatus, "CANCELLED")
    assert.equal(result.fundingAccount, "1040")
  })

  it("6 normal cancel without verified payment is not refundable", async () => {
    const hostId = `host_p4_nocash_${ts}`
    const guestId = `guest_p4_nocash_${ts}`
    const propertyId = `prop_p4_nocash_${ts}`
    const bookingId = `bkg_p4_nocash_${ts}`
    await db.insert(schema.users).values({
      id: hostId,
      email: `${hostId}@test.ile.ng`,
      passwordHash: "h",
      firstName: "H",
      lastName: "H",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing()
    await db.insert(schema.users).values({
      id: guestId,
      email: `${guestId}@test.ile.ng`,
      passwordHash: "h",
      firstName: "G",
      lastName: "G",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing()
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `nocash-${ts}`,
      title: "No cash",
      description: "x",
      propertyType: "Apartment",
      pricePerNight: 50000,
      city: "Abuja",
      neighborhood: "Wuse",
      state: "FCT",
      latitude: 9,
      longitude: 7,
      powerType: "Grid",
      coverImage: "/x.jpg",
      status: "PUBLISHED",
    }).onConflictDoNothing()
    await db.insert(schema.bookings).values({
      id: bookingId,
      propertyId,
      guestId,
      referenceCode: `NC${String(ts).slice(-8)}`,
      accessToken: crypto.randomBytes(16).toString("hex"),
      status: "CANCELLED",
      guestFirstName: "G",
      guestLastName: "G",
      guestEmail: `${guestId}@test.ile.ng`,
      guestPhone: "+2348033333333",
      guestCount: 1,
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-02",
      numberOfNights: 1,
      nightlyPrice: 50000,
      cleaningFee: 0,
      serviceFee: 0,
      totalAmount: 50000,
      currency: "NGN",
      cancellationReason: "GUEST_CANCELLED_BEFORE_PAYMENT",
      cancelledAt: new Date(),
    })
    const preview = await getAdminRefundPreview(bookingId)
    assert.equal(preview.executable, false)
    assert.match(preview.blockReason || "", /verified successful/i)
  })

  it("7-9 partial then full, concurrent reservation, failed/unverified provider", async () => {
    const adminId = await seedAdmin()
    await fundCommission(1_000_000, `fund_partial_${ts}`)
    const ctx = await setupPaidBooking({ suffix: "partial", status: "CONFIRMED", amount: 100000 })

    const partial = await executeAdminRefund({
      adminId,
      bookingId: ctx.bookingId,
      reason: "Partial goodwill refund one",
      idempotencyKey: `idem_partial1_${ts}`,
      amountNaira: 30000,
    })
    assert.equal(partial.success, true)

    const preview = await getAdminRefundPreview(ctx.bookingId)
    assert.equal(preview.refundable, 70000)

    const full = await executeAdminRefund({
      adminId,
      bookingId: ctx.bookingId,
      reason: "Remainder refund after partial",
      idempotencyKey: `idem_partial2_${ts}`,
      amountNaira: 70000,
    })
    assert.equal(full.success, true)

    const over = await getAdminRefundPreview(ctx.bookingId)
    assert.equal(over.refundable, 0)
    assert.equal(over.executable, false)

    const ctx2 = await setupPaidBooking({ suffix: "conc", status: "CONFIRMED", amount: 80000 })
    const [a, b] = await Promise.all([
      executeAdminRefund({
        adminId,
        bookingId: ctx2.bookingId,
        reason: "Concurrent refund attempt A",
        idempotencyKey: `idem_conc_${ts}`,
        amountNaira: 10000,
      }),
      executeAdminRefund({
        adminId,
        bookingId: ctx2.bookingId,
        reason: "Concurrent refund attempt B",
        idempotencyKey: `idem_conc_${ts}`,
        amountNaira: 10000,
      }),
    ])
    assert.ok(a.refundId)
    assert.ok(b.refundId)
    const afterConc = await getAdminRefundPreview(ctx2.bookingId)
    assert.ok(afterConc.consumed <= ctx2.amount)

    testEnv.PAYSTACK_REFUND_MOCK_RESULT = "failed"
    const ctx3 = await setupPaidBooking({ suffix: "fail", status: "CONFIRMED", amount: 60000 })
    const failed = await executeAdminRefund({
      adminId,
      bookingId: ctx3.bookingId,
      reason: "Provider failed refund case",
      idempotencyKey: `idem_fail_${ts}`,
      amountNaira: 10000,
    })
    assert.equal(failed.success, false)
    assert.ok(["FAILED", "RECONCILIATION_REQUIRED"].includes(String(failed.status)))

    testEnv.PAYSTACK_REFUND_MOCK_RESULT = "unknown"
    const ctx4 = await setupPaidBooking({ suffix: "unk", status: "CONFIRMED", amount: 60000 })
    const unknown = await executeAdminRefund({
      adminId,
      bookingId: ctx4.bookingId,
      reason: "Unverified provider refund case",
      idempotencyKey: `idem_unk_${ts}`,
      amountNaira: 10000,
    })
    assert.equal(unknown.status, "RECONCILIATION_REQUIRED")
    testEnv.PAYSTACK_REFUND_MOCK_RESULT = "success"
  })

  it("10-12 insufficient commission blocks execute; host wallet never used", async () => {
    const adminId = await seedAdmin()
    const available = await commissionFundsBalance()
    const ctx = await setupPaidBooking({
      suffix: "nofund",
      status: "CANCELLED",
      cancellationReason: "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
      amount: Math.max(available + 250000, 250000),
    })
    await assert.rejects(
      () =>
        executeAdminRefund({
          adminId,
          bookingId: ctx.bookingId,
          reason: "Should block on commission shortfall",
          idempotencyKey: `idem_short_${ts}`,
          amountNaira: available + 1,
        }),
      /Commission account 1040/
    )
    const earnings = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, ctx.bookingId))
    assert.equal(earnings.length, 0)
  })

  it("13-16 fundingAccount 1040, rate-limit webhook exempt, stay details gate-free", async () => {
    assert.equal(isGlobalRateLimitExempt("/api/payments/webhook", "POST"), true)
    assert.equal(isGlobalRateLimitExempt("/api/bookings", "POST"), false)
    resetRateLimits()
    const first = await consumeRateLimitAsync(`p4-test:${ts}`, 2, 60_000)
    assert.equal(first.ok, true)
    const second = await consumeRateLimitAsync(`p4-test:${ts}`, 2, 60_000)
    assert.equal(second.ok, true)
    const third = await consumeRateLimitAsync(`p4-test:${ts}`, 2, 60_000)
    assert.equal(third.ok, false)

    const ctx = await setupPaidBooking({ suffix: "stay", status: "CONFIRMED" })
    const stay = await getStayDetails(ctx.bookingId, ctx.guestId)
    assert.equal(stay.paymentVerified, true)
    assert.equal((stay as any).gateInstructions, undefined)
    assert.equal((stay as any).accessGateCode, undefined)
  })
})

test("phase4 migration file exists and documents House Pass removal", () => {
  const sqlPath = path.join("backend", "src", "db", "migrations", "0011_phase4_house_pass_removal.sql")
  assert.equal(fs.existsSync(sqlPath), true)
  const body = fs.readFileSync(sqlPath, "utf8")
  assert.match(body, /rate_limit_buckets/)
  assert.match(body, /House Pass/)
})
