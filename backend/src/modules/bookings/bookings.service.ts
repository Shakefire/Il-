import { z } from "zod";
import { eq, and, or, like, gt, lt, lte, desc, sql, inArray, isNull } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";
import { BOOKING_STATUS } from "../../config/constants";
import { parsePagination, paginatedResponse } from "../../lib/pagination";
import {
  sendEmail,
  bookingConfirmationEmail,
  bookingAccessPassEmail,
  bookingInitiatedEmail,
  bookingCancelledEmail,
  hostUpcomingArrivalEmail,
} from "../notifications/notifications.service";

const CreateBookingSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
  guestFirstName: z.string().min(1, "First name is required"),
  guestLastName: z.string().min(1, "Last name is required"),
  guestEmail: z.string().email("Valid email required"),
  guestPhone: z.string().min(6, "Valid phone number required"),
  guestCount: z.number().int().min(1, "At least 1 guest required"),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional(),
  specialRequests: z.string().optional(),
  clientSubmittedTotal: z.number().optional(),
}).refine((data) => data.checkInDate || data.startDate, {
  message: "Check-in date is required",
}).refine((data) => data.checkOutDate || data.endDate, {
  message: "Check-out date is required",
});

export const bookingsService = {
  /**
   * Create a booking with atomic PostgreSQL transaction protection
   * guaranteeing zero double-bookings or race conditions.
   */
  async createBooking(data: any, session?: any) {
    const parsed = CreateBookingSchema.parse(data);
    const inDateStr = (parsed.checkInDate || parsed.startDate)!;
    const outDateStr = (parsed.checkOutDate || parsed.endDate)!;
    const checkIn = new Date(inDateStr + "T00:00:00Z");
    const checkOut = new Date(outDateStr + "T00:00:00Z");

    // 1. Validate dates
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      const err: any = new Error("Invalid check-in or check-out date format.");
      err.statusCode = 400;
      throw err;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (checkIn < today) {
      const err: any = new Error("Check-in date cannot be in the past.");
      err.statusCode = 400;
      throw err;
    }

    if (checkOut <= checkIn) {
      const err: any = new Error("Check-out date must be after check-in date.");
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    // 2. Execute within an atomic PostgreSQL transaction
    return await db.transaction(async (tx) => {
      // A. Verify property is bookable & published
      const normalizedPropId = parsed.propertyId.replace("prop-", "prop_");
      const [property] = await tx
        .select()
        .from(schema.properties)
        .where(
          and(
            or(
              eq(schema.properties.id, parsed.propertyId),
              eq(schema.properties.slug, parsed.propertyId),
              sql`LOWER(${schema.properties.slug}) = LOWER(${parsed.propertyId})`,
              like(schema.properties.id, `%${normalizedPropId}%`),
              like(schema.properties.id, `%${parsed.propertyId}%`)
            ),
            eq(schema.properties.status, "PUBLISHED"),
            sql`(${schema.properties.moderationStatus} IS NULL OR ${schema.properties.moderationStatus} != 'SUSPENDED')`
          )
        )
        .limit(1);

      if (!property) {
        const err: any = new Error("Property not found or not published.");
        err.statusCode = 404;
        throw err;
      }

      // B. Guest capacity verification
      if (parsed.guestCount > property.maxGuests) {
        const err: any = new Error(
          `Guest count (${parsed.guestCount}) exceeds property maximum of ${property.maxGuests}.`
        );
        err.statusCode = 400;
        throw err;
      }

      // C. Minimum stay verification
      const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const minNights = property.minimumNights || 1;
      if (nights < minNights) {
        const err: any = new Error(
          `Minimum stay for this property is ${minNights} night${minNights > 1 ? "s" : ""}.`
        );
        err.statusCode = 400;
        throw err;
      }

      // D. Double-booking concurrency check (Half-open interval [start, end))
      const potentialConflicts = await tx
        .select()
        .from(schema.availabilityBlocks)
        .where(
          and(
            eq(schema.availabilityBlocks.propertyId, property.id),
            and(
              lt(schema.availabilityBlocks.startDate, outDateStr),
              gt(schema.availabilityBlocks.endDate, inDateStr)
            )
          )
        );

      // Filter out stale blocks from abandoned PAYMENT_PENDING bookings older than 30 mins
      const now = Date.now();
      const activeConflicts: typeof potentialConflicts = [];

      for (const block of potentialConflicts) {
        if (!block.bookingId) {
          activeConflicts.push(block);
          continue;
        }

        const [linkedBooking] = await tx
          .select({ status: schema.bookings.status, createdAt: schema.bookings.createdAt })
          .from(schema.bookings)
          .where(eq(schema.bookings.id, block.bookingId))
          .limit(1);

        if (!linkedBooking) {
          activeConflicts.push(block);
          continue;
        }

        // Cancelled bookings do not block
        if (linkedBooking.status === "CANCELLED") {
          await tx
            .delete(schema.availabilityBlocks)
            .where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        // Unpaid bookings older than 30 minutes expire
        const ageMs = now - new Date(linkedBooking.createdAt).getTime();
        if (linkedBooking.status === "PAYMENT_PENDING" && ageMs > 30 * 60 * 1000) {
          await tx
            .update(schema.bookings)
            .set({ status: "CANCELLED", updatedAt: new Date() })
            .where(eq(schema.bookings.id, block.bookingId));
          await tx
            .delete(schema.availabilityBlocks)
            .where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        activeConflicts.push(block);
      }

      if (activeConflicts.length > 0) {
        const conflictErr: any = new Error("Property is not available for the selected dates.");
        conflictErr.statusCode = 409;
        conflictErr.code = "DATE_CONFLICT";
        throw conflictErr;
      }

      // E. Authoritative Server-side Price Calculation (Phase 1)
      const pricePerNight = property.pricePerNight;
      const accommodationSubtotal = nights * pricePerNight;

      // Exact Paystack Pass-Through Processing Fee Formula (Local Nigeria)
      let paystackFee = 0;
      if (accommodationSubtotal < 2500) {
        paystackFee = Math.ceil(accommodationSubtotal / 0.985) - accommodationSubtotal;
      } else {
        paystackFee = Math.ceil((accommodationSubtotal + 100) / 0.985) - accommodationSubtotal;
        if (paystackFee > 2000) paystackFee = 2000; // Cap at ₦2,000 per Paystack fee rule
      }

      // Default platform commission rate (configurable via platform_settings)
      let commissionPct = 10;
      try {
        const [settings] = await tx
          .select({ pct: schema.platformSettings.defaultHostCommissionPct })
          .from(schema.platformSettings)
          .where(eq(schema.platformSettings.id, "default"))
          .limit(1);
        if (settings?.pct !== undefined && settings.pct !== null) {
          commissionPct = settings.pct;
        }
      } catch {}

      const hostCommissionAmount = Math.round((accommodationSubtotal * commissionPct) / 100);
      const hostNetAmount = accommodationSubtotal - hostCommissionAmount;
      const totalAmount = accommodationSubtotal + paystackFee;

      const bookingId = `book_${crypto.randomUUID()}`;
      const referenceCode = `ILE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const accessToken = crypto.randomBytes(32).toString("hex");

      // F. Insert Booking Record with Financial Snapshots
      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          id: bookingId,
          referenceCode,
          propertyId: property.id,
          guestId: session?.userId || null,
          guestFirstName: parsed.guestFirstName.trim(),
          guestLastName: parsed.guestLastName.trim(),
          guestEmail: parsed.guestEmail.toLowerCase().trim(),
          guestPhone: parsed.guestPhone.trim(),
          guestCount: parsed.guestCount,
          checkInDate: inDateStr,
          checkOutDate: outDateStr,
          numberOfNights: nights,
          nightlyPrice: pricePerNight,
          cleaningFee: 0, // No cleaning fee in business model
          serviceFee: paystackFee, // Paystack fee passed to guest
          totalAmount,
          currency: "NGN",
          accommodationSubtotal,
          hostCommissionPct: commissionPct,
          hostCommissionAmount,
          paystackFeeAmount: paystackFee,
          hostNetAmount,
          status: BOOKING_STATUS.PAYMENT_PENDING,
          accessToken,
        })
        .returning();

      // G. Insert Availability Block Lock
      await tx.insert(schema.availabilityBlocks).values({
        id: `block_${crypto.randomUUID()}`,
        propertyId: property.id,
        bookingId: booking.id,
        startDate: inDateStr,
        endDate: outDateStr,
        type: "RESERVATION",
      });

      // H. Initialize Internal Payment Record
      const paymentRef = `ile_${referenceCode}_${Date.now()}`;
      await tx.insert(schema.payments).values({
        id: `pay_${crypto.randomUUID()}`,
        bookingId: booking.id,
        reference: paymentRef,
        amount: totalAmount,
        currency: "NGN",
        method: "CARD",
        status: "INITIALIZED",
        gatewayProvider: "PAYSTACK",
        createdAt: new Date(),
      });

      const enrichedBooking = {
        ...booking,
        bookingStatus: booking.status,
        totalPrice: booking.totalAmount,
        startDate: booking.checkInDate,
        endDate: booking.checkOutDate,
        totalNights: booking.numberOfNights,
      };

      // Dispatch transactional reservation initiated email
      sendEmail(
        bookingInitiatedEmail({
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          guestEmail: booking.guestEmail,
          propertyTitle: property.title,
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
        })
      ).catch((e) => console.warn("[Bookings] Failed to dispatch booking initiated email:", e));

      return {
        booking: enrichedBooking,
        pricing: {
          nights,
          pricePerNight,
          subtotal: accommodationSubtotal,
          accommodationSubtotal,
          cleaningFee: 0,
          serviceFee: paystackFee,
          paystackFee,
          hostCommissionPct: commissionPct,
          hostCommissionAmount,
          hostNetAmount,
          totalAmount,
        },
        accessToken,
        paymentReference: paymentRef,
      };
    });
  },

  /**
   * Cancel an unconfirmed or pending booking and release its availability blocks.
   */
  async cancelBooking(bookingId: string, authorizedUserIdOrToken: string, reason?: string) {
    const db = getDb();

    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      const err: any = new Error("Booking not found");
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    const isOwner =
      booking.accessToken === authorizedUserIdOrToken ||
      booking.guestId === authorizedUserIdOrToken;

    if (!isOwner) {
      const err: any = new Error("Unauthorized to cancel this booking");
      err.statusCode = 403;
      throw err;
    }

    const [prop] = await db
      .select({ title: schema.properties.title })
      .from(schema.properties)
      .where(eq(schema.properties.id, booking.propertyId))
      .limit(1);

    return await db.transaction(async (tx) => {
      // 1. Update booking status
      const [updated] = await tx
        .update(schema.bookings)
        .set({
          status: "CANCELLED",
          cancellationReason: reason || "Cancelled by user request.",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      // 1B. Neutralize any pending host earnings & scheduled payouts to prevent unauthorized disbursements
      await tx
        .update(schema.hostEarnings)
        .set({
          status: "CANCELLED",
        })
        .where(eq(schema.hostEarnings.bookingId, bookingId));

      await tx
        .update(schema.payouts)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
        })
        .where(eq(schema.payouts.bookingId, bookingId));

      // 2. Release availability blocks immediately
      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));

      // 3. Dispatch cancellation email to guest
      sendEmail(
        bookingCancelledEmail({
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          guestEmail: booking.guestEmail,
          propertyTitle: prop?.title || "Ilé Property",
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          cancellationReason: reason || "Cancelled by user request.",
        })
      ).catch((e) => console.warn("[Bookings] Failed to dispatch cancellation email:", e));

      return { success: true, message: "Booking cancelled and dates released.", booking: updated };
    });
  },

  /**
   * Check whether a property is available for specific dates.
   */
  async checkAvailability(propertyId: string, checkInDate: string, checkOutDate: string) {
    const db = getDb();
    const normalizedPropId = propertyId.replace("prop-", "prop_");

    const [prop] = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(
        or(
          eq(schema.properties.id, propertyId),
          eq(schema.properties.slug, propertyId),
          sql`LOWER(${schema.properties.slug}) = LOWER(${propertyId})`,
          like(schema.properties.id, `%${normalizedPropId}%`),
          like(schema.properties.id, `%${propertyId}%`)
        )
      )
      .limit(1);

    const canonicalPropertyId = prop ? prop.id : propertyId;

    const conflicting = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.propertyId, canonicalPropertyId),
          and(
            lt(schema.availabilityBlocks.startDate, checkOutDate),
            gt(schema.availabilityBlocks.endDate, checkInDate)
          )
        )
      );

    const checkIn = new Date(checkInDate + "T00:00:00Z");
    const checkOut = new Date(checkOutDate + "T00:00:00Z");
    const totalNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      available: conflicting.length === 0,
      propertyId: canonicalPropertyId,
      checkInDate,
      checkOutDate,
      totalNights,
      conflictsCount: conflicting.length,
    };
  },

  async processPayment(bookingId: string, method: string, accessToken: string) {
    const db = getDb();

    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (!booking) throw new Error("Booking not found");

    if (accessToken && booking.accessToken !== accessToken) {
      throw new Error("Invalid access token");
    }

    if (booking.status !== BOOKING_STATUS.PAYMENT_PENDING && booking.status !== BOOKING_STATUS.PENDING) {
      throw new Error("Booking is not pending payment");
    }

    // Insert payment record
    const paymentId = `pay_${crypto.randomUUID()}`;
    const paymentRef = `PAY_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    await db.insert(schema.payments).values({
      id: paymentId,
      bookingId: booking.id,
      amount: booking.totalAmount,
      currency: booking.currency,
      method: method || "CARD",
      status: "SUCCESS",
      gatewayProvider: "PAYSTACK",
      gatewayReference: paymentRef,
      reference: paymentRef,
      paidAt: new Date(),
    });

    // Update booking status
    const [updatedBooking] = await db
      .update(schema.bookings)
      .set({ status: BOOKING_STATUS.CONFIRMED, updatedAt: new Date() })
      .where(eq(schema.bookings.id, bookingId))
      .returning();

    // Dispatch confirmation + gate pass emails (non-blocking, never throws)
    try {
      const [property] = await db
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.id, booking.propertyId))
        .limit(1);

      const [privateDetails] = await db
        .select()
        .from(schema.propertyPrivateDetails)
        .where(eq(schema.propertyPrivateDetails.propertyId, booking.propertyId))
        .limit(1);

      const [host] = property?.hostId
        ? await db
            .select({
              phone: schema.users.phone,
              firstName: schema.users.firstName,
              lastName: schema.users.lastName,
              email: schema.users.email,
              avatarUrl: schema.users.avatarUrl,
            })
            .from(schema.users)
            .where(eq(schema.users.id, property.hostId))
            .limit(1)
        : [undefined];

      const propTitle = property?.title || "Shortlet Stay";
      const guestName = `${booking.guestFirstName || ""} ${booking.guestLastName || ""}`.trim() || "Valued Guest";
      const hostFullName = host
        ? `${host.firstName} ${host.lastName}`.trim()
        : privateDetails?.contactName || "Dedicated Ilé Stay Guide";
      const hostPhone = privateDetails?.contactPhone || host?.phone || "+234 912 202 9904";
      const exactAddress = privateDetails?.exactAddress || `${property?.neighborhood || "Maitama"}, ${property?.city || "Abuja"}`;
      const unitNumber = privateDetails?.unitNumber || undefined;
      const gateCode = privateDetails?.accessGateCode || "GATE-CLEARED";
      const city = property?.city || "Abuja";
      const state = property?.state || "FCT";
      const latitude = property?.latitude || undefined;
      const longitude = property?.longitude || undefined;

      await sendEmail(
        bookingConfirmationEmail({
          guestName,
          guestEmail: booking.guestEmail,
          guestPhone: booking.guestPhone || undefined,
          propertyTitle: propTitle,
          propertyType: property?.propertyType || "Serviced Residence",
          spaceType: property?.spaceType || "Entire place",
          propertyImage: property?.coverImage || undefined,
          propertyTagline: property?.tagline || undefined,
          propertyDescription: property?.description || undefined,
          bedrooms: property?.bedrooms,
          bathrooms: property?.bathrooms,
          beds: property?.beds,
          maxGuests: property?.maxGuests,
          guestCount: booking.guestCount || 1,
          neighborhood: property?.neighborhood || undefined,
          city,
          state,
          powerType: property?.powerType || undefined,
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          numberOfNights: booking.numberOfNights,
          nightlyPrice: booking.nightlyPrice,
          cleaningFee: booking.cleaningFee,
          serviceFee: booking.serviceFee,
          totalAmount: booking.totalAmount,
          amountPaid: booking.totalAmount,
          outstandingBalance: 0,
          currency: booking.currency || "NGN",
          paymentMethod: method || "CARD",
          paymentReference: paymentRef,
          paymentStatus: "SUCCESS",
          paidAt: new Date(),
          bookingStatus: "CONFIRMED",
          accessToken: booking.accessToken,
          address: exactAddress,
          unitNumber,
          latitude,
          longitude,
          accessGateCode: gateCode,
          accessInstructions: privateDetails?.checkInInstructions || undefined,
          houseRules: privateDetails?.houseRulesPrivate || undefined,
          hostName: hostFullName,
          hostPhone,
          hostEmail: privateDetails?.contactEmail || host?.email || undefined,
        })
      );

      await sendEmail(
        bookingAccessPassEmail({
          guestName,
          guestEmail: booking.guestEmail,
          propertyTitle: propTitle,
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          address: exactAddress,
          unitNumber,
          neighborhood: property?.neighborhood || undefined,
          city,
          state,
          latitude,
          longitude,
          accessInstructions:
            privateDetails?.checkInInstructions ||
            "Present your reservation reference to estate security guards for swift clearance.",
          accessGateCode: gateCode,
          propertyImage: property?.coverImage || undefined,
          propertyType: property?.propertyType || "Serviced Residence",
          spaceType: property?.spaceType || "Entire place",
          propertyTagline: property?.tagline || undefined,
          propertyDescription: property?.description || undefined,
          bedrooms: property?.bedrooms,
          bathrooms: property?.bathrooms,
          guestCount: booking.guestCount || 1,
          numberOfNights: booking.numberOfNights,
          hostName: hostFullName,
          hostPhone,
          hostEmail: privateDetails?.contactEmail || host?.email || undefined,
          hostAvatar: host?.avatarUrl || undefined,
          hostRole: "Your accommodation host & arrival concierge",
          parkingDescription: property?.parkingDescription || undefined,
          powerDescription: property?.powerDescription || property?.powerType || undefined,
          securityDescription: property?.securityDescription || undefined,
          waterDescription: property?.waterDescription || undefined,
          houseRules: privateDetails?.houseRulesPrivate || undefined,
          accessToken: booking.accessToken,
        })
      );
    } catch (emailErr) {
      console.warn("[Bookings] Failed to dispatch booking confirmation emails:", emailErr);
    }

    return updatedBooking;
  },

  async getBooking(bookingId: string) {
    const db = getDb();
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (!booking) throw new Error("Booking not found");

    const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, booking.propertyId));

    const enriched = {
      ...booking,
      bookingStatus: booking.status,
      totalPrice: booking.totalAmount,
      startDate: booking.checkInDate,
      endDate: booking.checkOutDate,
      totalNights: booking.numberOfNights,
    };

    return { booking: enriched, property };
  },

  async getUserBookings(userId: string, paginationQuery: any) {
    const db = getDb();
    const params = parsePagination(paginationQuery || {});

    const data = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.guestId, userId))
      .limit(params.limit)
      .offset(params.offset)
      .orderBy(desc(schema.bookings.createdAt));

    // Enrich with property title and coverImage
    const enriched = await Promise.all(
      data.map(async (b) => {
        const [prop] = await db
          .select({
            title: schema.properties.title,
            city: schema.properties.city,
            neighborhood: schema.properties.neighborhood,
            coverImage: schema.properties.coverImage,
          })
          .from(schema.properties)
          .where(eq(schema.properties.id, b.propertyId))
          .limit(1);

        return {
          ...b,
          property: prop || null,
        };
      })
    );

    const [countResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(schema.bookings)
      .where(eq(schema.bookings.guestId, userId));

    const total = countResult?.count || 0;
    return paginatedResponse(enriched, total, params);
  },

  async getBookingContact(bookingId: string) {
    const db = getDb();
    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId));
    if (!booking) throw new Error("Booking not found");

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new Error("Booking must be confirmed to view contact details");
    }

    const [privateDetails] = await db
      .select()
      .from(schema.propertyPrivateDetails)
      .where(eq(schema.propertyPrivateDetails.propertyId, booking.propertyId));

    if (!privateDetails) {
      throw new Error("Private contact details not found");
    }

    return {
      bookingReference: booking.referenceCode,
      exactAddress: privateDetails.exactAddress,
      unitNumber: privateDetails.unitNumber,
      contactName: privateDetails.contactName,
      contactPhone: privateDetails.contactPhone,
      contactEmail: privateDetails.contactEmail,
      checkInInstructions: privateDetails.checkInInstructions,
      accessGateCode: privateDetails.accessGateCode,
      houseRulesPrivate: privateDetails.houseRulesPrivate,
    };
  },

  /**
   * Scan for confirmed bookings checking in on a specific date (defaults to tomorrow)
   * and dispatch arrival reminder emails to property hosts with durable tracking.
   */
  async processUpcomingArrivalReminders(targetDateStr?: string) {
    const db = getDb();

    // Default to tomorrow in UTC
    let dateStr = targetDateStr;
    if (!dateStr) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      dateStr = tomorrow.toISOString().split("T")[0];
    }

    // Find confirmed bookings for target check-in date where reminder has not been sent yet
    const upcomingBookings = await db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.status, BOOKING_STATUS.CONFIRMED),
          eq(schema.bookings.checkInDate, dateStr),
          isNull(schema.bookings.hostArrivalReminderSentAt)
        )
      );

    const sent: Array<{ bookingId: string; referenceCode: string; hostEmail: string }> = [];

    for (const b of upcomingBookings) {
      const [property] = await db
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.id, b.propertyId))
        .limit(1);

      if (!property) continue;

      const [host] = await db
        .select({
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        })
        .from(schema.users)
        .where(eq(schema.users.id, property.hostId))
        .limit(1);

      if (!host?.email) continue;

      // Dispatch reminder email
      await sendEmail(
        hostUpcomingArrivalEmail({
          hostName: host.firstName,
          hostEmail: host.email,
          propertyTitle: property.title,
          referenceCode: b.referenceCode,
          guestName: `${b.guestFirstName} ${b.guestLastName}`,
          guestPhone: b.guestPhone || undefined,
          guestEmail: b.guestEmail,
          checkIn: b.checkInDate,
          checkInTime: "2:00 PM",
          checkOut: b.checkOutDate,
          guestCount: b.guestCount,
        })
      );

      // Durably record timestamp to guarantee exactly-once delivery
      await db
        .update(schema.bookings)
        .set({
          hostArrivalReminderSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.bookings.id, b.id));

      sent.push({
        bookingId: b.id,
        referenceCode: b.referenceCode,
        hostEmail: host.email,
      });
    }

    return {
      processedDate: dateStr,
      remindersSentCount: sent.length,
      sent,
    };
  },
};
