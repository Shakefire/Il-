import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq, and, sql } from "drizzle-orm";
import { LedgerService, ACCOUNT_CODES, ensurePhase2Accounts } from "../backend/src/modules/finance/ledger.service";
import { FinanceService } from "../backend/src/modules/finance/finance.service";
import crypto from "crypto";

describe("Phase 2: Double-Entry Ledger Core & Financial Lifecycle", async () => {
  if ((process.env.DATABASE_URL || "").startsWith("postgres")) {
    throw new Error("Refusing the ledger suite against a configured Postgres URL.");
  }
  const db = getDb();
  const testRunId = Date.now();

  test("0. Local schema is ready and the default admin exists", async () => {
    const { initAndSeedDb } = await import("../backend/src/db/seed");
    await initAndSeedDb();
    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, "usr_admin_default"))
      .limit(1);
    if (!admin) {
      await db.insert(schema.users).values({
        id: "usr_admin_default",
        email: `admin_default_${testRunId}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Ile",
        lastName: "Admin",
        role: "admin",
        emailVerified: true,
        status: "ACTIVE",
      });
    }
  });

  test("1. Chart of Accounts: All 8 core accounts exist and match expected types", async () => {
    const accounts = await db.select().from(schema.ledgerAccounts);
    const codeMap = new Map(accounts.map((a) => [a.code, a]));

    assert(codeMap.has("1010"), "1010 Paystack Clearing exists");
    assert.equal(codeMap.get("1010")?.type, "ASSET");

    assert(codeMap.has("1020"), "1020 Operating Bank Account exists");
    assert.equal(codeMap.get("1020")?.type, "ASSET");

    assert(codeMap.has("2010"), "2010 Advance Guest Deposits exists");
    assert.equal(codeMap.get("2010")?.type, "LIABILITY");

    assert(codeMap.has("2020"), "2020 Host Settlement Payable exists");
    assert.equal(codeMap.get("2020")?.type, "LIABILITY");

    assert(codeMap.has("2030"), "2030 Paystack Processing Fee Escrow exists");
    assert.equal(codeMap.get("2030")?.type, "LIABILITY");

    assert(codeMap.has("4010"), "4010 Platform Commission Revenue exists");
    assert.equal(codeMap.get("4010")?.type, "REVENUE");

    assert(codeMap.has("5010"), "5010 Payment Processing Expense exists");
    assert.equal(codeMap.get("5010")?.type, "EXPENSE");

    assert(codeMap.has("5020"), "5020 Payout Transfer Fee exists");
    assert.equal(codeMap.get("5020")?.type, "EXPENSE");
  });

  test("2. Strict Zero-Sum Balancing Constraint: Rejects unbalanced journal entry", async () => {
    await assert.rejects(
      async () => {
        await db.transaction(async (tx) => {
          await LedgerService.postJournalEntry(tx, {
            reference: `test_imbalance_${testRunId}`,
            eventType: "TEST_UNBALANCED",
            narration: "Attempting an intentional double-entry imbalance",
            entries: [
              { accountCode: "1010", entryType: "DEBIT", amount: 50000 },
              { accountCode: "2010", entryType: "CREDIT", amount: 45000 }, // ₦5,000 imbalance!
            ],
          });
        });
      },
      /Double-entry imbalance detected/,
      "Must throw on unbalanced journal"
    );
  });

  test("3. Booking Payment Received: Inflow posted to Paystack Clearing & Guest Deposits Escrow", async () => {
    // Create test host and guest
    const hostId = `usr_test_host_${testRunId}`;
    const guestId = `usr_test_guest_${testRunId}`;
    const propId = `prop_test_p2_${testRunId}`;
    const bookingId = `book_test_p2_${testRunId}`;
    const paymentRef = `T_P2_${testRunId}`;

    await db.insert(schema.users).values([
      {
        id: hostId,
        email: `host_${testRunId}@test.ile.ng`,
        passwordHash: "hash123",
        firstName: "Ledger",
        lastName: "Host",
        role: "host",
      },
      {
        id: guestId,
        email: `guest_${testRunId}@test.ile.ng`,
        passwordHash: "hash123",
        firstName: "Ledger",
        lastName: "Guest",
        role: "guest",
      },
    ]);

    await db.insert(schema.properties).values({
      id: propId,
      hostId,
      title: "Ledger Test Residence",
      slug: `ledger-test-${testRunId}`,
      description: "Ledger test residence for financial lifecycle.",
      propertyType: "Apartment",
      city: "Lagos",
      neighborhood: "Ikoyi",
      state: "Lagos State",
      latitude: 6.45,
      longitude: 3.42,
      powerType: "24/7 Grid + Generator",
      coverImage: "/images/test.jpg",
      pricePerNight: 100000,
      cleaningFee: 0,
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
    });

    const nights = 2;
    const accommodationSubtotal = 200000; // 2 nights * 100k
    // Paystack fee for 200,000 NGN: capped at 2,000 NGN
    const paystackFee = 2000;
    const totalAmount = accommodationSubtotal + paystackFee; // 202,000 NGN
    const commissionPct = 10;
    const commissionAmount = 20000; // 10% of 200k
    const hostNetAmount = 180000; // 200k - 20k

    await db.insert(schema.bookings).values({
      id: bookingId,
      referenceCode: `ILE-P2-${testRunId.toString().slice(-6)}`,
      propertyId: propId,
      guestId,
      guestFirstName: "Ledger",
      guestLastName: "Guest",
      guestEmail: `guest_${testRunId}@test.ile.ng`,
      guestPhone: "+2348001112233",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-03",
      numberOfNights: nights,
      nightlyPrice: 100000,
      accommodationSubtotal,
      hostCommissionPct: commissionPct,
      hostCommissionAmount: commissionAmount,
      paystackFeeAmount: paystackFee,
      hostNetAmount,
      totalAmount,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    });

    // Record booking payment into ledger
    const pmtResult = await db.transaction(async (tx) => {
      return await LedgerService.recordBookingPayment(tx, {
        bookingId,
        paymentRef,
        totalAmount,
        accommodationSubtotal,
        paystackFeeAmount: paystackFee,
        hostNetAmount,
        hostId,
        checkInDate: "2026-11-01",
        payoutHoldHours: 24,
      });
    });

    if (pmtResult.alreadyRecorded) {
      assert.fail("Expected new journal to be created, but was already recorded");
    }
    assert(pmtResult.journal, "Journal created");
    assert.equal(pmtResult.balancedAmount, 202000, "Balanced at ₦202,000");

    // Verify Payout Queue Entry in HELD status
    const [payoutRow] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId));

    assert(payoutRow, "Payout row generated in queue");
    assert.equal(payoutRow.status, "HELD", "Status is HELD");
    assert.equal(payoutRow.amount, 180000, "Net payout amount is ₦180,000");
  });

  test("4. Check-In Recognition: Releases escrow to Host Settlement Payable & Platform Commission", async () => {
    const bookingId = `book_test_p2_${testRunId}`;
    const accommodationSubtotal = 200000;
    const commissionAmount = 20000;
    const hostNetAmount = 180000;

    const settleResult = await db.transaction(async (tx) => {
      return await LedgerService.recognizeCheckInSettlement(tx, {
        bookingId,
        accommodationSubtotal,
        hostNetAmount,
        hostCommissionAmount: commissionAmount,
      });
    });

    if (settleResult.alreadyRecorded) {
      assert.fail("Expected new check-in settlement journal, but was already recorded");
    }
    assert(settleResult.journal, "Check-in recognition journal posted");
    assert.equal(settleResult.balancedAmount, 200000, "Balanced at ₦200,000");

    // Verify Payout Queue updated to READY_FOR_PAYOUT
    const [payoutRow] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId));

    assert.equal(payoutRow.status, "READY_FOR_PAYOUT", "Payout is now READY_FOR_PAYOUT");
  });

  test("5. Admin Disburses Host Payout: Debits Host Payable and credits Operating Bank", async () => {
    const bookingId = `book_test_p2_${testRunId}`;
    const hostId = `usr_test_host_${testRunId}`;

    const [payoutRow] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId));

    assert(payoutRow, "Payout row found");

    await db
      .update(schema.payouts)
      .set({
        bankCode: "058",
        bankName: "GTBank",
        accountNumber: "0123456789",
        accountName: "Ledger Host",
        paystackRecipientCode: "RCP_ledgertestrecipient",
      })
      .where(eq(schema.payouts.id, payoutRow.id));

    const disburseResult = await FinanceService.disbursePayout("usr_admin_default", {
      payoutId: payoutRow.id,
      transferRef: `NIP_TRF_${testRunId}`,
      notes: "Direct NIP Bank Transfer executed by admin",
    });

    assert.equal(disburseResult.success, true, "Disbursement succeeded");

    // Verify payout status is PAID
    const [updatedPayout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutRow.id));

    assert.equal(updatedPayout.status, "PAID", "Payout status updated to PAID");
    assert(updatedPayout.disbursedAt, "Disbursed timestamp recorded");
    assert.equal(updatedPayout.paystackTransferRef, `NIP_TRF_${testRunId}`);
  });

  test("6. Admin Refund Flow: Funds the verified payment from commission account 1040", async () => {
    // Create a new booking to test refund
    const refundBookingId = `book_ref_test_${testRunId}`;
    const refundPaymentRef = `T_REF_${testRunId}`;
    const hostId = `usr_test_host_${testRunId}`;
    const propId = `prop_test_p2_${testRunId}`;

    const accommodationSubtotal = 100000;
    const paystackFee = 1625; // 1.5% + 100 for 100,000
    const totalAmount = accommodationSubtotal + paystackFee; // 101,625
    const hostNetAmount = 90000;

    await db.insert(schema.bookings).values({
      id: refundBookingId,
      referenceCode: `ILE-REF-${testRunId.toString().slice(-6)}`,
      propertyId: propId,
      guestFirstName: "Refund",
      guestLastName: "Tester",
      guestEmail: `refund_${testRunId}@test.ile.ng`,
      guestPhone: "+2348002223344",
      checkInDate: "2026-11-10",
      checkOutDate: "2026-11-11",
      numberOfNights: 1,
      nightlyPrice: 100000,
      accommodationSubtotal,
      hostCommissionPct: 10,
      hostCommissionAmount: 10000,
      paystackFeeAmount: paystackFee,
      hostNetAmount,
      totalAmount,
      status: "CONFIRMED",
      accessToken: crypto.randomBytes(16).toString("hex"),
    });

    // Inflow payment
    await db.transaction(async (tx) => {
      await LedgerService.recordBookingPayment(tx, {
        bookingId: refundBookingId,
        paymentRef: refundPaymentRef,
        totalAmount,
        accommodationSubtotal,
        paystackFeeAmount: paystackFee,
        hostNetAmount,
        hostId,
        checkInDate: "2026-11-10",
      });
    });

    await db.insert(schema.payments).values({
      id: `pay_ref_${testRunId}`,
      bookingId: refundBookingId,
      reference: refundPaymentRef,
      amount: totalAmount,
      currency: "NGN",
      method: "card",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
      gatewayReference: `psk_${testRunId}`,
      paidAt: new Date(),
    });

    await db.transaction(async (tx) => {
      await ensurePhase2Accounts(tx);
      await LedgerService.postJournalEntry(tx, {
        reference: `commission-fund-${refundBookingId}`,
        eventType: "COMMISSION_ALLOCATION",
        narration: "Test allocation of commission cash for a guest refund",
        entries: [
          { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "DEBIT", amount: totalAmount },
          { accountCode: ACCOUNT_CODES.PAYSTACK_CLEARING, entryType: "CREDIT", amount: totalAmount },
        ],
      });
    });

    const hostPayableBefore = await db.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: schema.ledgerAccounts.id })
        .from(schema.ledgerAccounts)
        .where(eq(schema.ledgerAccounts.code, ACCOUNT_CODES.HOST_PAYABLE))
        .limit(1);
      if (!account) return 0;
      const [sums] = await tx
        .select({
          credit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'CREDIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
          debit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'DEBIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.accountId, account.id));
      return (sums?.credit || 0) - (sums?.debit || 0);
    });

    const refundResult = await FinanceService.processRefund("usr_admin_default", {
      bookingId: refundBookingId,
      reason: "Guest cancelled reservation ahead of time",
      adminNotes: "Funded from commission account 1040",
    });

    assert.equal(refundResult.success, true);
    assert.equal(refundResult.refundedAmount, totalAmount, "Refund uses the verified payment amount");
    assert.equal(refundResult.processingFeeRetained, 0, "Processing fee is not retained as a second charge");
    assert.equal(refundResult.fundingAccount, "1040");

    assert.equal(typeof refundResult.refundId, "string");
    const [refundRecord] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, refundResult.refundId as string));

    assert.equal(refundRecord.status, "SUCCESSFUL");
    assert.equal(refundRecord.refundableAmount, totalAmount);

    const [payoutRec] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, refundBookingId));

    assert.notEqual(payoutRec.status, "CANCELLED", "Host payout is not cancelled to fund the refund");

    const hostPayableAfter = await db.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: schema.ledgerAccounts.id })
        .from(schema.ledgerAccounts)
        .where(eq(schema.ledgerAccounts.code, ACCOUNT_CODES.HOST_PAYABLE))
        .limit(1);
      if (!account) return 0;
      const [sums] = await tx
        .select({
          credit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'CREDIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
          debit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'DEBIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
        })
        .from(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.accountId, account.id));
      return (sums?.credit || 0) - (sums?.debit || 0);
    });
    assert.equal(hostPayableAfter, hostPayableBefore, "Host payable is not debited for the refund");
  });

  test("7. Trial Balance Integrity: Entire platform ledger balances with 0 imbalance", async () => {
    const tb = await LedgerService.getTrialBalance();

    console.log(`\n📊 Post-Test Trial Balance: Debits=₦${tb.totals.debits.toLocaleString()}, Credits=₦${tb.totals.credits.toLocaleString()}`);

    assert.equal(tb.totals.isBalanced, true, "Trial balance MUST be balanced");
    assert.equal(tb.totals.imbalance, 0, "Trial balance imbalance MUST be exactly 0");
    assert(tb.totals.debits > 0, "Debits are non-zero");
    assert(tb.totals.credits > 0, "Credits are non-zero");
  });

  test("8. Financial Executive Summary: Returns consistent balances and queue counts", async () => {
    const summary = await FinanceService.getFinancialSummary();

    assert(summary.trialBalance.totals.isBalanced, "Summary trial balance is balanced");
    assert(summary.metrics.totalDisbursed >= 180000, "Includes disbursed test payout");
    assert(summary.metrics.totalRefunded >= 100000, "Includes refunded accommodation");

    // Clean exit
    setTimeout(() => process.exit(0), 100);
  });
});
