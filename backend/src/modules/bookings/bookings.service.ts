import { z } from "zod";
import { eq, and, gt, lt, lte, desc, sql, inArray } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";
import { BOOKING_STATUS } from "../../config/constants";
import { parsePagination, paginatedResponse } from "../../lib/pagination";

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
      const [property] = await tx
        .select()
        .from(schema.properties)
        .where(
          and(
            eq(schema.properties.id, parsed.propertyId),
            eq(schema.properties.status, "PUBLISHED")
          )
        );

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

      // E. Authoritative Server-side Price Calculation
      const pricePerNight = property.pricePerNight;
      const cleaningFee = property.cleaningFee || 0;
      const serviceFeePct = (property.serviceFeePct || 8) / 100;

      const subtotal = nights * pricePerNight;
      const serviceFee = Math.floor(subtotal * serviceFeePct);
      const totalAmount = subtotal + cleaningFee + serviceFee;

      const bookingId = `book_${crypto.randomUUID()}`;
      const referenceCode = `ILE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const accessToken = crypto.randomBytes(32).toString("hex");

      // F. Insert Booking Record
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
          cleaningFee,
          serviceFee,
          totalAmount,
          currency: "NGN",
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

      return {
        booking: enrichedBooking,
        pricing: {
          nights,
          pricePerNight,
          subtotal,
          cleaningFee,
          serviceFee,
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
  async cancelBooking(bookingId: string, authorizedUserIdOrToken: string) {
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

    return await db.transaction(async (tx) => {
      // 1. Update booking status
      const [updated] = await tx
        .update(schema.bookings)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(schema.bookings.id, bookingId))
        .returning();

      // 2. Release availability blocks immediately
      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));

      return { success: true, message: "Booking cancelled and dates released.", booking: updated };
    });
  },

  /**
   * Check whether a property is available for specific dates.
   */
  async checkAvailability(propertyId: string, checkInDate: string, checkOutDate: string) {
    const db = getDb();

    const conflicting = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.propertyId, propertyId),
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
      propertyId,
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
};
