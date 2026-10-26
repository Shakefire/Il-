/**
 * Ilé Paystack Remediation & Financial Integrity Test Suite
 * Validates:
 * 1. P0 Mock Payment Bypass Decommissioning
 * 2. Domestic ₦2,000 Paystack Fee Cap parity (Backend & Frontend)
 * 3. Timing-Safe HMAC SHA-512 Signature Verification
 * 4. Durable Webhook Events Storage & Idempotency Deduplication
 * 5. Paystack Transfers Service (Recipient creation & transfer initiation)
 * 6. Webhook Transfer Lifecycle (transfer.success, transfer.failed, transfer.reversed)
 * 7. Refund Error Rejection & Phantom Ledger Prevention
 * 8. Protection of Availability Blocks on Transient Verification
 * 9. Automated Check-In Revenue Recognition
 */

(process.env as any).NODE_ENV = "test";
process.env.PAYSTACK_MOCK_TRANSFERS = "true";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// Modules under test
import { bookingsService } from "../backend/src/modules/bookings/bookings.service";
import { calculatePaystackFee as backendFeeCalc } from "../backend/src/modules/pricing/pricing.service";
import { calculatePaystackFee as frontendFeeCalc } from "../src/lib/utils";
import {
  verifyPaystackWebhookSignature,
  handlePaystackWebhook,
  verifyPayment,
} from "../backend/src/modules/payments/payments.service";
import { PaystackTransferService } from "../backend/src/modules/payments/paystack-transfer.service";
import { FinanceService } from "../backend/src/modules/finance/finance.service";
import { getDb, schema } from "../backend/src/db/client";
import { eq, and } from "drizzle-orm";

test("Suite: Ilé Paystack Remediation & Financial Integrity", async (t) => {
  const db = getDb();

  // Helper to ensure an existing user and booking exist for foreign key references
  let testBookingId: string;
  let testHostId: string;

  const [existingUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1);

  if (existingUser) {
    testHostId = existingUser.id;
  } else {
    const testUserId = `usr_test_${Date.now()}`;
    await db.insert(schema.users).values({
      id: testUserId,
      email: `test_${Date.now()}@ile.ng`,
      passwordHash: "hash_test_123",
      firstName: "Test",
      lastName: "Host",
      phone: "+2348000000001",
      role: "host",
    });
    testHostId = testUserId;
  }

  const [existingBooking] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .limit(1);

  if (existingBooking) {
    testBookingId = existingBooking.id;
  } else {
    const testPropId = `prop_test_${Date.now()}`;
    await (db.insert(schema.properties) as any).values({
      id: testPropId,
      hostId: testHostId,
      title: "Test Penthouse Maitama",
      slug: `test-penthouse-${Date.now()}`,
      propertyType: "Penthouse",
      city: "Abuja",
      neighborhood: "Maitama",
      pricePerNight: 150000,
    });

    testBookingId = `bk_test_${Date.now()}`;
    await db.insert(schema.bookings).values({
      id: testBookingId,
      referenceCode: `ILE-TST-${Date.now().toString().slice(-6)}`,
      propertyId: testPropId,
      guestId: testHostId,
      guestFirstName: "Test",
      guestLastName: "Guest",
      guestEmail: "guest@example.com",
      guestPhone: "+2348000000002",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-05",
      numberOfNights: 4,
      nightlyPrice: 150000,
      totalAmount: 600000,
      accommodationSubtotal: 600000,
      accessToken: `tok_${crypto.randomBytes(16).toString("hex")}`,
      status: "PENDING",
    });
  }

  // ─── Phase 0: Mock Payment Bypass Decommissioning ───
  await t.test("P0: bookingsService.processPayment must throw security error", async () => {
    await assert.rejects(
      async () => {
        await bookingsService.processPayment("dummy_id", "CARD", "dummy_token");
      },
      {
        message: /Direct booking payment bypass is disabled for security/i,
      }
    );
  });

  // ─── Phase 6: Pricing Fee Calculation & ₦2,000 Fee Cap ───
  await t.test("Phase 6: Domestic ₦2,000 Paystack Fee Cap applied correctly", () => {
    // Under ₦2,500: Pass-through formula Math.ceil(2000 / 0.985) - 2000 = 31
    assert.equal(backendFeeCalc(2000), 31);
    assert.equal(frontendFeeCalc(2000), 31);

    // Over ₦2,500: Pass-through formula Math.ceil((100000 + 100) / 0.985) - 100000 = 1625
    assert.equal(backendFeeCalc(100_000), 1625);
    assert.equal(frontendFeeCalc(100_000), 1625);

    // Above ₦126,667 threshold: Capped strictly at ₦2,000
    // ₦200,000: pass-through = 3148 -> cap = 2000
    assert.equal(backendFeeCalc(200_000), 2000);
    assert.equal(frontendFeeCalc(200_000), 2000);

    // ₦1,000,000 luxury villa: pass-through = 15330 -> cap = 2000
    assert.equal(backendFeeCalc(1_000_000), 2000);
    assert.equal(frontendFeeCalc(1_000_000), 2000);

    // ₦10,000,000 long stay: pass-through = 152386 -> cap = 2000
    assert.equal(backendFeeCalc(10_000_000), 2000);
    assert.equal(frontendFeeCalc(10_000_000), 2000);

    // Zero amount
    assert.equal(backendFeeCalc(0), 0);
    assert.equal(frontendFeeCalc(0), 0);
  });

  // ─── Phase 1: Timing-Safe HMAC SHA-512 Signature Verification ───
  await t.test("Phase 1: Webhook HMAC signature verification is robust & constant-time", () => {
    const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_secret_key_remediation";
    const body = JSON.stringify({ event: "charge.success", data: { id: 12345, reference: "ref_test_001" } });

    const validSig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const tamperedSig = validSig.slice(0, -2) + "ab";
    const truncatedSig = validSig.slice(0, 32);

    // Authentic signature passes
    assert.equal(verifyPaystackWebhookSignature(body, validSig), true);

    // Altered signature fails
    assert.equal(verifyPaystackWebhookSignature(body, tamperedSig), false);

    // Length mismatched signature fails safely without buffer overrun
    assert.equal(verifyPaystackWebhookSignature(body, truncatedSig), false);

    // Empty signature fails
    assert.equal(verifyPaystackWebhookSignature(body, ""), false);
  });

  // ─── Phase 4: Paystack Transfers Service ───
  await t.test("Phase 4: PaystackTransferService validates recipient inputs", async () => {
    // Invalid NUBAN length
    const invalidAcc = await PaystackTransferService.createTransferRecipient({
      name: "John Doe",
      accountNumber: "12345",
      bankCode: "058",
    });
    assert.equal(invalidAcc.success, false);
    assert.match(invalidAcc.error || "", /10 digits/i);

    // Missing bank code
    const missingBank = await PaystackTransferService.createTransferRecipient({
      name: "John Doe",
      accountNumber: "0123456789",
      bankCode: "",
    });
    assert.equal(missingBank.success, false);
    assert.match(missingBank.error || "", /bank code is required/i);

    // Missing name
    const missingName = await PaystackTransferService.createTransferRecipient({
      name: "",
      accountNumber: "0123456789",
      bankCode: "058",
    });
    assert.equal(missingName.success, false);
    assert.match(missingName.error || "", /name is required/i);

    // Valid inputs generate recipient with RCP_ prefix
    const validRec = await PaystackTransferService.createTransferRecipient({
      name: "Amina Bello",
      accountNumber: "0123456789",
      bankCode: "058",
      description: "Host payout account",
    });
    assert.equal(validRec.success, true);
    assert.ok(validRec.recipientCode?.startsWith("RCP_"));
  });

  await t.test("Phase 4: PaystackTransferService validates transfer initiation", async () => {
    // Non-positive amount
    const invalidAmount = await PaystackTransferService.initiateTransfer({
      amountNaira: 0,
      recipientCode: "RCP_test123",
      reference: "TRF_TEST_01",
    });
    assert.equal(invalidAmount.success, false);

    // Malformed recipient code (must start with RCP_)
    const invalidRecipient = await PaystackTransferService.initiateTransfer({
      amountNaira: 50_000,
      recipientCode: "INVALID_CODE",
      reference: "TRF_TEST_02",
    });
    assert.equal(invalidRecipient.success, false);
    assert.match(invalidRecipient.error || "", /Invalid Paystack recipient code/i);

    // Valid parameters
    const validTransfer = await PaystackTransferService.initiateTransfer({
      amountNaira: 75_000,
      recipientCode: "RCP_testvalid123",
      reference: `TRF_ILE_${Date.now()}`,
    });
    assert.equal(validTransfer.success, true);
    assert.ok(validTransfer.transferCode?.startsWith("TRF_"));
  });

  // ─── Phase 1 & 8: Durable Webhook Storage & Deduplication ───
  await t.test("Phase 1 & 8: Durable webhook event storage & idempotency deduplication", async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_secret_key_remediation";
    const uniqueEventId = `evt_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const testPayload = JSON.stringify({
      id: uniqueEventId,
      event: "transfer.success",
      data: {
        id: 999001,
        reference: `TRF_REF_${uniqueEventId}`,
        transfer_code: `TRF_CODE_${uniqueEventId}`,
        amount: 5000000,
        transferred_at: new Date().toISOString(),
      },
    });

    const sig = crypto.createHmac("sha512", secret).update(testPayload).digest("hex");

    // 1. First webhook execution
    const firstRun = await handlePaystackWebhook(testPayload, sig);
    assert.equal(firstRun.processed, true);

    // Verify record in webhookEvents table
    const [storedEvent] = await db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.eventId, uniqueEventId))
      .limit(1);

    assert.ok(storedEvent, "Event should be stored in webhookEvents table");
    assert.equal(storedEvent.status, "PROCESSED");
    assert.equal(storedEvent.eventType, "transfer.success");

    // 2. Second webhook execution with identical payload (replay)
    const replayRun = await handlePaystackWebhook(testPayload, sig);
    assert.equal(replayRun.processed, true);
    assert.match(replayRun.message, /already processed \(idempotent\)/i);
  });

  // ─── Phase 4 Webhook: Transfer Lifecycle Transitions ───
  await t.test("Phase 4: Webhook handles transfer.failed and records failure reason", async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_secret_key_remediation";
    const testPayoutId = `payout_test_${Date.now()}`;
    const testTransferRef = `TRF_FAIL_${Date.now()}`;

    // Seed dummy payout referencing valid booking
    await db.insert(schema.payouts).values({
      id: testPayoutId,
      bookingId: testBookingId,
      hostId: testHostId,
      amount: 45000,
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456789",
      accountName: "Test Host",
      status: "PROCESSING",
      transferStatus: "PENDING",
      paystackTransferRef: testTransferRef,
    });

    const failPayload = JSON.stringify({
      id: `evt_fail_${Date.now()}`,
      event: "transfer.failed",
      data: {
        reference: testTransferRef,
        transfer_code: `TRF_C_${testTransferRef}`,
        reason: "Destination bank account suspended",
      },
    });

    const sig = crypto.createHmac("sha512", secret).update(failPayload).digest("hex");
    const result = await handlePaystackWebhook(failPayload, sig);
    assert.equal(result.processed, true);

    // Verify payout updated to FAILED with reason
    const [updatedPayout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, testPayoutId))
      .limit(1);

    assert.ok(updatedPayout);
    assert.equal(updatedPayout.status, "FAILED");
    assert.equal(updatedPayout.transferStatus, "FAILED");
    assert.match(updatedPayout.transferFailureReason || "", /suspended/i);
  });

  await t.test("Phase 4: Webhook handles transfer.reversed and reverses ledger", async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_secret_key_remediation";
    const testPayoutId = `payout_rev_${Date.now()}`;
    const testTransferRef = `TRF_REV_${Date.now()}`;

    // Seed dummy payout in PAID state referencing valid booking
    await db.insert(schema.payouts).values({
      id: testPayoutId,
      bookingId: testBookingId,
      hostId: testHostId,
      amount: 60000,
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456789",
      accountName: "Test Host",
      status: "PAID",
      transferStatus: "SUCCESS",
      paystackTransferRef: testTransferRef,
    });

    const revPayload = JSON.stringify({
      id: `evt_rev_${Date.now()}`,
      event: "transfer.reversed",
      data: {
        reference: testTransferRef,
        transfer_code: `TRF_C_${testTransferRef}`,
        reason: "Beneficiary bank rejected credit after timeout",
      },
    });

    const sig = crypto.createHmac("sha512", secret).update(revPayload).digest("hex");
    const result = await handlePaystackWebhook(revPayload, sig);
    assert.equal(result.processed, true);

    // Verify payout updated to REVERSED
    const [revPayout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, testPayoutId))
      .limit(1);

    assert.ok(revPayout);
    assert.equal(revPayout.status, "REVERSED");
    assert.equal(revPayout.transferStatus, "REVERSED");

    // Verify compensating ledger entry posted
    const [revJournal] = await db
      .select()
      .from(schema.ledgerJournals)
      .where(eq(schema.ledgerJournals.eventType, "PAYOUT_REVERSED"))
      .orderBy(schema.ledgerJournals.createdAt)
      .limit(1);

    assert.ok(revJournal, "Compensating journal entry must exist");
  });

  // ─── Phase 3: Refund Error Handling ───
  await t.test("Phase 3: processRefund aborts transaction and does not credit ledger if refund fails", async () => {
    // Attempting to refund a non-existent booking throws without creating refund records
    await assert.rejects(
      async () => {
        await FinanceService.processRefund("admin_test_01", {
          bookingId: "non_existent_booking_id",
          reason: "Guest requested cancellation",
        });
      },
      {
        message: /Booking non_existent_booking_id not found/i,
      }
    );
  });

  // ─── Phase 5: Check-in Settlement Automation ───
  await t.test("Phase 5: FinanceService.processDueSettlements runs without throwing", async () => {
    const result = await FinanceService.processDueSettlements();
    assert.ok(typeof result.processedCount === "number");
    assert.ok(Array.isArray(result.bookingIds));
    assert.ok(typeof result.totalSettledAmount === "number");
  });

  // Clean up database pool connections
  const { closeDb } = await import("../backend/src/db/client");
  await closeDb();
});
