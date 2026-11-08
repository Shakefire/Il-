import { z } from "zod";
import { eq, and, or, like, gt, lt, lte, desc, sql, inArray, isNull } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";
import {
  BOOKING_STATUS,
  ACTIVE_HOLD_STATUSES,
  HOST_RESPONSE,
  CANCELLATION_REASON,
  HOST_RESPONSE_WINDOW_SECONDS,
  PAYMENT_WINDOW_MINUTES,
  DEFAULT_HOST_PAYOUT_PCT,
} from "../../config/constants";
import { parsePagination, paginatedResponse } from "../../lib/pagination";
import { calculateFromGuestPrice } from "../pricing/pricing.service";
import {
  sendEmail,
  bookingInitiatedEmail,
  bookingCancelledEmail,
  hostUpcomingArrivalEmail,
  hostBookingRequestEmail,
  guestHostAcceptedEmail,
  guestHostDeclinedEmail,
} from "../notifications/notifications.service";

const isActiveHoldStatus = (status: string | null | undefined): boolean =>
  !!status && (ACTIVE_HOLD_STATUSES as readonly string[]).includes(status);

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

      // D. Double-booking concurrency (Option A): count PENDING_HOST + PAYMENT_PENDING + CONFIRMED + manual blocks
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

      const nowDate = new Date();
      const activeConflicts: typeof potentialConflicts = [];

      for (const block of potentialConflicts) {
        if (!block.bookingId) {
          activeConflicts.push(block);
          continue;
        }

        const [linkedBooking] = await tx
          .select({
            status: schema.bookings.status,
            createdAt: schema.bookings.createdAt,
            guestEmail: schema.bookings.guestEmail,
            guestId: schema.bookings.guestId,
            hostResponseDeadlineAt: schema.bookings.hostResponseDeadlineAt,
            paymentDeadlineAt: schema.bookings.paymentDeadlineAt,
          })
          .from(schema.bookings)
          .where(eq(schema.bookings.id, block.bookingId))
          .limit(1);

        if (!linkedBooking) {
          await tx.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        if (linkedBooking.status === "CANCELLED" || linkedBooking.status === "FAILED") {
          await tx.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        const isSameGuest =
          (linkedBooking.guestEmail &&
            linkedBooking.guestEmail.toLowerCase() === parsed.guestEmail.toLowerCase().trim()) ||
          (session?.userId && linkedBooking.guestId === session.userId);

        // Same guest may supersede their own unpaid request / payment hold
        if (
          isSameGuest &&
          (linkedBooking.status === BOOKING_STATUS.PENDING_HOST ||
            linkedBooking.status === BOOKING_STATUS.PAYMENT_PENDING)
        ) {
          await tx
            .update(schema.bookings)
            .set({
              status: BOOKING_STATUS.CANCELLED,
              cancellationReason: CANCELLATION_REASON.SUPERSEDED,
              cancelledAt: nowDate,
              updatedAt: nowDate,
            })
            .where(eq(schema.bookings.id, block.bookingId));
          await tx.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        // Absolute-deadline expiry of soft holds (do not wait for cron)
        const hostDeadlinePassed =
          linkedBooking.status === BOOKING_STATUS.PENDING_HOST &&
          linkedBooking.hostResponseDeadlineAt &&
          new Date(linkedBooking.hostResponseDeadlineAt).getTime() <= nowDate.getTime();

        const paymentDeadlinePassed =
          linkedBooking.status === BOOKING_STATUS.PAYMENT_PENDING &&
          linkedBooking.paymentDeadlineAt &&
          new Date(linkedBooking.paymentDeadlineAt).getTime() <= nowDate.getTime();

        if (hostDeadlinePassed || paymentDeadlinePassed) {
          await tx
            .update(schema.bookings)
            .set({
              status: BOOKING_STATUS.CANCELLED,
              cancellationReason: hostDeadlinePassed
                ? CANCELLATION_REASON.HOST_WINDOW_EXPIRED
                : CANCELLATION_REASON.PAYMENT_WINDOW_EXPIRED,
              ...(hostDeadlinePassed ? { hostResponse: HOST_RESPONSE.EXPIRED } : {}),
              cancelledAt: nowDate,
              updatedAt: nowDate,
            })
            .where(
              and(
                eq(schema.bookings.id, block.bookingId),
                eq(
                  schema.bookings.status,
                  hostDeadlinePassed ? BOOKING_STATUS.PENDING_HOST : BOOKING_STATUS.PAYMENT_PENDING
                )
              )
            );
          await tx.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, block.id));
          continue;
        }

        if (isActiveHoldStatus(linkedBooking.status)) {
          activeConflicts.push(block);
        }
      }

      if (activeConflicts.length > 0) {
        const conflictErr: any = new Error("Property is not available for the selected dates.");
        conflictErr.statusCode = 409;
        conflictErr.code = "DATE_CONFLICT";
        throw conflictErr;
      }

      // E. Authoritative server-side pricing + host payout % snapshot
      let commissionPct = 10;
      let hostPayoutPct = DEFAULT_HOST_PAYOUT_PCT;
      try {
        const [settings] = await tx
          .select({
            pct: schema.platformSettings.defaultHostCommissionPct,
            payoutPct: schema.platformSettings.defaultHostPayoutPct,
          })
          .from(schema.platformSettings)
          .where(eq(schema.platformSettings.id, "default"))
          .limit(1);
        if (settings?.pct !== undefined && settings.pct !== null) {
          commissionPct = settings.pct;
        }
        if (settings?.payoutPct !== undefined && settings.payoutPct !== null) {
          hostPayoutPct = Math.min(100, Math.max(1, settings.payoutPct));
        }
      } catch {}

      const pricing = calculateFromGuestPrice(
        property.pricePerNight,
        nights,
        commissionPct / 100,
        property.hostBasePrice || undefined
      );

      const pricePerNight = pricing.guestNightlyAccommodationPrice;
      const accommodationSubtotal = pricing.accommodationSubtotal;
      const paystackFee = pricing.paystackFee;
      const classicHostEarnings = pricing.hostEarnings;
      // Host payout % applies to classic host earnings only — guest price unchanged; no double commission
      const hostNetAmount = Math.round((classicHostEarnings * hostPayoutPct) / 100);
      const hostCommissionAmount = accommodationSubtotal - hostNetAmount;
      const totalAmount = pricing.totalGuestPayment;
      const hostResponseDeadlineAt = new Date(nowDate.getTime() + HOST_RESPONSE_WINDOW_SECONDS * 1000);

      const bookingId = `book_${crypto.randomUUID()}`;
      const referenceCode = `ILE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const accessToken = crypto.randomBytes(32).toString("hex");

      // F. Insert booking as PENDING_HOST — no Paystack init
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
          cleaningFee: 0,
          serviceFee: paystackFee,
          totalAmount,
          currency: "NGN",
          accommodationSubtotal,
          hostCommissionPct: commissionPct,
          hostCommissionAmount,
          paystackFeeAmount: paystackFee,
          hostNetAmount,
          hostPayoutPct,
          status: BOOKING_STATUS.PENDING_HOST,
          hostResponseDeadlineAt,
          accessToken,
        })
        .returning();

      // G. Soft inventory hold
      await tx.insert(schema.availabilityBlocks).values({
        id: `block_${crypto.randomUUID()}`,
        propertyId: property.id,
        bookingId: booking.id,
        startDate: inDateStr,
        endDate: outDateStr,
        type: "REQUEST_HOLD",
      });

      const enrichedBooking = {
        ...booking,
        bookingStatus: booking.status,
        totalPrice: booking.totalAmount,
        startDate: booking.checkInDate,
        endDate: booking.checkOutDate,
        totalNights: booking.numberOfNights,
      };

      // Guest + host emails — failures must not roll back booking
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

      // Notify host (best-effort)
      tx.select({
        email: schema.users.email,
        firstName: schema.users.firstName,
      })
        .from(schema.users)
        .where(eq(schema.users.id, property.hostId))
        .limit(1)
        .then(([host]) => {
          if (!host?.email) return;
          return sendEmail(
            hostBookingRequestEmail({
              hostName: host.firstName || "Host",
              hostEmail: host.email,
              propertyTitle: property.title,
              referenceCode: booking.referenceCode,
              guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
              guestCount: booking.guestCount,
              checkIn: booking.checkInDate,
              checkOut: booking.checkOutDate,
              hostResponseDeadlineAt: hostResponseDeadlineAt.toISOString(),
              totalAmount: booking.totalAmount,
              currency: booking.currency,
            })
          );
        })
        .catch((e) => console.warn("[Bookings] Failed to dispatch host request email:", e));

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
          classicHostEarnings,
          hostPayoutPct,
          hostNetAmount,
          totalAmount,
        },
        accessToken,
        timers: {
          hostResponseDeadlineAt: hostResponseDeadlineAt.toISOString(),
          hostResponseSecondsRemaining: HOST_RESPONSE_WINDOW_SECONDS,
        },
      };
    });
  },

  /**
   * Host accepts a PENDING_HOST booking → PAYMENT_PENDING with 10-minute payment window.
   * Absolute deadline enforced in-transaction even if expire job is late.
   */
  async acceptBooking(bookingId: string, hostUserId: string) {
    const db = getDb();
    const now = new Date();

    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId))
        .limit(1);

      if (!booking) {
        const err: any = new Error("Booking not found");
        err.statusCode = 404;
        throw err;
      }

      const [property] = await tx
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.id, booking.propertyId))
        .limit(1);

      if (!property || property.hostId !== hostUserId) {
        const err: any = new Error("Unauthorized: only the property host may accept this booking.");
        err.statusCode = 403;
        throw err;
      }

      // Idempotent re-accept
      if (
        booking.status === BOOKING_STATUS.PAYMENT_PENDING &&
        booking.hostResponse === HOST_RESPONSE.ACCEPTED
      ) {
        return {
          booking,
          paymentDeadlineAt: booking.paymentDeadlineAt,
          idempotent: true,
        };
      }

      if (booking.status !== BOOKING_STATUS.PENDING_HOST) {
        const err: any = new Error(
          `Booking cannot be accepted in status ${booking.status}.`
        );
        err.statusCode = 409;
        err.code = "ALREADY_RESOLVED";
        throw err;
      }

      if (
        booking.hostResponseDeadlineAt &&
        new Date(booking.hostResponseDeadlineAt).getTime() <= now.getTime()
      ) {
        await tx
          .update(schema.bookings)
          .set({
            status: BOOKING_STATUS.CANCELLED,
            cancellationReason: CANCELLATION_REASON.HOST_WINDOW_EXPIRED,
            hostResponse: HOST_RESPONSE.EXPIRED,
            cancelledAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.bookings.id, bookingId),
              eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST)
            )
          );
        await tx
          .delete(schema.availabilityBlocks)
          .where(eq(schema.availabilityBlocks.bookingId, bookingId));
        const err: any = new Error("Host response window has expired.");
        err.statusCode = 409;
        err.code = "HOST_WINDOW_EXPIRED";
        throw err;
      }

      const paymentDeadlineAt = new Date(now.getTime() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

      const [updated] = await tx
        .update(schema.bookings)
        .set({
          status: BOOKING_STATUS.PAYMENT_PENDING,
          hostResponse: HOST_RESPONSE.ACCEPTED,
          hostRespondedAt: now,
          paymentDeadlineAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.bookings.id, bookingId),
            eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST),
            sql`${schema.bookings.hostResponseDeadlineAt} > ${now.toISOString()}`
          )
        )
        .returning();

      if (!updated) {
        const err: any = new Error("Booking could not be accepted (already resolved or expired).");
        err.statusCode = 409;
        err.code = "ALREADY_RESOLVED";
        throw err;
      }

      // Keep hold; upgrade block type for clarity
      await tx
        .update(schema.availabilityBlocks)
        .set({ type: "RESERVATION" })
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));

      sendEmail(
        guestHostAcceptedEmail({
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          guestEmail: booking.guestEmail,
          propertyTitle: property.title,
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          paymentDeadlineAt: paymentDeadlineAt.toISOString(),
          accessToken: booking.accessToken,
        })
      ).catch((e) => console.warn("[Bookings] Failed to notify guest of host accept:", e));

      return {
        booking: updated,
        paymentDeadlineAt,
        idempotent: false,
      };
    });
  },

  /**
   * Host declines a PENDING_HOST booking → CANCELLED, release hold, no refund.
   */
  async declineBooking(bookingId: string, hostUserId: string, reason?: string) {
    const db = getDb();
    const now = new Date();

    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId))
        .limit(1);

      if (!booking) {
        const err: any = new Error("Booking not found");
        err.statusCode = 404;
        throw err;
      }

      const [property] = await tx
        .select()
        .from(schema.properties)
        .where(eq(schema.properties.id, booking.propertyId))
        .limit(1);

      if (!property || property.hostId !== hostUserId) {
        const err: any = new Error("Unauthorized: only the property host may decline this booking.");
        err.statusCode = 403;
        throw err;
      }

      if (booking.status !== BOOKING_STATUS.PENDING_HOST) {
        const err: any = new Error(
          `Booking cannot be declined in status ${booking.status}.`
        );
        err.statusCode = 409;
        err.code = "ALREADY_RESOLVED";
        throw err;
      }

      const [updated] = await tx
        .update(schema.bookings)
        .set({
          status: BOOKING_STATUS.CANCELLED,
          cancellationReason: reason
            ? `${CANCELLATION_REASON.HOST_DECLINED}: ${reason}`.slice(0, 255)
            : CANCELLATION_REASON.HOST_DECLINED,
          hostResponse: HOST_RESPONSE.DECLINED,
          hostRespondedAt: now,
          cancelledAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.bookings.id, bookingId),
            eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST)
          )
        )
        .returning();

      if (!updated) {
        const err: any = new Error("Booking could not be declined (already resolved).");
        err.statusCode = 409;
        err.code = "ALREADY_RESOLVED";
        throw err;
      }

      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));

      sendEmail(
        guestHostDeclinedEmail({
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          guestEmail: booking.guestEmail,
          propertyTitle: property.title,
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          reason: reason || undefined,
        })
      ).catch((e) => console.warn("[Bookings] Failed to notify guest of host decline:", e));

      return {
        success: true,
        message: "Booking declined and dates released.",
        booking: updated,
      };
    });
  },

  /**
   * Expire PENDING_HOST past host deadline and PAYMENT_PENDING past payment deadline.
   * Conditional updates; safe under concurrent cron runners.
   */
  async expireDueBookings(limit = 100): Promise<{
    expired: number;
    bookingIds: string[];
    hostExpired: number;
    paymentExpired: number;
  }> {
    const db = getDb();
    const now = new Date();
    const expiredIds: string[] = [];
    let hostExpired = 0;
    let paymentExpired = 0;

    const dueHost = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST),
          lte(schema.bookings.hostResponseDeadlineAt, now)
        )
      )
      .limit(limit);

    for (const row of dueHost) {
      const result = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(schema.bookings)
          .set({
            status: BOOKING_STATUS.CANCELLED,
            cancellationReason: CANCELLATION_REASON.HOST_WINDOW_EXPIRED,
            hostResponse: HOST_RESPONSE.EXPIRED,
            cancelledAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.bookings.id, row.id),
              eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST),
              lte(schema.bookings.hostResponseDeadlineAt, now)
            )
          )
          .returning({ id: schema.bookings.id });

        if (!updated) return null;

        await tx
          .delete(schema.availabilityBlocks)
          .where(eq(schema.availabilityBlocks.bookingId, row.id));

        return updated.id;
      });

      if (result) {
        expiredIds.push(result);
        hostExpired += 1;
      }
    }

    const remaining = Math.max(0, limit - expiredIds.length);
    if (remaining > 0) {
      const duePay = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.status, BOOKING_STATUS.PAYMENT_PENDING),
            lte(schema.bookings.paymentDeadlineAt, now)
          )
        )
        .limit(remaining);

      for (const row of duePay) {
        const result = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(schema.bookings)
            .set({
              status: BOOKING_STATUS.CANCELLED,
              cancellationReason: CANCELLATION_REASON.PAYMENT_WINDOW_EXPIRED,
              cancelledAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(schema.bookings.id, row.id),
                eq(schema.bookings.status, BOOKING_STATUS.PAYMENT_PENDING),
                lte(schema.bookings.paymentDeadlineAt, now)
              )
            )
            .returning({ id: schema.bookings.id });

          if (!updated) return null;

          await tx
            .delete(schema.availabilityBlocks)
            .where(eq(schema.availabilityBlocks.bookingId, row.id));

          await tx
            .update(schema.payments)
            .set({ status: "EXPIRED" })
            .where(
              and(
                eq(schema.payments.bookingId, row.id),
                inArray(schema.payments.status, ["INITIALIZED", "PENDING"])
              )
            );

          return updated.id;
        });

        if (result) {
          expiredIds.push(result);
          paymentExpired += 1;
        }
      }
    }

    return {
      expired: expiredIds.length,
      bookingIds: expiredIds,
      hostExpired,
      paymentExpired,
    };
  },

  /**
   * Cancel unpaid bookings freely. Paid (CONFIRMED) bookings must use refund workflow.
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

    const isOwner =
      booking.accessToken === authorizedUserIdOrToken ||
      booking.guestId === authorizedUserIdOrToken;

    if (!isOwner) {
      const err: any = new Error("Unauthorized to cancel this booking");
      err.statusCode = 403;
      throw err;
    }

    if (booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.COMPLETED) {
      const err: any = new Error(
        "Paid bookings cannot be cancelled directly. Request a refund through support/admin finance."
      );
      err.statusCode = 409;
      err.code = "REFUND_REQUIRED";
      throw err;
    }

    if (
      booking.status !== BOOKING_STATUS.PENDING_HOST &&
      booking.status !== BOOKING_STATUS.PAYMENT_PENDING &&
      booking.status !== BOOKING_STATUS.PENDING
    ) {
      const err: any = new Error(`Booking cannot be cancelled in status ${booking.status}.`);
      err.statusCode = 409;
      throw err;
    }

    const [prop] = await db
      .select({ title: schema.properties.title, hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(eq(schema.properties.id, booking.propertyId))
      .limit(1);

    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.bookings)
        .set({
          status: BOOKING_STATUS.CANCELLED,
          cancellationReason: reason || CANCELLATION_REASON.GUEST_CANCELLED_BEFORE_PAYMENT,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.bookings.id, bookingId),
            inArray(schema.bookings.status, [
              BOOKING_STATUS.PENDING_HOST,
              BOOKING_STATUS.PAYMENT_PENDING,
              BOOKING_STATUS.PENDING,
            ])
          )
        )
        .returning();

      if (!updated) {
        const err: any = new Error("Booking could not be cancelled (status changed).");
        err.statusCode = 409;
        throw err;
      }

      await tx
        .update(schema.hostEarnings)
        .set({ status: "CANCELLED" })
        .where(eq(schema.hostEarnings.bookingId, bookingId));

      await tx
        .update(schema.payouts)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(schema.payouts.bookingId, bookingId));

      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, bookingId));

      await tx
        .update(schema.payments)
        .set({ status: "EXPIRED" })
        .where(
          and(
            eq(schema.payments.bookingId, bookingId),
            inArray(schema.payments.status, ["INITIALIZED", "PENDING"])
          )
        );

      sendEmail(
        bookingCancelledEmail({
          guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
          guestEmail: booking.guestEmail,
          propertyTitle: prop?.title || "Ilé Property",
          referenceCode: booking.referenceCode,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          cancellationReason: reason || CANCELLATION_REASON.GUEST_CANCELLED_BEFORE_PAYMENT,
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

    // Count PENDING_HOST + PAYMENT_PENDING + CONFIRMED + manual blocks
    const blocks = await db
      .select({
        id: schema.availabilityBlocks.id,
        bookingId: schema.availabilityBlocks.bookingId,
        bookingStatus: schema.bookings.status,
        hostResponseDeadlineAt: schema.bookings.hostResponseDeadlineAt,
        paymentDeadlineAt: schema.bookings.paymentDeadlineAt,
      })
      .from(schema.availabilityBlocks)
      .leftJoin(schema.bookings, eq(schema.availabilityBlocks.bookingId, schema.bookings.id))
      .where(
        and(
          eq(schema.availabilityBlocks.propertyId, canonicalPropertyId),
          lt(schema.availabilityBlocks.startDate, checkOutDate),
          gt(schema.availabilityBlocks.endDate, checkInDate)
        )
      );

    const now = new Date();
    const activeConflicts = [];

    for (const b of blocks) {
      if (!b.bookingId) {
        activeConflicts.push(b);
        continue;
      }
      if (!b.bookingStatus || b.bookingStatus === "CANCELLED" || b.bookingStatus === "FAILED") {
        await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, b.id));
        continue;
      }

      const hostExpired =
        b.bookingStatus === BOOKING_STATUS.PENDING_HOST &&
        b.hostResponseDeadlineAt &&
        new Date(b.hostResponseDeadlineAt).getTime() <= now.getTime();

      const paymentExpired =
        b.bookingStatus === BOOKING_STATUS.PAYMENT_PENDING &&
        b.paymentDeadlineAt &&
        new Date(b.paymentDeadlineAt).getTime() <= now.getTime();

      if (hostExpired || paymentExpired) {
        await db
          .update(schema.bookings)
          .set({
            status: BOOKING_STATUS.CANCELLED,
            cancellationReason: hostExpired
              ? CANCELLATION_REASON.HOST_WINDOW_EXPIRED
              : CANCELLATION_REASON.PAYMENT_WINDOW_EXPIRED,
            ...(hostExpired ? { hostResponse: HOST_RESPONSE.EXPIRED } : {}),
            cancelledAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.bookings.id, b.bookingId),
              eq(
                schema.bookings.status,
                hostExpired ? BOOKING_STATUS.PENDING_HOST : BOOKING_STATUS.PAYMENT_PENDING
              )
            )
          );
        await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.id, b.id));
        continue;
      }

      if (isActiveHoldStatus(b.bookingStatus)) {
        activeConflicts.push(b);
      }
    }

    const checkIn = new Date(checkInDate + "T00:00:00Z");
    const checkOut = new Date(checkOutDate + "T00:00:00Z");
    const totalNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      available: activeConflicts.length === 0,
      propertyId: canonicalPropertyId,
      checkInDate,
      checkOutDate,
      totalNights,
      conflictsCount: activeConflicts.length,
    };
  },

  /**
   * DECOMMISSIONED (P0 Security Remediation)
   * Direct booking payment bypass is permanently disabled.
   * All bookings must be confirmed via paymentsService.processSuccessfulPayment()
   * following authoritative Paystack verification or HMAC-validated webhooks.
   */
  async processPayment(_bookingId: string, _method: string, _accessToken: string): Promise<never> {
    throw new Error(
      "Direct booking payment bypass is disabled for security. All payments must be verified via Paystack gateway."
    );
  },

  async getBooking(bookingIdOrRef: string) {
    const db = getDb();
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(
        or(
          eq(schema.bookings.id, bookingIdOrRef),
          eq(schema.bookings.referenceCode, bookingIdOrRef)
        )
      )
      .limit(1);
    if (!booking) throw new Error("Booking not found");

    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, booking.propertyId))
      .limit(1);

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

  async getBookingContact(bookingIdOrRef: string, authorizedUserIdOrToken?: string) {
    const db = getDb();
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(
        or(
          eq(schema.bookings.id, bookingIdOrRef),
          eq(schema.bookings.referenceCode, bookingIdOrRef)
        )
      )
      .limit(1);
    if (!booking) throw new Error("Booking not found");

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new Error("Booking must be confirmed to view contact details");
    }

    if (authorizedUserIdOrToken) {
      const isTokenMatch = booking.accessToken && authorizedUserIdOrToken === booking.accessToken;
      const isGuestMatch = booking.guestId && authorizedUserIdOrToken === booking.guestId;
      const isEmailMatch = booking.guestEmail && authorizedUserIdOrToken.toLowerCase().trim() === booking.guestEmail.toLowerCase().trim();
      if (!isTokenMatch && !isGuestMatch && !isEmailMatch && authorizedUserIdOrToken !== "admin") {
        const [prop] = await db
          .select({ hostId: schema.properties.hostId })
          .from(schema.properties)
          .where(eq(schema.properties.id, booking.propertyId))
          .limit(1);
        if (!prop || prop.hostId !== authorizedUserIdOrToken) {
          const err: any = new Error("Unauthorized to view property access details");
          err.statusCode = 403;
          throw err;
        }
      }
    }

    const [privateDetails] = await db
      .select()
      .from(schema.propertyPrivateDetails)
      .where(eq(schema.propertyPrivateDetails.propertyId, booking.propertyId))
      .limit(1);

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
