import "dotenv/config"
import test, { describe, it } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { resolveStayPricing } from "../backend/src/modules/pricing/pricing.service"
import { defaultThingsToKnow } from "../backend/src/modules/properties/properties.service"
import { ensurePhase2Accounts, LedgerService } from "../backend/src/modules/finance/ledger.service"
import { executeAdminRefund } from "../backend/src/modules/finance/admin-refund.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import { adminService } from "../backend/src/modules/admin/admin.service"

const testEnv = process.env as Record<string, string | undefined>
testEnv.NODE_ENV = "test"
testEnv.PAYSTACK_MOCK_TRANSFERS = "true"
testEnv.PAYSTACK_REFUND_MOCK_RESULT = "success"
testEnv.PAYSTACK_TRANSFER_MOCK_RESULT = "pending"

describe("Phase 2 finance redesign", () => {
  const db = getDb()
  const ts = Date.now()

  it("rounds guest price once from host base and does not add a caution fee", () => {
    const stay = resolveStayPricing({
      pricePerNight: 100000,
      hostBasePrice: 33333,
      nights: 3,
      commissionRate: 0.1,
    })
    assert.equal(stay.priceSource, "HOST_BASE")
    assert.equal(stay.hostEarnings, 99999)
    assert.equal(stay.accommodationSubtotal, 109999)
    assert.equal(stay.platformCommission, 10000)
    assert.equal(stay.cleaningFee, 0)
    assert.equal(stay.hostEarnings + stay.platformCommission, stay.accommodationSubtotal)

    const legacy = resolveStayPricing({
      pricePerNight: 100000,
      nights: 2,
      commissionRate: 0.1,
    })
    assert.equal(legacy.priceSource, "GUEST_PRICE_INVERSE")
    assert.equal(legacy.accommodationSubtotal, 200000)
    assert.equal(legacy.platformCommission, legacy.accommodationSubtotal - legacy.hostEarnings)
    assert.equal(defaultThingsToKnow().cautionFeeNgn, 0)
  })

  it("keeps an old commission snapshot when the admin rate changes", async () => {
    const adminId = "usr_admin_default"
    const before = await adminService.getSettings()
    const hostId = `host_p2s_${ts}`
    const propertyId = `prop_p2s_${ts}`
    await db.insert(schema.users).values({
      id: hostId,
      email: `${hostId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Snap",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    })
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p2-snap-${ts}`,
      title: "Snapshot stay",
      description: "Commission snapshot",
      propertyType: "Apartment",
      pricePerNight: 100000,
      hostBasePrice: 90000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    await adminService.updateSettings({ defaultHostCommissionPct: 10 }, adminId)
    const { bookingsService } = await import("../backend/src/modules/bookings/bookings.service")
    const inDate = new Date(Date.now() + 40 * 86400000).toISOString().split("T")[0]
    const outDate = new Date(Date.now() + 42 * 86400000).toISOString().split("T")[0]
    const created = await bookingsService.createBooking({
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `ada_p2_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      guestCount: 1,
      checkInDate: inDate,
      checkOutDate: outDate,
    })
    assert.equal(created.pricing.hostCommissionPct, 10)
    assert.equal(created.pricing.hostNetAmount, created.pricing.classicHostEarnings)
    await adminService.updateSettings({ defaultHostCommissionPct: 15 }, adminId)
    const [saved] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.booking.id)).limit(1)
    assert.equal(saved.hostCommissionPct, 10)
    await adminService.updateSettings(
      { defaultHostCommissionPct: before.defaultHostCommissionPct },
      adminId
    )
  })

  it("blocks guest and host refund execution and refunds without a verified payment", async () => {
    const guestId = `guest_p2r_${ts}`
    const adminId = `admin_p2r_${ts}`
    const hostId = `host_p2r_${ts}`
    await db.insert(schema.users).values([
      {
        id: guestId,
        email: `${guestId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Guest",
        lastName: "User",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: hostId,
        email: `${hostId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Host",
        lastName: "User",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: adminId,
        email: `${adminId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        emailVerified: true,
        status: "ACTIVE",
      },
    ])
    const propertyId = `prop_p2r_${ts}`
    const bookingId = `book_p2r_${ts}`
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p2-refund-${ts}`,
      title: "Refund stay",
      description: "Refund controls",
      propertyType: "Apartment",
      pricePerNight: 100000,
      hostBasePrice: 90000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `ILE-P2R-${ts}`,
      propertyId,
      guestId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `${guestId}@test.ile.ng`,
      guestPhone: "+2348011111111",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-03",
      numberOfNights: 2,
      nightlyPrice: 99000,
      accommodationSubtotal: 198000,
      hostCommissionPct: 10,
      hostCommissionAmount: 18000,
      paystackFeeAmount: 2000,
      hostNetAmount: 180000,
      totalAmount: 200000,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    })
    await db.insert(schema.payouts).values({
      id: `pay_p2r_${ts}`,
      bookingId,
      hostId,
      amount: 180000,
      status: "HELD",
      currency: "NGN",
    })

    await assert.rejects(
      () => executeAdminRefund({
        adminId: guestId,
        bookingId,
        reason: "Guest tries to execute",
        idempotencyKey: `guest-${ts}`,
      }),
      (err: any) => err.code === "ADMIN_REQUIRED"
    )
    await assert.rejects(
      () => executeAdminRefund({
        adminId: hostId,
        bookingId,
        reason: "Host tries to execute",
        idempotencyKey: `host-${ts}`,
      }),
      (err: any) => err.code === "ADMIN_REQUIRED"
    )
    await assert.rejects(
      () => executeAdminRefund({
        adminId,
        bookingId,
        reason: "No verified payment yet",
        idempotencyKey: `nopay-${ts}`,
      }),
      (err: any) => err.code === "NO_VERIFIED_PAYMENT"
    )

    await db.insert(schema.payments).values({
      id: `pmt_p2r_${ts}`,
      bookingId,
      reference: `ref_p2r_${ts}`,
      amount: 200000,
      currency: "NGN",
      method: "CARD",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
      gatewayReference: `gw_p2r_${ts}`,
    })

    const payableBefore = await LedgerService.getTrialBalance()
    const hostBefore = payableBefore.rows.find((row) => row.code === "2020")?.netBalance || 0

    await assert.rejects(
      () => executeAdminRefund({
        adminId,
        bookingId,
        amountNaira: 200000,
        reason: "Blocked until commission cash exists",
        idempotencyKey: `short-${ts}`,
      }),
      (err: any) => err.code === "INSUFFICIENT_COMMISSION" && err.shortfall > 0
    )

    const [payoutStill] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, `pay_p2r_${ts}`)).limit(1)
    assert.equal(payoutStill.status, "HELD")

    await db.transaction(async (tx) => {
      await ensurePhase2Accounts(tx)
      await LedgerService.postJournalEntry(tx, {
        reference: `p2_fund_${ts}`,
        eventType: "TEST_COMMISSION_FUNDING",
        narration: "Test funding for commission account 1040",
        entries: [
          { accountCode: "1040", entryType: "DEBIT", amount: 25000 },
          { accountCode: "4010", entryType: "CREDIT", amount: 25000 },
        ],
      })
    })

    await assert.rejects(
      () => executeAdminRefund({
        adminId,
        bookingId,
        amountNaira: 200000,
        reason: "Still short of the full payment",
        idempotencyKey: `short2-${ts}`,
      }),
      (err: any) => err.code === "INSUFFICIENT_COMMISSION"
    )

    const paid = await executeAdminRefund({
      adminId,
      bookingId,
      amountNaira: 20000,
      reason: "Partial admin refund from commission cash",
      idempotencyKey: `ok-${ts}`,
    })
    assert.equal(paid.status, "SUCCESSFUL")
    assert.equal(paid.fundingAccount, "1040")
    assert.equal(paid.hostPayableUnchanged, true)

    const again = await executeAdminRefund({
      adminId,
      bookingId,
      amountNaira: 20000,
      reason: "Partial admin refund from commission cash",
      idempotencyKey: `ok-${ts}`,
    })
    assert.equal(again.idempotent, true)

    await assert.rejects(
      () => executeAdminRefund({
        adminId,
        bookingId,
        amountNaira: 190000,
        reason: "Above remaining refundable",
        idempotencyKey: `over-${ts}`,
      }),
      (err: any) => err.code === "EXCEEDS_REFUNDABLE"
    )

    const [payoutAfter] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, `pay_p2r_${ts}`)).limit(1)
    assert.equal(payoutAfter.status, "HELD")
    assert.equal(payoutAfter.amount, 180000)
    const [stay] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1)
    assert.equal(stay.status, "CONFIRMED")
    const after = await LedgerService.getTrialBalance()
    assert.equal(after.totals.isBalanced, true)
    const hostAfter = after.rows.find((row) => row.code === "2020")?.netBalance || 0
    assert.equal(hostAfter, hostBefore)
    const lines = await db
      .select({
        code: schema.ledgerAccounts.code,
        entryType: schema.ledgerEntries.entryType,
      })
      .from(schema.ledgerEntries)
      .innerJoin(schema.ledgerJournals, eq(schema.ledgerEntries.journalId, schema.ledgerJournals.id))
      .innerJoin(schema.ledgerAccounts, eq(schema.ledgerEntries.accountId, schema.ledgerAccounts.id))
      .where(eq(schema.ledgerJournals.reference, paid.refundId as string))
    const codes = new Set(lines.map((line) => line.code))
    assert.equal(codes.has("2020"), false)
    assert.equal(codes.has("1040"), true)
    assert.equal(codes.has("5030"), true)
  })

  it("supports a partial withdrawal and rejects an over-balance withdrawal", async () => {
    const hostId = `host_p2w_${ts}`
    const otherId = `host_p2w2_${ts}`
    const propertyId = `prop_p2w_${ts}`
    const bookingId = `book_p2w_${ts}`
    await db.insert(schema.users).values([
      {
        id: hostId,
        email: `${hostId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Wallet",
        lastName: "Host",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: otherId,
        email: `${otherId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Other",
        lastName: "Host",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
    ])
    await db.insert(schema.profiles).values({
      id: `prof_p2w_${ts}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
      bankName: "GTBank",
      bankCode: "058",
      bankAccountNumber: "0123456789",
      bankAccountName: "WALLET HOST",
      bankAccountVerifiedAt: new Date(),
    })
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p2-wallet-${ts}`,
      title: "Wallet stay",
      description: "Withdrawal",
      propertyType: "Apartment",
      pricePerNight: 10000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `ILE-P2W-${ts}`,
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `w_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-02",
      numberOfNights: 1,
      nightlyPrice: 10000,
      totalAmount: 10000,
      hostNetAmount: 10000,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    })
    await db.insert(schema.payouts).values({
      id: `pay_p2w_${ts}`,
      bookingId,
      hostId,
      amount: 10000,
      status: "READY_FOR_PAYOUT",
      currency: "NGN",
    })

    await assert.rejects(
      () => FinanceService.requestHostWithdrawal(otherId, { amountNaira: 1000 }),
      (err: any) => err.code === "NO_AVAILABLE_BALANCE" || err.code === "BANK_REQUIRED"
    )
    await assert.rejects(
      () => FinanceService.requestHostWithdrawal(hostId, { amountNaira: 10001 }),
      (err: any) => err.code === "INSUFFICIENT_AVAILABLE"
    )

    const partial = await FinanceService.requestHostWithdrawal(hostId, { amountNaira: 4000 })
    assert.equal(partial.reservedAmount, 4000)
    const rows = await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, bookingId))
    const ready = rows.find((row) => row.status === "READY_FOR_PAYOUT")
    const processing = rows.find((row) => row.status === "PROCESSING")
    assert.equal(ready?.amount, 6000)
    assert.equal(processing?.amount, 4000)
    assert.match(processing?.notes || "", /SPLIT_FROM:/)

    testEnv.PAYSTACK_TRANSFER_MOCK_RESULT = "failed"
    const failed = await FinanceService.requestHostWithdrawal(hostId, { amountNaira: 1000 })
    testEnv.PAYSTACK_TRANSFER_MOCK_RESULT = "pending"
    assert.equal(failed.restoredAmount, 1000)
    const wallet = await FinanceService.getHostWallet(hostId)
    assert.ok(wallet.balances.available >= 5000)
    assert.equal(wallet.balances.totalEarnings >= 10000, true)
    assert.equal("commissionAmount" in (wallet.history[0] || {}), false)
    assert.equal("hostCommissionAmount" in (wallet.history[0] || {}), false)
  })

  it("releases a reserved commission refund when Paystack verifies failure and rejects cancelled stays", async () => {
    const adminId = `admin_p2f_${ts}`
    const hostId = `host_p2f_${ts}`
    const bookingId = `book_p2f_${ts}`
    const propertyId = `prop_p2f_${ts}`
    await db.insert(schema.users).values([
      {
        id: adminId,
        email: `${adminId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Admin",
        lastName: "Fail",
        role: "admin",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: hostId,
        email: `${hostId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Host",
        lastName: "Fail",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
    ])
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p2-fail-${ts}`,
      title: "Fail stay",
      description: "Failed refund",
      propertyType: "Apartment",
      pricePerNight: 10000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `ILE-P2F-${ts}`,
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `fail_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-02",
      numberOfNights: 1,
      nightlyPrice: 10000,
      accommodationSubtotal: 10000,
      hostNetAmount: 9000,
      totalAmount: 10000,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    })
    await db.insert(schema.payments).values({
      id: `pmt_p2f_${ts}`,
      bookingId,
      reference: `ref_p2f_${ts}`,
      amount: 10000,
      currency: "NGN",
      method: "CARD",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
      gatewayReference: `gw_p2f_${ts}`,
    })
    await db.insert(schema.payouts).values({
      id: `pay_p2f_${ts}`,
      bookingId,
      hostId,
      amount: 9000,
      status: "READY_FOR_PAYOUT",
      currency: "NGN",
    })
    await db.transaction(async (tx) => {
      await ensurePhase2Accounts(tx)
      await LedgerService.postJournalEntry(tx, {
        reference: `p2_fail_fund_${ts}`,
        eventType: "TEST_COMMISSION_FUNDING",
        narration: "Test funding for a failed refund release",
        entries: [
          { accountCode: "1040", entryType: "DEBIT", amount: 8000 },
          { accountCode: "4010", entryType: "CREDIT", amount: 8000 },
        ],
      })
    })
    const before = await LedgerService.getTrialBalance()
    const fundsBefore = before.rows.find((row) => row.code === "1040")?.netBalance || 0
    const hostBefore = before.rows.find((row) => row.code === "2020")?.netBalance || 0
    testEnv.PAYSTACK_REFUND_MOCK_RESULT = "failed"
    const failed = await executeAdminRefund({
      adminId,
      bookingId,
      amountNaira: 3000,
      reason: "Provider rejected this refund",
      idempotencyKey: `fail-${ts}`,
    })
    testEnv.PAYSTACK_REFUND_MOCK_RESULT = "success"
    assert.equal(failed.status, "FAILED")
    assert.equal(failed.success, false)
    const after = await LedgerService.getTrialBalance()
    assert.equal(after.rows.find((row) => row.code === "1040")?.netBalance, fundsBefore)
    assert.equal(after.rows.find((row) => row.code === "2020")?.netBalance, hostBefore)
    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, `pay_p2f_${ts}`)).limit(1)
    assert.equal(payout.status, "READY_FOR_PAYOUT")
    assert.equal(payout.amount, 9000)

    await db.update(schema.bookings).set({ status: "CANCELLED" }).where(eq(schema.bookings.id, bookingId))
    await assert.rejects(
      () => executeAdminRefund({
        adminId,
        bookingId,
        amountNaira: 1000,
        reason: "Must not revive a cancelled stay",
        idempotencyKey: `cancel-${ts}`,
      }),
      (err: any) => err.code === "BOOKING_NOT_REFUNDABLE"
    )
  })

  it("lets only one concurrent withdrawal reserve the same available balance", async () => {
    const hostId = `host_p2c_${ts}`
    const propertyId = `prop_p2c_${ts}`
    const bookingId = `book_p2c_${ts}`
    await db.insert(schema.users).values({
      id: hostId,
      email: `${hostId}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Race",
      lastName: "Host",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    })
    await db.insert(schema.profiles).values({
      id: `prof_p2c_${ts}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
      bankName: "GTBank",
      bankCode: "058",
      bankAccountNumber: "0123456789",
      bankAccountName: "RACE HOST",
      bankAccountVerifiedAt: new Date(),
    })
    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `p2-race-${ts}`,
      title: "Race stay",
      description: "Concurrent withdrawal",
      propertyType: "Apartment",
      pricePerNight: 10000,
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    })
    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `ILE-P2C-${ts}`,
      propertyId,
      guestFirstName: "Ada",
      guestLastName: "Guest",
      guestEmail: `race_${ts}@test.ile.ng`,
      guestPhone: "+2348011111111",
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-02",
      numberOfNights: 1,
      nightlyPrice: 10000,
      totalAmount: 10000,
      hostNetAmount: 10000,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    })
    await db.insert(schema.payouts).values({
      id: `pay_p2c_${ts}`,
      bookingId,
      hostId,
      amount: 10000,
      status: "READY_FOR_PAYOUT",
      currency: "NGN",
    })

    const results = await Promise.allSettled([
      FinanceService.requestHostWithdrawal(hostId, { amountNaira: 7000 }),
      FinanceService.requestHostWithdrawal(hostId, { amountNaira: 7000 }),
    ])
    const fulfilled = results.filter((result) => result.status === "fulfilled")
    assert.equal(fulfilled.length, 1)
    const rows = await db.select().from(schema.payouts).where(eq(schema.payouts.bookingId, bookingId))
    const outstanding = rows
      .filter((row) => row.status === "READY_FOR_PAYOUT" || row.status === "PROCESSING")
      .reduce((sum, row) => sum + row.amount, 0)
    assert.equal(outstanding, 10000)
    const processing = rows.filter((row) => row.status === "PROCESSING").reduce((sum, row) => sum + row.amount, 0)
    assert.equal(processing, 7000)
  })
})
