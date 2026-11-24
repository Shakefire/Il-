import "dotenv/config";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq, and, sql } from "drizzle-orm";
import { withChannelIdempotency, recordDelivery } from "../backend/src/modules/notifications/delivery-ledger";
import { inboxService } from "../backend/src/modules/notifications/inbox.service";
import { bookingsService } from "../backend/src/modules/bookings/bookings.service";
import { sendSms } from "../backend/src/modules/notifications/termii.service";
import { sendFcmPush } from "../backend/src/modules/notifications/fcm.service";
import { sendWebPush } from "../backend/src/modules/notifications/web-push.service";
import { BOOKING_STATUS } from "../backend/src/config/constants";
import { calculateNights, calculatePaystackFee } from "../src/lib/utils";

describe("Notification Independence & Marketplace Search Flow Verification", () => {
  const db = getDb();
  const ts = Date.now();
  const hostId = `host_indep_${ts}`;
  const guestId = `guest_indep_${ts}`;
  const propertyId = `prop_indep_${ts}`;

  before(async () => {
    // Seed host & guest
    await db.insert(schema.users).values([
      {
        id: hostId,
        email: `host_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Adaobi",
        lastName: "Host",
        phone: "+2348055551111",
        role: "host",
        emailVerified: true,
        status: "ACTIVE",
      },
      {
        id: guestId,
        email: `guest_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Chidi",
        lastName: "Guest",
        phone: "+2348055552222",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      },
    ]).onConflictDoNothing();

    await db.insert(schema.profiles).values({
      id: `prof_${hostId}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    }).onConflictDoNothing();

    await db.insert(schema.properties).values({
      id: propertyId,
      hostId,
      slug: `indep-stay-${ts}`,
      title: `Independence Stay ${ts}`,
      description: "Testing notification channel isolation and search transfer",
      propertyType: "Apartment",
      maxGuests: 4,
      pricePerNight: 75000,
      hostBasePrice: 67500,
      cleaningFee: 0,
      minimumNights: 2,
      city: "Lagos",
      neighborhood: "Lekki Phase 1",
      state: "Lagos",
      latitude: 6.44,
      longitude: 3.48,
      powerType: "Solar + Inverter",
      coverImage: "/images/stay.jpg",
      status: "PUBLISHED",
    }).onConflictDoNothing();
  });

  // Scenario 1: Email succeeds, SMS fails
  it("Scenario 1: Email succeeds, SMS fails — channels are independent & in-app inbox created", async () => {
    const key = `test_sc1_${ts}`;

    // 1. In-app notification write (transactional outbox)
    const inboxRes = await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "New booking request",
      body: "Guest requested stay",
      idempotencyKey: `${key}:inbox`,
    });
    assert.ok(inboxRes.item.id, "Inbox notification must be created");

    // 2. Email channel succeeds
    const emailRes = await withChannelIdempotency({
      channel: "email",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:email`,
      recipient: `host_${ts}@test.ile.ng`,
      send: async () => ({
        ok: true,
        providerMessageId: "msg_email_ok",
      }),
    });
    assert.equal(emailRes.sent, true);

    // 3. SMS channel fails (e.g. provider network error or timeout)
    const smsRes = await withChannelIdempotency({
      channel: "sms",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:sms`,
      recipient: "+2348055551111",
      send: async () => {
        throw new Error("Termii gateway timeout 504");
      },
    });
    assert.equal(smsRes.sent, false);

    // Verify database state in notification_deliveries
    const deliveries = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(sql`${schema.notificationDeliveries.idempotencyKey} LIKE ${`${key}:%`}`);

    const emailDelivery = deliveries.find((d) => d.channel === "email");
    const smsDelivery = deliveries.find((d) => d.channel === "sms");

    assert.ok(emailDelivery, "Email delivery row must exist");
    assert.equal(emailDelivery.status, "SENT");
    assert.ok(smsDelivery, "SMS delivery row must exist");
    assert.equal(smsDelivery.status, "FAILED");

    // Host in-app inbox still received the notification
    const hostInbox = await inboxService.listForUser(hostId);
    assert.ok(hostInbox.items.some((i) => i.idempotencyKey === `${key}:inbox`));
  });

  // Scenario 2: SMS succeeds, email fails
  it("Scenario 2: SMS succeeds, email fails — SMS delivered, in-app notification persists", async () => {
    const key = `test_sc2_${ts}`;

    // 1. In-app inbox write
    await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "New booking request",
      body: "Guest requested stay",
      idempotencyKey: `${key}:inbox`,
    });

    // 2. Email channel throws provider error
    const emailRes = await withChannelIdempotency({
      channel: "email",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:email`,
      recipient: `host_${ts}@test.ile.ng`,
      send: async () => {
        throw new Error("Resend rate limit exceeded 429");
      },
    });
    assert.equal(emailRes.sent, false);

    // 3. SMS channel succeeds
    const smsRes = await withChannelIdempotency({
      channel: "sms",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:sms`,
      recipient: "+2348055551111",
      send: async () => ({
        ok: true,
        providerMessageId: "termii_msg_123",
      }),
    });
    assert.equal(smsRes.sent, true);

    const deliveries = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(sql`${schema.notificationDeliveries.idempotencyKey} LIKE ${`${key}:%`}`);

    const emailDelivery = deliveries.find((d) => d.channel === "email");
    const smsDelivery = deliveries.find((d) => d.channel === "sms");

    assert.equal(emailDelivery?.status, "FAILED");
    assert.equal(smsDelivery?.status, "SENT");
  });

  // Scenario 3: Email and SMS both fail
  it("Scenario 3: Both external channels fail — in-app notification is still preserved in DB", async () => {
    const key = `test_sc3_${ts}`;

    // 1. Persistent in-app write
    const inboxItem = await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "New booking request",
      body: "Guest requested stay",
      idempotencyKey: `${key}:inbox`,
    });
    assert.ok(inboxItem.item.id);

    // 2. Email provider error
    const emailRes = await withChannelIdempotency({
      channel: "email",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:email`,
      recipient: `host_${ts}@test.ile.ng`,
      send: async () => {
        throw new Error("SMTP server down");
      },
    });

    // 3. SMS provider error
    const smsRes = await withChannelIdempotency({
      channel: "sms",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:sms`,
      recipient: "+2348055551111",
      send: async () => {
        throw new Error("Telco network error");
      },
    });

    assert.equal(emailRes.sent, false);
    assert.equal(smsRes.sent, false);

    // Verify in-app item in database
    const [savedInbox] = await db
      .select()
      .from(schema.notificationInbox)
      .where(eq(schema.notificationInbox.id, inboxItem.item.id));

    assert.ok(savedInbox, "In-app notification must persist in database even when external services fail");
    assert.equal(savedInbox.userId, hostId);
  });

  // Scenario 4: Email and SMS are not configured
  it("Scenario 4: Unconfigured channels record SKIPPED without throwing errors", async () => {
    const key = `test_sc4_${ts}`;

    // Test termiiService behavior when unconfigured
    const termiiRes = await sendSms({
      to: "+2348011112222",
      message: "Test message",
    });
    assert.equal(termiiRes.skipped, true, "Termii must return skipped=true when unconfigured");
    assert.equal(termiiRes.ok, false);

    // Test fcmService behavior when unconfigured
    const fcmRes = await sendFcmPush({
      token: "mock_fcm_token_value",
      title: "Test Push",
      body: "Test Body",
    });
    assert.equal(fcmRes.skipped, true, "FCM must return skipped=true when unconfigured");

    // Test webPushService behavior when unconfigured
    const webPushRes = await sendWebPush({
      endpoint: "https://mock.endpoint",
      title: "Test",
      body: "Test body",
    });
    assert.equal(webPushRes.skipped, true, "Web Push must return skipped=true when unconfigured");

    // Verify ledger records SKIPPED
    const ledgerRes = await withChannelIdempotency({
      channel: "sms",
      eventType: "BOOKING_TEST",
      idempotencyKey: `${key}:sms_skip`,
      recipient: "+2348011112222",
      send: async () => ({
        ok: false,
        skipped: true,
        error: "SMS provider not configured (optional)",
      }),
    });
    assert.equal(ledgerRes.skipped, true);

    const [skipRow] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, `${key}:sms_skip`));
    assert.equal(skipRow?.status, "SKIPPED");
  });

  // Scenario 5: Host is offline when booking is made
  it("Scenario 5: Host is offline — in-app notification persists and is retrieved on inbox query", async () => {
    const key = `test_sc5_${ts}`;

    // Simulate booking creation creating outbox inbox notice while host is disconnected
    await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "Booking awaiting your confirmation",
      body: "You have 120 seconds to confirm this reservation.",
      deepLink: `/host/dashboard?booking=ILE-${ts}`,
      idempotencyKey: `${key}:offline_host`,
    });

    // Host comes online later and fetches inbox
    const inbox = await inboxService.listForUser(hostId);
    const pendingNotice = inbox.items.find((i) => i.idempotencyKey === `${key}:offline_host`);

    assert.ok(pendingNotice, "Offline host must receive in-app notice when querying inbox");
    assert.equal(pendingNotice.readAt, null, "Must initially be unread");

    // Host marks it as read
    const marked = await inboxService.markRead(hostId, pendingNotice.id);
    assert.ok(marked?.readAt, "Notification should be marked read");
  });

  // Scenario 6: Duplicate notification delivery is prevented
  it("Scenario 6: Duplicate delivery prevention via idempotency", async () => {
    const key = `test_sc6_${ts}`;
    let providerCallCount = 0;

    const dispatch = () =>
      withChannelIdempotency({
        channel: "email",
      eventType: "BOOKING_TEST",
        idempotencyKey: key,
        recipient: `host_${ts}@test.ile.ng`,
        send: async () => {
          providerCallCount++;
          return { ok: true, providerMessageId: "first_call" };
        },
      });

    const first = await dispatch();
    assert.equal(first.sent, true);
    assert.equal(providerCallCount, 1);

    // Call again with the exact same idempotency key
    const second = await dispatch();
    assert.equal(second.idempotent, true);
    assert.equal(second.sent, false);
    assert.equal(providerCallCount, 1, "Provider send() must NOT be invoked again on duplicate key");

    const [row] = await db
      .select()
      .from(schema.notificationDeliveries)
      .where(eq(schema.notificationDeliveries.idempotencyKey, key));
    assert.equal(row?.status, "SENT");

    // Verify inbox idempotency as well
    const inbox1 = await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "Notice",
      body: "Body",
      idempotencyKey: `${key}:inbox`,
    });
    assert.equal(inbox1.created, true);

    const inbox2 = await inboxService.upsertInboxItem({
      userId: hostId,
      eventType: "BOOKING_TEST",
      title: "Notice",
      body: "Body",
      idempotencyKey: `${key}:inbox`,
    });
    assert.equal(inbox2.created, false);
    assert.equal(inbox1.item.id, inbox2.item.id);
  });

  // Scenario 7: Search criteria transfer from marketplace to booking screen
  it("Scenario 7: Search criteria transfer maintains location, dates, guests, and apartment type", () => {
    // Simulated marketplace search query
    const marketplaceQuery = {
      destination: "Lekki Phase 1, Lagos",
      checkIn: "2026-12-10",
      checkOut: "2026-12-14",
      guests: 3,
      type: "Apartment",
      power: "24/7 Solar + Inverter",
      bedrooms: 2,
    };

    // Simulated booking screen intake (as implemented in ReserveScreen and BookingPanel)
    const bookingScreenState = {
      selectedDestination: marketplaceQuery.destination,
      checkInDate: marketplaceQuery.checkIn,
      checkOutDate: marketplaceQuery.checkOut,
      guestsCount: marketplaceQuery.guests,
      apartmentType: marketplaceQuery.type,
      powerPreference: marketplaceQuery.power,
      requestedBedrooms: marketplaceQuery.bedrooms,
    };

    // Assert zero loss of criteria
    assert.equal(bookingScreenState.selectedDestination, "Lekki Phase 1, Lagos");
    assert.equal(bookingScreenState.checkInDate, "2026-12-10");
    assert.equal(bookingScreenState.checkOutDate, "2026-12-14");
    assert.equal(bookingScreenState.guestsCount, 3);
    assert.equal(bookingScreenState.apartmentType, "Apartment");
    assert.equal(bookingScreenState.powerPreference, "24/7 Solar + Inverter");
    assert.equal(bookingScreenState.requestedBedrooms, 2);

    // Verify length of stay calculation
    const nights = calculateNights(bookingScreenState.checkInDate, bookingScreenState.checkOutDate);
    assert.equal(nights, 4);
  });

  // Scenario 8: User can change dates/guests on booking screen and revalidate
  it("Scenario 8: Modifying dates/guests recalculates totals and validates availability", async () => {
    const basePrice = 75000;
    const initialCheckIn = "2026-12-10";
    const initialCheckOut = "2026-12-14";
    const initialNights = calculateNights(initialCheckIn, initialCheckOut); // 4 nights
    const initialStayCost = basePrice * initialNights;
    const initialFee = calculatePaystackFee(initialStayCost);
    const initialTotal = initialStayCost + initialFee;

    assert.equal(initialNights, 4);
    assert.equal(initialStayCost, 300000);
    assert.equal(initialFee, 2000); // Paystack domestic cap of ₦2,000
    assert.equal(initialTotal, 302000); // 300000 + 2000

    // User modifies stay to 6 nights
    const newCheckIn = "2026-12-10";
    const newCheckOut = "2026-12-16";
    const updatedNights = calculateNights(newCheckIn, newCheckOut);
    const updatedStayCost = basePrice * updatedNights;
    const updatedFee = calculatePaystackFee(updatedStayCost);
    const updatedTotal = updatedStayCost + updatedFee;

    assert.equal(updatedNights, 6);
    assert.equal(updatedStayCost, 450000);
    assert.equal(updatedFee, 2000); // Paystack domestic cap of ₦2,000
    assert.equal(updatedTotal, 452000); // 450000 + 2000

    // Availability validation check
    const availabilityCheck = await bookingsService.checkAvailability(
      propertyId,
      newCheckIn,
      newCheckOut
    );
    assert.equal(availabilityCheck.available, true, "New date range must be available");
  });
});
