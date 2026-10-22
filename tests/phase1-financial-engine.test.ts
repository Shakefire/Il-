import "dotenv/config";
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq, desc } from "drizzle-orm";
import { bookingsService } from "../backend/src/modules/bookings/bookings.service";
import { processSuccessfulPayment } from "../backend/src/modules/payments/payments.service";
import { adminService } from "../backend/src/modules/admin/admin.service";
import crypto from "crypto";

describe("Phase 1: Financial Engine, Pricing & Admin Settings Verification", () => {
  const db = getDb();
  const timestamp = Date.now();
  let testPropertyId: string;
  let verifiedHostId: string;

  it("1. Platform Settings: Retrieves default settings row (10% commission, 24h hold)", async () => {
    const settings = await adminService.getSettings();
    assert.ok(settings, "Platform settings row must exist");
    assert.equal(settings.id, "default");
    assert.equal(settings.defaultHostCommissionPct, 10);
    assert.equal(settings.payoutHoldHours, 24);
  });

  it("2. Platform Settings: Admin updates commission rate with audit log validation", async () => {
    const adminId = "usr_admin_default";
    const updated = await adminService.updateSettings(
      { defaultHostCommissionPct: 12, payoutHoldHours: 48 },
      adminId,
      "127.0.0.1"
    );

    assert.equal(updated.defaultHostCommissionPct, 12);
    assert.equal(updated.payoutHoldHours, 48);

    // Verify persisted in DB
    const [inDb] = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);
    assert.equal(inDb.defaultHostCommissionPct, 12);

    // Verify audit log generated
    const [audit] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityType, "platform_settings"))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(1);
    assert.equal(audit.action, "SETTINGS_UPDATED");
    assert.match(audit.details || "", /commission=12%/);

    // Restore to standard 10%
    await adminService.updateSettings({ defaultHostCommissionPct: 10, payoutHoldHours: 24 }, adminId);
  });

  it("3. Pricing Engine: Verifies Paystack fee formula, 0 cleaning fee, and commission snapshots", async () => {
    verifiedHostId = `host_p1_${timestamp}`;
    testPropertyId = `prop_p1_${timestamp}`;

    // Setup host and property
    await db.insert(schema.users).values({
      id: verifiedHostId,
      email: `host_p1_${timestamp}@test.ile.ng`,
      passwordHash: "hash123",
      firstName: "Amina",
      lastName: "Kano",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    });

    await db.insert(schema.profiles).values({
      id: `prof_p1_${timestamp}`,
      userId: verifiedHostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
      bankName: "Guaranty Trust Bank",
      bankCode: "058",
      bankAccountNumber: "0123456789",
      bankAccountName: "AMINA KANO",
    });

    const nightlyPrice = 100000;
    await db.insert(schema.properties).values({
      id: testPropertyId,
      hostId: verifiedHostId,
      slug: `p1-property-${timestamp}`,
      title: "Phase 1 Luxury Residence",
      description: "Accommodation test residence.",
      propertyType: "Apartment",
      pricePerNight: nightlyPrice,
      cleaningFee: 5000, // Legacy cleaning fee in table — should be ignored!
      serviceFeePct: 8,  // Legacy fee pct — should be replaced by Paystack fee!
      city: "Abuja",
      neighborhood: "Maitama",
      state: "FCT",
      latitude: 9.08,
      longitude: 7.49,
      powerType: "Solar + Inverter",
      coverImage: "/images/prop.jpg",
      status: "PUBLISHED",
    });

    await db.insert(schema.propertyPrivateDetails).values({
      id: `pvd_p1_${timestamp}`,
      propertyId: testPropertyId,
      exactAddress: "14 Gana Street, Maitama",
      contactName: "Amina Kano",
      contactPhone: "+2348039990000",
      contactEmail: "amina@test.ile.ng",
    });

    // Book 2 nights (Accommodation: 2 × ₦100,000 = ₦200,000)
    const d1 = new Date(Date.now() + 100 * 86400000);
    const d2 = new Date(Date.now() + 102 * 86400000);
    const result = await bookingsService.createBooking({
      propertyId: testPropertyId,
      guestFirstName: "Chinedu",
      guestLastName: "Eze",
      guestEmail: `chinedu_${timestamp}@test.ile.ng`,
      guestPhone: "+2348099887766",
      guestCount: 2,
      checkInDate: d1.toISOString().split("T")[0],
      checkOutDate: d2.toISOString().split("T")[0],
    });

    assert.equal(result.pricing.nights, 2);
    assert.equal(result.pricing.pricePerNight, 100000);
    assert.equal(result.pricing.accommodationSubtotal, 200000);
    assert.equal(result.pricing.cleaningFee, 0, "Cleaning fee must be strictly 0");

    // Paystack fee for ₦200,000 hits the ₦2,000 cap:
    assert.equal(result.pricing.paystackFee, 2000, "Paystack fee capped at ₦2,000");
    assert.equal(result.pricing.totalAmount, 202000, "Total amount charged to guest = ₦200,000 + ₦2,000");

    // Host commission & net entitlement:
    assert.equal(result.pricing.hostCommissionPct, 10);
    assert.equal(result.pricing.hostCommissionAmount, 20000, "10% commission on ₦200,000 = ₦20,000");
    assert.equal(result.pricing.hostNetAmount, 180000, "Host net entitlement = ₦200,000 - ₦20,000 = ₦180,000");

    // Verify snapshot columns on booking row in database:
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, result.booking.id));
    assert.equal(booking.accommodationSubtotal, 200000);
    assert.equal(booking.hostCommissionPct, 10);
    assert.equal(booking.hostCommissionAmount, 20000);
    assert.equal(booking.paystackFeeAmount, 2000);
    assert.equal(booking.hostNetAmount, 180000);
    assert.equal(booking.cleaningFee, 0);
    assert.equal(booking.totalAmount, 202000);

    // Process payment
    const paymentResult = await processSuccessfulPayment({
      reference: result.paymentReference,
      gatewayReference: `gw_p1_${timestamp}`,
      paidAmountNaira: booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    });
    assert.equal(paymentResult.success, true);

    // Verify host earnings table matches accommodation-only math:
    const [earnings] = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, booking.id));
    assert.equal(earnings.grossAmount, 200000, "Host gross is accommodation subtotal (₦200,000)");
    assert.equal(earnings.commissionAmount, 20000, "Ilé commission is ₦20,000");
    assert.equal(earnings.netAmount, 180000, "Host net payout is ₦180,000");
    assert.equal(earnings.status, "PENDING");
  });

  it("4. Cancellation Neutralization: Cancelling booking updates host_earnings status to CANCELLED", async () => {
    // Book and pay for a stay to test cancellation
    const d1 = new Date(Date.now() + 120 * 86400000);
    const d2 = new Date(Date.now() + 122 * 86400000);
    const result = await bookingsService.createBooking({
      propertyId: testPropertyId,
      guestFirstName: "Obi",
      guestLastName: "Okafor",
      guestEmail: `obi_${timestamp}@test.ile.ng`,
      guestPhone: "+2348077665544",
      guestCount: 1,
      checkInDate: d1.toISOString().split("T")[0],
      checkOutDate: d2.toISOString().split("T")[0],
    });

    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, result.booking.id));
    await processSuccessfulPayment({
      reference: result.paymentReference,
      gatewayReference: `gw_cancel_${timestamp}`,
      paidAmountNaira: booking.totalAmount,
      currency: "NGN",
      method: "CARD",
    });

    // Check earnings was initially PENDING
    const [initialEarnings] = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, booking.id));
    assert.equal(initialEarnings.status, "PENDING");

    // Cancel booking
    const cancelRes = await bookingsService.cancelBooking(booking.id, booking.accessToken, "Emergency cancellation");
    assert.equal(cancelRes.success, true);

    // Assert host earnings is neutralized to CANCELLED
    const [cancelledEarnings] = await db
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, booking.id));
    assert.equal(cancelledEarnings.status, "CANCELLED", "Host earnings must be neutralized to CANCELLED on cancellation");
  });

  it("5. Admin Stats Revenue Query: Sums SUCCESS payments (non-zero in production)", async () => {
    const stats = await adminService.getStats();
    assert.ok(stats.users > 0, "Users count > 0");
    assert.ok(stats.properties > 0, "Properties count > 0");
    assert.ok(stats.bookings > 0, "Bookings count > 0");
    assert.ok(stats.revenue > 0, "Admin revenue must be non-zero from SUCCESS payments");
    console.log(`   [Admin Stats] Verified: Bookings=${stats.bookings}, Revenue=₦${stats.revenue.toLocaleString()}`);
  });
});
