import "dotenv/config";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, schema } from "../backend/src/db/client";
import { eq, and, sql } from "drizzle-orm";
import { bookingsService } from "../backend/src/modules/bookings/bookings.service";
import { hostsService } from "../backend/src/modules/hosts/hosts.service";
import { BOOKING_STATUS, HOST_RESPONSE, CANCELLATION_REASON } from "../backend/src/config/constants";

describe("Booking Lifecycle Forensic Audit & Fixes", () => {
  const db = getDb();
  const ts = Date.now();
  const hostId = `host_audit_${ts}`;
  const guestId = `guest_audit_${ts}`;
  const propertyId1 = `prop_audit_1_${ts}`;
  const propertyId2 = `prop_audit_2_${ts}`;

  const futureDates = (offsetDays: number, nights = 2) => {
    const inD = new Date(Date.now() + offsetDays * 86400000);
    const outD = new Date(Date.now() + (offsetDays + nights) * 86400000);
    return {
      checkInDate: inD.toISOString().split("T")[0],
      checkOutDate: outD.toISOString().split("T")[0],
    };
  };

  before(async () => {
    // Seed host with phone, guest, and 2 published properties in same city
    await db.insert(schema.users).values({
      id: hostId,
      email: `host_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Amaka",
      lastName: "Host",
      phone: "+2348011112222",
      role: "host",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing();

    await db.insert(schema.profiles).values({
      id: `prof_${hostId}`,
      userId: hostId,
      isVerified: true,
      verificationStatus: "APPROVED",
      onboardingCompleted: true,
    }).onConflictDoNothing();

    await db.insert(schema.users).values({
      id: guestId,
      email: `guest_${ts}@test.ile.ng`,
      passwordHash: "hash",
      firstName: "Emeka",
      lastName: "Guest",
      phone: "+2348033334444",
      role: "guest",
      emailVerified: true,
      status: "ACTIVE",
    }).onConflictDoNothing();

    await db.insert(schema.properties).values([
      {
        id: propertyId1,
        hostId,
        slug: `audit-stay-1-${ts}`,
        title: `Audit Stay Alpha ${ts}`,
        description: "Primary stay for booking lifecycle test",
        propertyType: "Apartment",
        maxGuests: 4,
        pricePerNight: 80000,
        hostBasePrice: 72000,
        cleaningFee: 0,
        minimumNights: 1,
        city: "Lagos",
        neighborhood: "Ikoyi",
        state: "Lagos",
        latitude: 6.45,
        longitude: 3.43,
        powerType: "24/7 Solar + Grid",
        coverImage: "/images/stay1.jpg",
        status: "PUBLISHED",
      },
      {
        id: propertyId2,
        hostId,
        slug: `audit-stay-2-${ts}`,
        title: `Audit Stay Beta ${ts}`,
        description: "Secondary stay for similar property recommendation",
        propertyType: "Apartment",
        maxGuests: 4,
        pricePerNight: 95000,
        hostBasePrice: 85000,
        cleaningFee: 0,
        minimumNights: 1,
        city: "Lagos",
        neighborhood: "Victoria Island",
        state: "Lagos",
        latitude: 6.43,
        longitude: 3.42,
        powerType: "24/7 Generator + Inverter",
        coverImage: "/images/stay2.jpg",
        status: "PUBLISHED",
      },
    ]).onConflictDoNothing();
  });

  it("1. Host Alerting: createBooking awaits host profile with phone and dispatches inbox & SMS", async () => {
    const dates = futureDates(100);
    const result = await bookingsService.createBooking({
      propertyId: propertyId1,
      guestFirstName: "Emeka",
      guestLastName: "Guest",
      guestEmail: `guest_${ts}@test.ile.ng`,
      guestPhone: "+2348033334444",
      guestCount: 2,
      ...dates,
    }, { userId: guestId, role: "guest" });

    assert.equal(result.booking.status, BOOKING_STATUS.PENDING_HOST);
    assert.ok(result.timers?.hostResponseDeadlineAt);

    // Poll for async notification orchestrator microtask (Resend network latency)
    let hostRequestAlert: any = null;
    for (let i = 0; i < 20; i++) {
      const inboxItems = await db
        .select()
        .from(schema.notificationInbox)
        .where(eq(schema.notificationInbox.userId, hostId));

      hostRequestAlert = inboxItems.find(
        (m) => m.entityId === result.booking.id && m.title === "New booking request"
      );
      if (hostRequestAlert) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    assert.ok(hostRequestAlert, "Host received in-app inbox notification for new booking request");
    assert.match(hostRequestAlert.body, /Emeka requested/);
  });

  it("2. Lazy Expiration on getBooking: past 120s deadline immediately transitions to CANCELLED (HOST_WINDOW_EXPIRED)", async () => {
    const dates = futureDates(105);
    const created = await bookingsService.createBooking({
      propertyId: propertyId1,
      guestFirstName: "Emeka",
      guestLastName: "Guest",
      guestEmail: `guest_${ts}@test.ile.ng`,
      guestPhone: "+2348033334444",
      guestCount: 2,
      ...dates,
    }, { userId: guestId, role: "guest" });
    assert.equal(created.booking.status, BOOKING_STATUS.PENDING_HOST);

    // Verify availability hold exists
    const holdsBefore = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id));
    assert.equal(holdsBefore.length, 1);

    // Artificially move deadline into past (simulate 120s timeout)
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 5000) })
      .where(eq(schema.bookings.id, created.booking.id));

    // Call getBooking (guest polling endpoint)
    const fetched = await bookingsService.getBooking(created.booking.id);

    // Verify lazy expiration occurred immediately
    assert.equal(fetched.booking.status, BOOKING_STATUS.CANCELLED);
    assert.equal(fetched.booking.cancellationReason, CANCELLATION_REASON.HOST_WINDOW_EXPIRED);
    assert.equal(fetched.booking.hostResponse, HOST_RESPONSE.EXPIRED);

    // Verify availability hold was cleanly deleted
    const holdsAfter = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, created.booking.id));
    assert.equal(holdsAfter.length, 0, "Availability hold released on expiration");

    // Verify guest received expiration notification
    let expiredNotice: any = null;
    for (let i = 0; i < 20; i++) {
      const guestInbox = await db
        .select()
        .from(schema.notificationInbox)
        .where(eq(schema.notificationInbox.entityId, created.booking.id));
      expiredNotice = guestInbox.find((m) => m.title === "Booking request timed out");
      if (expiredNotice) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(expiredNotice, "Guest inbox received expiration notice");
  });

  it("3. Host Bookings View: getHostBookings lazily expires stale requests before returning", async () => {
    const dates = futureDates(110);
    const created = await bookingsService.createBooking({
      propertyId: propertyId1,
      guestFirstName: "Emeka",
      guestLastName: "Guest",
      guestEmail: `guest_${ts}@test.ile.ng`,
      guestPhone: "+2348033334444",
      guestCount: 2,
      ...dates,
    }, { userId: guestId, role: "guest" });

    // Fast-forward deadline into past
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 10000) })
      .where(eq(schema.bookings.id, created.booking.id));

    // Host queries their dashboard bookings
    const hostList = await hostsService.getHostBookings(hostId);
    const match = hostList.bookings.find((b: any) => b.id === created.booking.id);
    assert.ok(match, "Booking found in host list");
    assert.equal(match.status, BOOKING_STATUS.CANCELLED, "Stale request is marked CANCELLED in host view");
    assert.equal(match.hostResponse, HOST_RESPONSE.EXPIRED);
  });

  it("4. Similar Properties Recommendation: returns available alternatives for exact same dates and destination", async () => {
    const dates = futureDates(120);
    const created = await bookingsService.createBooking({
      propertyId: propertyId1,
      guestFirstName: "Emeka",
      guestLastName: "Guest",
      guestEmail: `guest_${ts}@test.ile.ng`,
      guestPhone: "+2348033334444",
      guestCount: 2,
      ...dates,
    }, { userId: guestId, role: "guest" });

    // Decline the request
    await bookingsService.declineBooking(created.booking.id, hostId, "Unavailable");

    // Fetch similar properties for the declined booking
    const similar = await bookingsService.findSimilarProperties(created.booking.id, 5);
    assert.ok(similar.properties.length >= 1, "Found at least 1 similar available property");
    assert.ok(
      similar.properties.some((p: any) => p.city.toLowerCase() === "lagos"),
      "Recommended similar stay in Lagos"
    );
    assert.equal(similar.autoBook, false, "Never auto-books");
    assert.equal(similar.criteria?.city, "Lagos");
    assert.equal(similar.criteria?.checkInDate, dates.checkInDate);
    assert.equal(similar.criteria?.checkOutDate, dates.checkOutDate);
  });

  it("5. Batch Expiration: expireDueBookings processes multiple overdue holds and records audit", async () => {
    const dates1 = futureDates(130);
    const dates2 = futureDates(140);
    const b1 = await bookingsService.createBooking({
      propertyId: propertyId1,
      guestFirstName: "A",
      guestLastName: "One",
      guestEmail: `a1_${ts}@test.ile.ng`,
      guestPhone: "+2348011110001",
      guestCount: 1,
      ...dates1,
    }, { userId: guestId, role: "guest" });
    const b2 = await bookingsService.createBooking({
      propertyId: propertyId2,
      guestFirstName: "B",
      guestLastName: "Two",
      guestEmail: `b2_${ts}@test.ile.ng`,
      guestPhone: "+2348011110002",
      guestCount: 1,
      ...dates2,
    }, { userId: guestId, role: "guest" });

    // Move both deadlines to past
    await db
      .update(schema.bookings)
      .set({ hostResponseDeadlineAt: new Date(Date.now() - 3000) })
      .where(sql`${schema.bookings.id} IN (${b1.booking.id}, ${b2.booking.id})`);

    const result = await bookingsService.expireDueBookings(50);
    assert.ok(result.expired >= 2, "Expired both overdue bookings");
    assert.ok(result.bookingIds.includes(b1.booking.id));
    assert.ok(result.bookingIds.includes(b2.booking.id));

    // Verify audit logs table
    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "HOST_WINDOW_EXPIRED"));
    const auditedIds = audits.map((a) => a.entityId);
    assert.ok(auditedIds.includes(b1.booking.id));
    assert.ok(auditedIds.includes(b2.booking.id));
  });
});
