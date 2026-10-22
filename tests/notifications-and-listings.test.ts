import "dotenv/config";
import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import {
  welcomeEmail,
  hostWelcomeEmail,
  emailOtpEmail,
  passwordResetEmail,
  passwordResetSuccessEmail,
  listingPublishedEmail,
  listingSuspendedEmail,
  hostAccountSuspendedEmail,
  bookingInitiatedEmail,
  bookingConfirmationEmail,
  bookingAccessPassEmail,
  bookingPaymentFailedEmail,
  bookingCancelledEmail,
  bookingRefundEmail,
  hostBookingConfirmedEmail,
  hostUpcomingArrivalEmail,
  hostNewReviewEmail,
  escapeHtml,
  formatCurrency,
} from "../backend/src/modules/notifications/notifications.service";
import { hostsService } from "../backend/src/modules/hosts/hosts.service";
import { adminService } from "../backend/src/modules/admin/admin.service";
import { bookingsService } from "../backend/src/modules/bookings/bookings.service";
import { processSuccessfulPayment } from "../backend/src/modules/payments/payments.service";

describe("Ilé Notifications & Listing Lifecycle Test Suite", () => {
  const db = getDb();
  const timestamp = Date.now();

  describe("1. Email Template Rendering, Formatting & Injection Safety", () => {
    it("HTML Escaping prevents script injection in dynamic fields", () => {
      const maliciousInput = "<script>alert('XSS')</script>";
      const escaped = escapeHtml(maliciousInput);
      assert.equal(escaped.includes("<script>"), false);
      assert.equal(escaped.includes("&lt;script&gt;"), true);

      // Verify in templates
      const otp = emailOtpEmail({
        name: maliciousInput,
        email: "test@ile.ng",
        code: "123456",
        purpose: maliciousInput,
      });
      assert.equal(otp.html.includes("<script>"), false);

      const listingPub = listingPublishedEmail({
        hostName: maliciousInput,
        hostEmail: "host@ile.ng",
        propertyTitle: maliciousInput,
        propertyId: "prop_123",
        nightlyPrice: 45000,
        city: "Abuja",
        neighborhood: "Maitama",
      });
      assert.equal(listingPub.html.includes("<script>"), false);

      const suspended = listingSuspendedEmail({
        hostName: maliciousInput,
        hostEmail: "host@ile.ng",
        propertyTitle: maliciousInput,
        reason: maliciousInput,
      });
      assert.equal(suspended.html.includes("<script>"), false);
    });

    it("Currency formatting correctly renders Naira and international currencies", () => {
      assert.equal(formatCurrency(50000, "NGN"), "₦50,000");
      assert.equal(formatCurrency(250, "USD"), "$250");
      assert.equal(formatCurrency(120000, "₦"), "₦120,000");
    });

    it("Host booking confirmed email contains full payout and guest breakdown", () => {
      const email = hostBookingConfirmedEmail({
        hostName: "Ngozi",
        hostEmail: "ngozi@ile.ng",
        propertyTitle: "Luxury 2BR in Maitama",
        referenceCode: "ILE-2026-TEST",
        guestName: "Chinedu Okafor",
        guestPhone: "+2348031234567",
        guestEmail: "chinedu@test.ng",
        checkIn: "2026-11-10",
        checkOut: "2026-11-15",
        numberOfNights: 5,
        guestCount: 2,
        grossAmount: 250000,
        commissionAmount: 25000,
        netPayout: 225000,
        currency: "NGN",
      });

      assert.equal(email.to, "ngozi@ile.ng");
      assert.equal(email.subject.includes("New Booking Confirmed"), true);
      assert.equal(email.html.includes("Chinedu Okafor"), true);
      assert.equal(email.html.includes("+2348031234567"), true);
      assert.equal(email.html.includes("₦225,000"), true);
      assert.equal(email.html.includes("₦25,000"), true);
    });

    it("Host upcoming arrival email contains readiness checklist and contact", () => {
      const email = hostUpcomingArrivalEmail({
        hostName: "Tunde",
        hostEmail: "tunde@ile.ng",
        propertyTitle: "Nordic Minimalist Loft",
        referenceCode: "ILE-ARR-001",
        guestName: "Fatima Bello",
        guestPhone: "+2348099887766",
        guestEmail: "fatima@test.ng",
        checkIn: "2026-11-01",
        checkOut: "2026-11-04",
        guestCount: 1,
      });

      assert.equal(email.to, "tunde@ile.ng");
      assert.equal(email.subject.includes("Arrival Tomorrow"), true);
      assert.equal(email.html.includes("Host Readiness Checklist"), true);
      assert.equal(email.html.includes("Fatima Bello"), true);
      assert.equal(email.html.includes("generator"), true);
    });

    it("New review notification email formats rating and host reply link", () => {
      const email = hostNewReviewEmail({
        hostName: "Amaka",
        hostEmail: "amaka@ile.ng",
        propertyTitle: "Ikoyi Penthouse",
        guestName: "Emeka Obi",
        rating: 5,
        reviewTitle: "Exceptional 24/7 Power",
        reviewBody: "The solar inverter setup was seamless and Maitama views were great.",
      });

      assert.equal(email.to, "amaka@ile.ng");
      assert.equal(email.subject.includes("5-Star Review"), true);
      assert.equal(email.html.includes("Exceptional 24/7 Power"), true);
      assert.equal(email.html.includes("★★★★★"), true);
    });
  });

  describe("2. Host KYC Verification & Listing Publication Lifecycle", () => {
    const verifiedHostId = `usr_test_vhost_${timestamp}`;
    const unverifiedHostId = `usr_test_uvhost_${timestamp}`;
    let createdPropertyId: string;

    it("Sets up test host accounts (one KYC-approved, one unverified)", async () => {
      // Verified Host
      await db.insert(schema.users).values({
        id: verifiedHostId,
        email: `vhost_${timestamp}@test.ile.ng`,
        passwordHash: "hash123",
        firstName: "Verified",
        lastName: "Host",
        role: "host",
        emailVerified: true,
      });

      await db.insert(schema.profiles).values({
        id: `prof_${verifiedHostId}`,
        userId: verifiedHostId,
        isVerified: true,
        verificationStatus: "APPROVED",
        bankName: "Guaranty Trust Bank",
        bankAccountNumber: "0123456789",
        bankAccountName: "Verified Host",
      });

      // Unverified Host
      await db.insert(schema.users).values({
        id: unverifiedHostId,
        email: `uvhost_${timestamp}@test.ile.ng`,
        passwordHash: "hash123",
        firstName: "Unverified",
        lastName: "Host",
        role: "host",
        emailVerified: true,
      });

      await db.insert(schema.profiles).values({
        id: `prof_${unverifiedHostId}`,
        userId: unverifiedHostId,
        isVerified: false,
        verificationStatus: "UNDER_REVIEW",
      });
    });

    it("Unverified host is forbidden from creating/publishing listings", async () => {
      await assert.rejects(
        async () => {
          await hostsService.createProperty(unverifiedHostId, {
            title: "Illegitimate Listing",
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /verified property partners/i);
          return true;
        }
      );
    });

    it("KYC-approved host creates complete draft listing", async () => {
      const prop = await hostsService.createProperty(verifiedHostId, {
        title: "Verified Oasis Villa",
        description: "A stunning fully serviced 2-bedroom residence with 24/7 solar power and fiber internet.",
        propertyType: "Apartment",
        city: "Abuja",
        neighborhood: "Wuse II",
        latitude: 9.0765,
        longitude: 7.4898,
        pricePerNight: 65000,
        exactAddress: "14 Adetokunbo Ademola Crescent, Wuse II",
        images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200"],
      });

      assert.equal(prop.status, "DRAFT");
      assert.equal(prop.moderationStatus, "NONE");
      createdPropertyId = prop.id;
    });

    it("KYC-approved host publishes listing directly to PUBLISHED status without routine per-listing admin review", async () => {
      const result = await hostsService.submitPropertyForReview(verifiedHostId, createdPropertyId);

      assert.equal(result.success, true);
      assert.equal(result.property.status, "PUBLISHED");
      assert.equal(result.property.moderationStatus, "NONE");

      // Verify in DB
      const [inDb] = await db.select().from(schema.properties).where(eq(schema.properties.id, createdPropertyId));
      assert.equal(inDb.status, "PUBLISHED");
      assert.equal(inDb.moderationStatus, "NONE");
    });

    it("Admin suspends listing for policy violation", async () => {
      const adminId = "usr_admin_default";
      const updated = await adminService.updatePropertyStatus(
        createdPropertyId,
        "SUSPENDED",
        "Noise complaint and unauthorized party policy violation.",
        adminId
      );

      assert.equal(updated.status, "SUSPENDED");
      assert.equal(updated.moderationStatus, "SUSPENDED");
      assert.equal(updated.moderationReason, "Noise complaint and unauthorized party policy violation.");
      assert.equal(updated.moderatedBy, adminId);
      assert.notEqual(updated.moderatedAt, null);
    });

    it("Host cannot self-publish or bypass admin suspension via updateProperty", async () => {
      // 1. Attempting to set status: 'PUBLISHED' throws 403
      await assert.rejects(
        async () => {
          await hostsService.updateProperty(verifiedHostId, createdPropertyId, {
            status: "PUBLISHED",
          });
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /suspended by platform administrators/i);
          return true;
        }
      );

      // 2. Editing content while suspended succeeds, but status remains SUSPENDED
      const updated = await hostsService.updateProperty(verifiedHostId, createdPropertyId, {
        description: "Updated description removing party mentions.",
      });

      assert.equal(updated.status, "SUSPENDED");
      assert.equal(updated.moderationStatus, "SUSPENDED");

      const [inDb] = await db.select().from(schema.properties).where(eq(schema.properties.id, createdPropertyId));
      assert.equal(inDb.status, "SUSPENDED");
      assert.equal(inDb.moderationStatus, "SUSPENDED");
    });

    it("Host cannot self-relist suspended listing via relistProperty", async () => {
      await assert.rejects(
        async () => {
          await hostsService.relistProperty(verifiedHostId, createdPropertyId);
        },
        (err: any) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /suspended by platform administrators/i);
          return true;
        }
      );
    });

    it("Admin restores listing to PUBLISHED status", async () => {
      const adminId = "usr_admin_default";
      const restored = await adminService.updatePropertyStatus(
        createdPropertyId,
        "PUBLISHED",
        null,
        adminId
      );

      assert.equal(restored.status, "PUBLISHED");
      assert.equal(restored.moderationStatus, "NONE");
    });
  });

  describe("3. Booking Lifecycle, Payment Confirmation & Email Handshake", () => {
    let bookingId: string;
    let paymentRef: string;
    let propertyId: string;
    let hostId: string;

    it("Creates a booking and verifies initiated state", async () => {
      // Create a fresh dedicated published property for booking lifecycle testing
      const uniquePropId = `prop_booking_test_${timestamp}`;
      const [newProp] = await db
        .insert(schema.properties)
        .values({
          id: uniquePropId,
          hostId: "usr_host_default",
          slug: `booking-test-${timestamp}`,
          title: "Booking Test Residence",
          description: "Dedicated property for booking lifecycle regression test.",
          propertyType: "Apartment",
          city: "Abuja",
          neighborhood: "Maitama",
          state: "FCT",
          latitude: 9.08,
          longitude: 7.49,
          powerType: "Solar + Inverter",
          coverImage: "/images/placeholder.jpg",
          pricePerNight: 50000,
          status: "PUBLISHED",
          moderationStatus: "NONE",
        })
        .returning();

      await db.insert(schema.propertyPrivateDetails).values({
        id: `pvd_${uniquePropId}`,
        propertyId: uniquePropId,
        exactAddress: "10 Mississippi Street, Maitama",
        contactName: "Boutique Host",
        contactPhone: "+2348000000002",
        contactEmail: "host@ile.ng",
        accessGateCode: "GATE-9988",
      });

      propertyId = newProp.id;
      hostId = newProp.hostId;

      const randOffset = Math.floor(Math.random() * 200) + 40;
      const d1 = new Date(Date.now() + randOffset * 86400000);
      const d2 = new Date(Date.now() + (randOffset + 3) * 86400000);
      const checkInStr = d1.toISOString().split("T")[0];
      const checkOutStr = d2.toISOString().split("T")[0];

      const result = await bookingsService.createBooking({
        propertyId: newProp.id,
        guestFirstName: "Nnamdi",
        guestLastName: "Azikiwe",
        guestEmail: `guest_${timestamp}@test.ile.ng`,
        guestPhone: "+2348011223344",
        guestCount: 2,
        checkInDate: checkInStr,
        checkOutDate: checkOutStr,
      });

      assert.equal(result.booking.status, "PAYMENT_PENDING");
      assert.ok(result.booking.referenceCode.startsWith("ILE-"));
      assert.ok(result.paymentReference);

      bookingId = result.booking.id;
      paymentRef = result.paymentReference;
    });

    it("Processes successful payment and confirms host earnings calculation", async () => {
      const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));

      const paymentResult = await processSuccessfulPayment({
        reference: paymentRef,
        gatewayReference: `paystack_gw_${timestamp}`,
        paidAmountNaira: booking.totalAmount,
        currency: "NGN",
        method: "CARD",
      });

      assert.equal(paymentResult.success, true);
      assert.equal(paymentResult.booking.status, "CONFIRMED");

      // Verify host earnings
      const [earnings] = await db
        .select()
        .from(schema.hostEarnings)
        .where(eq(schema.hostEarnings.bookingId, bookingId));

      assert.ok(earnings, "Host earnings record must be created");
      const expectedAccommodationSubtotal = booking.accommodationSubtotal || (booking.nightlyPrice * booking.numberOfNights);
      const expectedCommission = Math.round(expectedAccommodationSubtotal * 0.1);
      const expectedNet = expectedAccommodationSubtotal - expectedCommission;

      assert.equal(earnings.grossAmount, expectedAccommodationSubtotal);
      assert.equal(earnings.commissionAmount, expectedCommission);
      assert.equal(earnings.netAmount, expectedNet);
    });

    it("Idempotent payment processing does not duplicate actions or throw", async () => {
      const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));

      const repeatResult = await processSuccessfulPayment({
        reference: paymentRef,
        gatewayReference: `paystack_gw_${timestamp}`,
        paidAmountNaira: booking.totalAmount,
        currency: "NGN",
      });

      assert.equal(repeatResult.success, true);
      assert.match(repeatResult.message, /idempotent/i);

      // Verify earnings are not duplicated
      const allEarnings = await db
        .select()
        .from(schema.hostEarnings)
        .where(eq(schema.hostEarnings.bookingId, bookingId));
      assert.equal(allEarnings.length, 1);
    });

    it("Cancelling a booking updates status, records cancellation reason, and frees availability", async () => {
      const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));

      const cancelResult = await bookingsService.cancelBooking(
        bookingId,
        booking.accessToken,
        "Travel plans rescheduled by guest"
      );

      assert.equal(cancelResult.success, true);
      assert.equal(cancelResult.booking.status, "CANCELLED");

      const [cancelledInDb] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
      assert.equal(cancelledInDb.status, "CANCELLED");
      assert.equal(cancelledInDb.cancellationReason, "Travel plans rescheduled by guest");
      assert.notEqual(cancelledInDb.cancelledAt, null);

      // Verify availability block was deleted
      const blocks = await db
        .select()
        .from(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));
      assert.equal(blocks.length, 0, "Availability block must be removed on cancellation");
    });
  });

  describe("4. Search & Property Visibility Excludes Suspended Listings", () => {
    it("Suspended property is excluded from getPublishedProperties", async () => {
      const { getPublishedProperties } = await import("../backend/src/modules/properties/properties.service");

      // Create a test property and suspend it
      const tempProp = await db
        .insert(schema.properties)
        .values({
          id: `prop_test_susp_${timestamp}`,
          hostId: "usr_host_default",
          slug: `suspended-property-${timestamp}`,
          title: "Suspended Test Property",
          description: "This property is suspended for moderation test.",
          propertyType: "Apartment",
          city: "Abuja",
          neighborhood: "Asokoro",
          state: "FCT",
          latitude: 9.05,
          longitude: 7.5,
          powerType: "Generator",
          coverImage: "/images/placeholder.jpg",
          pricePerNight: 50000,
          status: "PUBLISHED",
          moderationStatus: "SUSPENDED",
          moderationReason: "Test suspension",
        })
        .returning();

      const { properties } = await getPublishedProperties({ limit: 100, offset: 0 });
      const found = properties.find((p: any) => p.id === tempProp[0].id);
      assert.equal(found, undefined, "Suspended property must not appear in published search");

      // Clean up
      await db.delete(schema.properties).where(eq(schema.properties.id, tempProp[0].id));
    });
  });

  describe("4. Host Upcoming Arrival Reminders with Durable Tracking", () => {
    it("Sends upcoming arrival reminder and records timestamp exactly once", async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // Find or create confirmed booking checking in tomorrow
      const [prop] = await db
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.status, "PUBLISHED"))
        .limit(1);

      const reminderBookingId = `book_reminder_${timestamp}`;
      await db.insert(schema.bookings).values({
        id: reminderBookingId,
        referenceCode: `ILE-REM-${timestamp}`,
        propertyId: prop.id,
        guestFirstName: "Chika",
        guestLastName: "Nwosu",
        guestEmail: "chika@test.ile.ng",
        guestPhone: "+2348055667788",
        guestCount: 2,
        checkInDate: tomorrowStr,
        checkOutDate: "2026-12-30",
        numberOfNights: 2,
        nightlyPrice: 40000,
        totalAmount: 80000,
        status: "CONFIRMED",
        accessToken: `token_rem_${timestamp}`,
        hostArrivalReminderSentAt: null,
      });

      // 1. First execution dispatches reminder
      const run1 = await bookingsService.processUpcomingArrivalReminders(tomorrowStr);
      assert.ok(run1.remindersSentCount >= 1);
      const sentMatch = run1.sent.find((s) => s.bookingId === reminderBookingId);
      assert.ok(sentMatch, "The test booking must be in the sent reminders list");

      // Verify timestamp is durably saved in DB
      const [updatedBooking] = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, reminderBookingId));
      assert.notEqual(updatedBooking.hostArrivalReminderSentAt, null);

      // 2. Second execution skips this booking (exactly-once delivery)
      const run2 = await bookingsService.processUpcomingArrivalReminders(tomorrowStr);
      const sentMatch2 = run2.sent.find((s) => s.bookingId === reminderBookingId);
      assert.equal(sentMatch2, undefined, "Already processed booking must not receive duplicate reminder");
    });
  });
});
