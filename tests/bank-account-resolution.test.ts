import "dotenv/config";
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq, desc } from "drizzle-orm";
import {
  BankResolutionService,
  maskAccountNumber,
  FALLBACK_NIGERIAN_BANKS,
} from "../backend/src/modules/payments/bank-resolution.service";
import { FinanceService } from "../backend/src/modules/finance/finance.service";
import crypto from "crypto";

describe("Paystack Real Bank Account Resolution Integration Tests", () => {
  const db = getDb();
  let testHostId: string;
  let testPayoutId: string;
  let testBookingId: string;
  let testPropertyId: string;

  // Preserve global fetch for mocking
  const originalFetch = global.fetch;

  before(async () => {
    // Setup test host and profile
    testHostId = `usr_test_host_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(schema.users).values({
      id: testHostId,
      email: `${testHostId}@example.ng`,
      passwordHash: "dummy_hash",
      firstName: "Chukwuma",
      lastName: "Adeleke",
      role: "host",
    });

    await db.insert(schema.profiles).values({
      id: `prof_${crypto.randomUUID().slice(0, 8)}`,
      userId: testHostId,
      bio: "Test Host",
    });

    // Create test property
    testPropertyId = `prop_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(schema.properties).values({
      id: testPropertyId,
      hostId: testHostId,
      title: "Test Luxury Suite",
      description: "Test luxury suite for bank resolution integration tests",
      slug: `test-luxury-${crypto.randomUUID().slice(0, 6)}`,
      propertyType: "Apartment",
      pricePerNight: 50000,
      currency: "NGN",
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar + Inverter",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    });

    // Create test booking
    testBookingId = `book_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(schema.bookings).values({
      id: testBookingId,
      propertyId: testPropertyId,
      referenceCode: `ILE-TEST-${Date.now().toString(36).toUpperCase()}`,
      guestFirstName: "Amina",
      guestLastName: "Bello",
      guestEmail: "amina@example.ng",
      guestPhone: "+2348012345678",
      checkInDate: "2026-11-01",
      checkOutDate: "2026-11-03",
      numberOfNights: 2,
      nightlyPrice: 50000,
      totalAmount: 102500,
      currency: "NGN",
      status: "CONFIRMED",
      accessToken: crypto.randomUUID(),
    });

    // Create test payout
    testPayoutId = `pout_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(schema.payouts).values({
      id: testPayoutId,
      bookingId: testBookingId,
      hostId: testHostId,
      amount: 90000,
      currency: "NGN",
      bankName: "Guaranty Trust Bank (GTBank)",
      bankCode: "058",
      accountNumber: "0123456789",
      accountName: "CHUKWUMA ADELEKE",
      status: "HELD",
    });
  });

  after(async () => {
    // Restore global fetch
    global.fetch = originalFetch;

    // Cleanup DB fixtures
    try {
      await db.delete(schema.payouts).where(eq(schema.payouts.id, testPayoutId));
      await db.delete(schema.bookings).where(eq(schema.bookings.id, testBookingId));
      await db.delete(schema.properties).where(eq(schema.properties.id, testPropertyId));
      await db.delete(schema.profiles).where(eq(schema.profiles.userId, testHostId));
      await db.delete(schema.users).where(eq(schema.users.id, testHostId));
    } catch {}
  });

  it("1. Bank Listing: Serves Nigerian bank list with names, official codes, and caching", async () => {
    const banks = await BankResolutionService.getNigerianBanks();
    assert.ok(Array.isArray(banks), "Banks must be an array");
    assert.ok(banks.length >= 25, "Must contain at least 25 supported Nigerian banks");

    // Check specific essential Nigerian banks
    const gtbank = banks.find((b) => b.code === "058");
    assert.ok(gtbank, "Guaranty Trust Bank (058) must be present");
    assert.match(gtbank.name, /Guaranty Trust|GTBank/i);

    const access = banks.find((b) => b.code === "044");
    assert.ok(access, "Access Bank (044) must be present");

    const zenith = banks.find((b) => b.code === "057");
    assert.ok(zenith, "Zenith Bank (057) must be present");
  });

  it("2. Input Validation: Rejects invalid NUBAN lengths and missing bank codes", async () => {
    // Non-10-digit account numbers
    const resShort = await BankResolutionService.resolveBankAccount("12345", "058");
    assert.equal(resShort.resolved, false);
    assert.match(resShort.error || "", /10 digits/i);

    const resLong = await BankResolutionService.resolveBankAccount("123456789012", "058");
    assert.equal(resLong.resolved, false);
    assert.match(resLong.error || "", /10 digits/i);

    // Missing bank code
    const resNoBank = await BankResolutionService.resolveBankAccount("0123456789", "");
    assert.equal(resNoBank.resolved, false);
    assert.match(resNoBank.error || "", /Bank code is required/i);
  });

  it("3. Account Resolution: Successfully resolves NUBAN account name via Paystack (Mocked Provider)", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: true,
            message: "Account number resolved",
            data: {
              account_number: "0123456789",
              account_name: "CHUKWUMA CHIDIEBERE ADELEKE",
              bank_id: 9,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const result = await BankResolutionService.resolveBankAccount("0123456789", "058");
    assert.equal(result.resolved, true);
    assert.equal(result.accountName, "CHUKWUMA CHIDIEBERE ADELEKE");
    assert.equal(result.accountNumber, "0123456789");
    assert.equal(result.bankCode, "058");
    assert.ok(result.bankName, "Must populate bank display name");
  });

  it("4. Error Handling: Handles Paystack 422 account not found", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: false,
            message: "Could not resolve account name. Check parameter or try again.",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const result = await BankResolutionService.resolveBankAccount("9999999999", "058");
    assert.equal(result.resolved, false);
    assert.match(result.error || "", /Could not resolve account name/i);
  });

  it("5. Resilience: Handles provider network timeout gracefully", async () => {
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        throw new Error("ETIMEDOUT");
      }
      return originalFetch(url);
    };

    const result = await BankResolutionService.resolveBankAccount("0123456789", "058");
    assert.equal(result.resolved, false);
    assert.match(result.error || "", /Network timeout/i);
  });

  it("6. Account Masking: Correctly masks NUBAN account numbers to protect credentials", () => {
    assert.equal(maskAccountNumber("0123456789"), "•••• •••• 6789");
    assert.equal(maskAccountNumber("2081234567"), "•••• •••• 4567");
    assert.equal(maskAccountNumber(""), "—");
    assert.equal(maskAccountNumber(null), "—");
  });

  it("7. Security & Host Ownership: Saves verified account with audit log and verified timestamp", async () => {
    // Mock successful Paystack resolve
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: true,
            message: "Account number resolved",
            data: {
              account_number: "0223344556",
              account_name: "CHUKWUMA ADELEKE",
              bank_id: 12,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const updateRes = await BankResolutionService.updateHostPayoutAccount(testHostId, {
      bankCode: "058",
      accountNumber: "0223344556",
    });

    assert.equal(updateRes.success, true);
    assert.equal(updateRes.account.accountNumberMasked, "•••• •••• 4556");
    assert.equal(updateRes.account.accountName, "CHUKWUMA ADELEKE");
    assert.ok(updateRes.account.verifiedAt instanceof Date);

    // Verify DB state
    const [profileInDb] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, testHostId))
      .limit(1);

    assert.equal(profileInDb.bankAccountNumber, "0223344556");
    assert.equal(profileInDb.bankAccountName, "CHUKWUMA ADELEKE");
    assert.ok(profileInDb.bankAccountVerifiedAt, "bankAccountVerifiedAt must be populated in DB");

    // Verify audit log entry
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, testHostId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(1);

    assert.ok(audit, "Audit log must be recorded");
    assert.equal(audit.action, "UPDATE_PAYOUT_ACCOUNT");
    const auditDetails = JSON.parse(audit.details || "{}");
    assert.equal(auditDetails.newAccountMasked, "•••• •••• 4556");
    // Verify full account is NOT logged in audit details
    assert.equal(audit.details?.includes("0223344556"), false, "Full account number must not be logged");
  });

  it("8. Anti-Spoofing: Backend rejects fake or unverified account names without Paystack confirmation", async () => {
    // Mock failing resolution
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: false,
            message: "Account number not found",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    await assert.rejects(
      async () => {
        await BankResolutionService.updateHostPayoutAccount(testHostId, {
          bankCode: "058",
          accountNumber: "0000000000",
        });
      },
      /could not be verified by Paystack|Account number not found|Could not resolve account name/i,
      "Must throw error and reject unverified account"
    );
  });

  it("9. Admin Payout Snapshot: Admin updating a payout destination must use Paystack resolution", async () => {
    // Mock successful Paystack resolve
    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: true,
            message: "Account number resolved",
            data: {
              account_number: "1122334455",
              account_name: "ADELEKE PROPERTIES LTD",
              bank_id: 15,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const updatedPayout = await FinanceService.updatePayoutBankAccount("usr_admin_tester", {
      payoutId: testPayoutId,
      bankCode: "058",
      accountNumber: "1122334455",
      updateHostDefaultProfile: false,
    });

    assert.equal(updatedPayout.accountNumber, "1122334455");
    assert.equal(updatedPayout.accountName, "ADELEKE PROPERTIES LTD");

    // Verify payout row in DB was updated with the snapshot
    const [payoutInDb] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, testPayoutId))
      .limit(1);

    assert.equal(payoutInDb.accountNumber, "1122334455");
    assert.equal(payoutInDb.accountName, "ADELEKE PROPERTIES LTD");

    // Verify admin audit log
    const [adminAudit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, testPayoutId))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(1);

    assert.ok(adminAudit, "Admin audit log must be recorded");
    assert.equal(adminAudit.action, "ADMIN_UPDATE_PAYOUT_BANK");
  });

  it("10. Transfer Safety: Verifies that account resolution NEVER triggers a financial transfer", async () => {
    let transferApiCalled = false;

    global.fetch = async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("paystack.co/transfer")) {
        transferApiCalled = true;
      }
      if (urlStr.includes("paystack.co/bank/resolve")) {
        return new Response(
          JSON.stringify({
            status: true,
            message: "Account number resolved",
            data: {
              account_number: "0123456789",
              account_name: "CHUKWUMA ADELEKE",
              bank_id: 9,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    await BankResolutionService.resolveBankAccount("0123456789", "058");
    assert.equal(transferApiCalled, false, "Paystack Transfer API must never be called during resolution");
  });
});
