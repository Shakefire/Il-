/**
 * Payments Service
 * Production integration with Paystack test environment.
 * Handles transaction initialization, webhook signature verification (HMAC SHA-512),
 * idempotent payment processing, host earnings calculation, and booking confirmation.
 */

import { env } from "../../config/env";
import {
  canUsePaystackDevMocks,
  paystackNotConfiguredError,
} from "../../lib/payment-mocks";
import { getDb, schema } from "../../db/client";
import { eq, and, or, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  sendEmail,
  bookingConfirmationEmail,
  hostBookingConfirmedEmail,
  bookingPaymentFailedEmail,
  bookingRefundEmail,
  guestLatePaymentResolutionEmail,
  adminLatePaymentReconEmail,
} from "../notifications/notifications.service";
import {
  dispatchLifecycleEmail,
  LIFECYCLE_EMAIL_EVENT,
} from "../notifications/lifecycle-notify";
import { notifyUserEvent } from "../notifications/orchestrator";
import { recordBookingAudit } from "../../lib/booking-audit";
import { LedgerService } from "../finance/ledger.service";

export interface PaymentInitResult {
  success: boolean;
  reference: string;
  amount?: number;
  authorizationUrl?: string;
  accessCode?: string;
  gatewayProvider: string;
  error?: string;
}

export interface PaymentVerifyResult {
  verified: boolean;
  status?: "success" | "pending" | "failed" | "abandoned" | "unknown";
  reference: string;
  amount: number;
  currency: string;
  method: string;
  gatewayReference: string;
  gatewayProvider: string;
  paidAt: Date;
  rawPayload?: string;
  error?: string;
  booking?: any;
  reconciliationRequired?: boolean;
  bookingConfirmed?: boolean;
  resolutionPending?: boolean;
}

const notifyLatePaymentReconciliation = (params: {
  booking: any;
  propertyTitle: string;
  paidAmountNaira: number;
  currency?: string;
}): void => {
  const { booking, propertyTitle, paidAmountNaira, currency } = params;
  dispatchLifecycleEmail(
    booking.id,
    LIFECYCLE_EMAIL_EVENT.GUEST_LATE_PAYMENT_RESOLUTION,
    "guest",
    guestLatePaymentResolutionEmail({
      guestName: `${booking.guestFirstName || ""} ${booking.guestLastName || ""}`.trim() || "Guest",
      guestEmail: booking.guestEmail,
      propertyTitle,
      referenceCode: booking.referenceCode,
      amount: paidAmountNaira,
      currency: currency || booking.currency || "NGN",
    })
  );

  const adminEmail = env.EMAIL_SUPPORT || "support@ilestays.ng";
  dispatchLifecycleEmail(
    booking.id,
    LIFECYCLE_EMAIL_EVENT.ADMIN_LATE_PAYMENT_RECON,
    "admin",
    adminLatePaymentReconEmail({
      adminEmail,
      propertyTitle,
      referenceCode: booking.referenceCode,
      bookingId: booking.id,
      guestEmail: booking.guestEmail,
      amount: paidAmountNaira,
      currency: currency || booking.currency || "NGN",
    })
  );

  recordBookingAudit({
    action: "LATE_PAYMENT_RECON_REQUESTED",
    bookingId: booking.id,
    details: {
      referenceCode: booking.referenceCode,
      amount: paidAmountNaira,
      refundStatus: "REQUESTED",
      autoRefund: false,
      bookingConfirmed: false,
    },
  });
};

/** Paystack success must match this booking, guest, and amount. Missing metadata is not a mismatch. */
export function paymentAssociationProblem(
  data: { paidAmountNaira: number; currency: string; rawPayload?: string },
  booking: { id: string; totalAmount: number; guestEmail: string }
): string | null {
  if (!data.currency || data.currency.toUpperCase() !== "NGN") {
    return `currency ${data.currency || "missing"}`;
  }
  if (Math.abs(Number(data.paidAmountNaira) - Number(booking.totalAmount)) > 1) {
    return `amount ${data.paidAmountNaira} != ${booking.totalAmount}`;
  }
  if (!data.rawPayload) return null;
  try {
    const parsed = JSON.parse(data.rawPayload);
    const dataNode = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
    const meta = dataNode?.metadata || parsed?.metadata;
    const metaBookingId = meta?.bookingId || meta?.booking_id;
    if (metaBookingId && String(metaBookingId) !== booking.id) {
      return `metadata booking ${metaBookingId}`;
    }
    const email = dataNode?.customer?.email || parsed?.customer?.email;
    if (
      email &&
      String(email).toLowerCase() !== String(booking.guestEmail || "").toLowerCase()
    ) {
      return "customer email does not match booking guest";
    }
  } catch {
    return null;
  }
  return null;
}

function publicPaymentBooking(booking: any, property?: any) {
  return {
    id: booking.id,
    referenceCode: booking.referenceCode,
    status: booking.status,
    bookingStatus: booking.status,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    numberOfNights: booking.numberOfNights,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    paymentDeadlineAt: booking.paymentDeadlineAt,
    cancellationReason: booking.cancellationReason,
    guestFirstName: booking.guestFirstName,
    contactAvailable: booking.status === "CONFIRMED" || booking.status === "COMPLETED",
    property: property
      ? {
          id: property.id,
          title: property.title,
          city: property.city,
          neighborhood: property.neighborhood,
          coverImage: property.coverImage,
          slug: property.slug,
        }
      : undefined,
  };
}

// ─── Initialize Booking Payment ───

export async function initializeBookingPayment(
  bookingIdOrRef: string,
  accessToken?: string
): Promise<PaymentInitResult> {
  const db = getDb();

  // 1. Find booking
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

  if (!booking) {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "Booking record not found.",
    };
  }

  // IDOR & Access Token Authorization Check
  if (accessToken && booking.accessToken && booking.accessToken !== accessToken) {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "Unauthorized: Invalid booking access token.",
    };
  }

  if (booking.status === "CONFIRMED") {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "This booking has already been confirmed and paid.",
    };
  }

  // Phase 3: payment only after host accept, before absolute payment deadline
  if (booking.status === "PENDING_HOST") {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "Payment is not available until the host accepts this reservation.",
    };
  }

  if (booking.status !== "PAYMENT_PENDING") {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: `Payment cannot be initialized for booking status ${booking.status}.`,
    };
  }

  if (
    booking.paymentDeadlineAt &&
    new Date(booking.paymentDeadlineAt).getTime() <= Date.now()
  ) {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "Payment window has expired for this booking.",
    };
  }

  // Access token required for payment init (guest ownership)
  if (!accessToken || !booking.accessToken || booking.accessToken !== accessToken) {
    return {
      success: false,
      reference: "",
      gatewayProvider: "PAYSTACK",
      error: "Unauthorized: Valid booking access token is required to initialize payment.",
    };
  }

  // 2. Generate unique reference for this payment transaction — amount from server snapshot only
  const paymentRef = `ile_${booking.referenceCode}_${Date.now()}`;
  const amountKobo = booking.totalAmount * 100;

  // 3. Create or prepare internal payment record
  const paymentId = `pay_${crypto.randomUUID()}`;
  await db.insert(schema.payments).values({
    id: paymentId,
    bookingId: booking.id,
    reference: paymentRef,
    amount: booking.totalAmount,
    currency: "NGN",
    method: "CARD",
    status: "INITIALIZED",
    gatewayProvider: "PAYSTACK",
    createdAt: new Date(),
  });

  // 4. Initialize with Paystack if a real secret is configured.
  // Local test placeholders must not call api.paystack.co.
  const paystackKey = env.PAYSTACK_SECRET_KEY || ""
  const isLocalPlaceholderKey = paystackKey.includes("local_only_not_live")
  if (paystackKey && !isLocalPlaceholderKey) {
    try {
      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: booking.guestEmail,
          amount: amountKobo,
          reference: paymentRef,
          currency: "NGN",
          callback_url: `${env.FRONTEND_URL}/trips?payment=success&ref=${paymentRef}`,
          metadata: {
            bookingId: booking.id,
            bookingReference: booking.referenceCode,
            guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
            guestPhone: booking.guestPhone,
          },
        }),
      });

      const body = await res.json();

      if (!res.ok || !body.status) {
        console.error("[Paystack] Initialization error:", body.message);
        return {
          success: false,
          reference: paymentRef,
          gatewayProvider: "PAYSTACK",
          error: body.message || "Unable to initialize Paystack transaction.",
        };
      }

      return {
        success: true,
        reference: paymentRef,
        amount: booking.totalAmount,
        authorizationUrl: body.data.authorization_url,
        accessCode: body.data.access_code,
        gatewayProvider: "PAYSTACK",
      };
    } catch (err: any) {
      console.error("[Paystack] Network error:", err.message);
      return {
        success: false,
        reference: paymentRef,
        gatewayProvider: "PAYSTACK",
        error: "Network error connecting to payment gateway.",
      };
    }
  }

  // Dev/test only — never invent a successful Paystack session in production
  if (!canUsePaystackDevMocks()) {
    return {
      success: false,
      reference: paymentRef,
      gatewayProvider: "PAYSTACK",
      error: paystackNotConfiguredError(),
    };
  }

  return {
    success: true,
    reference: paymentRef,
    authorizationUrl: `${env.FRONTEND_URL}/trips?payment=mock&ref=${paymentRef}`,
    gatewayProvider: "MOCK_DEV",
  };
}

// ─── Verify & Process Payment (Idempotent) ───

export async function processSuccessfulPayment(data: {
  reference: string;
  gatewayReference?: string;
  paidAmountNaira: number;
  currency: string;
  method?: string;
  rawPayload?: string;
}): Promise<{
  success: boolean;
  message: string;
  booking?: any;
  bookingConfirmed?: boolean;
  reconciliationRequired?: boolean;
  resolutionPending?: boolean;
  automaticPayout?: unknown;
}> {
  const db = getDb();

  // 1. Locate payment record
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.reference, data.reference))
    .limit(1);

  if (!payment) {
    throw new Error(`Payment record with reference ${data.reference} not found.`);
  }

  // 2. Locate associated booking
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, payment.bookingId))
    .limit(1);

  if (!booking) {
    throw new Error(`Associated booking ${payment.bookingId} not found.`);
  }

  let confirmedBooking = booking;
  let latePaymentRace = false;
  let idempotentAlready = false;
  let associationMismatch = false;
  let duplicateCharge = false;

  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.id, booking.propertyId))
    .limit(1);

  // 5-7. Row-locked confirmation. A concurrent success that already confirmed
  // the stay is idempotent — it must not open a late-payment refund.
  await db.transaction(async (tx) => {
    const [lockedPayment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, payment.id))
      .limit(1)
      .for("update");

    const [lockedBooking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, booking.id))
      .limit(1)
      .for("update");

    if (!lockedPayment || !lockedBooking) {
      throw new Error("Payment or booking disappeared during confirmation.");
    }

    const association = paymentAssociationProblem(data, lockedBooking);
    const deadlinePassed =
      !!lockedBooking.paymentDeadlineAt &&
      new Date(lockedBooking.paymentDeadlineAt).getTime() <= Date.now();

    const ensureRefund = async (reason: string, notes: string) => {
      const [existingRefund] = await tx
        .select({ id: schema.refunds.id })
        .from(schema.refunds)
        .where(and(eq(schema.refunds.bookingId, lockedBooking.id), eq(schema.refunds.reason, reason)))
        .limit(1);
      if (existingRefund) return;
      const fee =
        lockedBooking.paystackFeeAmount && lockedBooking.paystackFeeAmount > 0
          ? lockedBooking.paystackFeeAmount
          : 0;
      const refundable = Math.max(0, data.paidAmountNaira - fee);
      await tx.insert(schema.refunds).values({
        id: `ref_late_${crypto.randomUUID()}`,
        bookingId: lockedBooking.id,
        guestId: lockedBooking.guestId,
        grossPaid: data.paidAmountNaira,
        nonRefundableProcessingFee: fee,
        refundableAmount: refundable,
        currency: "NGN",
        status: "REQUESTED",
        reason,
        adminNotes: notes,
      });
    };

    const markPaymentCaptured = async (note: string) => {
      await tx
        .update(schema.payments)
        .set({
          status: "SUCCESS",
          gatewayReference: data.gatewayReference || data.reference,
          method: data.method || "CARD",
          paidAt: new Date(),
          rawPayload: `${data.rawPayload || ""}\n${note}`,
        })
        .where(eq(schema.payments.id, lockedPayment.id));
    };

    if (
      lockedPayment.status === "SUCCESS" &&
      lockedBooking.status === "CONFIRMED" &&
      !association
    ) {
      idempotentAlready = true;
      confirmedBooking = lockedBooking;
      return;
    }

    if (lockedPayment.status === "SUCCESS" && lockedBooking.status !== "CONFIRMED") {
      latePaymentRace = lockedBooking.status !== "PAYMENT_PENDING" || deadlinePassed;
      associationMismatch = !!association;
      confirmedBooking = lockedBooking;
      await ensureRefund(
        association ? "PAYMENT_ASSOCIATION_MISMATCH" : "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
        "Captured payment replay. Booking was not confirmed by this call."
      );
      return;
    }

    if (association) {
      await markPaymentCaptured(`[ILE_ASSOCIATION_MISMATCH] ${association}`);
      await ensureRefund(
        "PAYMENT_ASSOCIATION_MISMATCH",
        `Paystack success did not match booking/guest/amount (${association}). Booking was not confirmed.`
      );
      associationMismatch = true;
      confirmedBooking = lockedBooking;
      return;
    }

    if (lockedBooking.status !== "PAYMENT_PENDING" || deadlinePassed) {
      if (lockedBooking.status === "CONFIRMED") {
        await markPaymentCaptured("[ILE_DUPLICATE_CHARGE_AFTER_CONFIRM]");
        await ensureRefund(
          "DUPLICATE_PAYMENT_AFTER_CONFIRM",
          "Another successful charge arrived after the booking was already CONFIRMED. Do not post earnings again."
        );
        duplicateCharge = true;
        confirmedBooking = lockedBooking;
        return;
      }

      await markPaymentCaptured(
        "[ILE_LATE_PAYMENT_RECONCILIATION] Booking was cancelled/expired; not confirmed."
      );
      if (lockedBooking.status === "PAYMENT_PENDING") {
        const [cancelled] = await tx
          .update(schema.bookings)
          .set({
            status: "CANCELLED",
            cancellationReason: "PAYMENT_WINDOW_EXPIRED",
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(eq(schema.bookings.id, lockedBooking.id), eq(schema.bookings.status, "PAYMENT_PENDING"))
          )
          .returning();
        confirmedBooking = cancelled || lockedBooking;
      } else {
        confirmedBooking = lockedBooking;
      }
      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, lockedBooking.id));
      await tx
        .update(schema.hostEarnings)
        .set({ status: "CANCELLED" })
        .where(eq(schema.hostEarnings.bookingId, lockedBooking.id));
      await tx
        .update(schema.payouts)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(schema.payouts.bookingId, lockedBooking.id));
      await ensureRefund(
        "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
        "Paystack success arrived after cancel/expire. Auto-refund not executed here. No host earnings."
      );
      latePaymentRace = true;
      return;
    }

    await tx
      .update(schema.payments)
      .set({
        status: "SUCCESS",
        gatewayReference: data.gatewayReference || data.reference,
        method: data.method || "CARD",
        paidAt: new Date(),
        rawPayload: data.rawPayload || null,
      })
      .where(eq(schema.payments.id, lockedPayment.id));

    const [confirmed] = await tx
      .update(schema.bookings)
      .set({
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.bookings.id, lockedBooking.id), eq(schema.bookings.status, "PAYMENT_PENDING"))
      )
      .returning();

    if (!confirmed) {
      const [current] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, lockedBooking.id))
        .limit(1);
      if (current?.status === "CONFIRMED") {
        idempotentAlready = true;
        confirmedBooking = current;
        return;
      }
      latePaymentRace = true;
      confirmedBooking = current || lockedBooking;
      await ensureRefund(
        "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
        "Conditional confirm matched no row and booking was not CONFIRMED. No earnings posted."
      );
      return;
    }
    confirmedBooking = confirmed;

    // Ensure availability block is active and locked for these confirmed dates
    const existingBlock = await tx
      .select({ id: schema.availabilityBlocks.id })
      .from(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.bookingId, booking.id),
          eq(schema.availabilityBlocks.propertyId, booking.propertyId)
        )
      )
      .limit(1);

    if (existingBlock.length === 0) {
      await tx
        .insert(schema.availabilityBlocks)
        .values({
          id: `blk_${crypto.randomUUID()}`,
          propertyId: booking.propertyId,
          bookingId: booking.id,
          startDate: booking.checkInDate,
          endDate: booking.checkOutDate,
          type: "RESERVATION",
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 7. Calculate Host Earnings (Idempotent check)
    const existingEarnings = await tx
      .select()
      .from(schema.hostEarnings)
      .where(eq(schema.hostEarnings.bookingId, booking.id))
      .limit(1);

    if (existingEarnings.length === 0 && property) {
      // Authoritative Accommodation-only calculation (Phase 1)
      const accommodationSubtotal =
        booking.accommodationSubtotal ||
        (booking.nightlyPrice * booking.numberOfNights) ||
        (booking.totalAmount - (booking.serviceFee || 0));

      const snapshotBalances =
        typeof booking.hostNetAmount === "number" &&
        typeof booking.hostCommissionAmount === "number" &&
        booking.hostNetAmount + booking.hostCommissionAmount === accommodationSubtotal;
      const commissionAmount = snapshotBalances
        ? booking.hostCommissionAmount || 0
        : booking.hostCommissionAmount && booking.hostCommissionAmount > 0
          ? booking.hostCommissionAmount
          : Math.max(0, accommodationSubtotal - (booking.hostNetAmount || 0));

      const netAmount = snapshotBalances
        ? booking.hostNetAmount || 0
        : booking.hostNetAmount && booking.hostNetAmount > 0
          ? booking.hostNetAmount
          : accommodationSubtotal - commissionAmount;

      await tx.insert(schema.hostEarnings).values({
        id: `earn_${crypto.randomUUID()}`,
        hostId: property.hostId,
        bookingId: booking.id,
        grossAmount: accommodationSubtotal, // Accommodation subtotal (clean fee excluded)
        commissionAmount,
        netAmount,
        status: "PENDING",
        createdAt: new Date(),
      });

      // 7b. Double-Entry Ledger Posting & Host Payout Queue (Phase 2)
      const paystackFeeAmount =
        booking.paystackFeeAmount ||
        (booking.totalAmount - accommodationSubtotal > 0 ? booking.totalAmount - accommodationSubtotal : 0);

      let payoutHoldHours = 24;
      let payoutMode: "AUTOMATIC" | "MANUAL" = "MANUAL";
      try {
        const [settings] = await tx
          .select({
            payoutHoldHours: schema.platformSettings.payoutHoldHours,
            hostPayoutMode: schema.platformSettings.hostPayoutMode,
          })
          .from(schema.platformSettings)
          .where(eq(schema.platformSettings.id, "default"))
          .limit(1);
        if (settings?.payoutHoldHours != null) payoutHoldHours = settings.payoutHoldHours;
        if (settings?.hostPayoutMode === "AUTOMATIC") payoutMode = "AUTOMATIC";
      } catch {
        // Defaults preserve MANUAL + 24h hold if settings row missing.
      }

      await LedgerService.recordBookingPayment(tx, {
        bookingId: booking.id,
        paymentRef: payment.reference,
        totalAmount: booking.totalAmount,
        accommodationSubtotal,
        paystackFeeAmount,
        hostNetAmount: netAmount,
        hostId: property.hostId,
        checkInDate: booking.checkInDate,
        payoutHoldHours,
        payoutMode,
      });
    }
  });

  if (idempotentAlready) {
    return {
      success: true,
      message: "Payment and booking already processed successfully (idempotent).",
      booking: publicPaymentBooking(confirmedBooking, property),
      bookingConfirmed: true,
      reconciliationRequired: false,
    } as any;
  }

  if (latePaymentRace || associationMismatch || duplicateCharge) {
    if (latePaymentRace || duplicateCharge) {
      notifyLatePaymentReconciliation({
        booking: confirmedBooking || booking,
        propertyTitle: property?.title || "Ilé Property",
        paidAmountNaira: data.paidAmountNaira,
        currency: data.currency || booking.currency,
      });
    } else {
      recordBookingAudit({
        action: "PAYMENT_ASSOCIATION_MISMATCH",
        bookingId: booking.id,
        details: {
          reference: data.reference,
          amount: data.paidAmountNaira,
          bookingConfirmed: false,
        },
      });
    }
    const stayConfirmed = duplicateCharge || confirmedBooking?.status === "CONFIRMED";
    return {
      success: true,
      message: associationMismatch
        ? "Payment did not match this booking, guest, or amount. The stay was not confirmed."
        : duplicateCharge
          ? "Additional charge recorded after the stay was already confirmed. Queued for reconciliation. Booking was not changed."
          : "Payment recorded but booking was no longer payable. Flagged for admin reconciliation/refund. Booking was NOT confirmed and no host earnings were created.",
      booking: publicPaymentBooking(confirmedBooking || booking, property),
      reconciliationRequired: true,
      bookingConfirmed: stayConfirmed,
      resolutionPending: true,
    } as any;
  }

  // 8. Confirmation emails (stay confirmed independently of any pass product)
  try {
    const [host] = await db
      .select({
        id: schema.users.id,
        phone: schema.users.phone,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(eq(schema.users.id, property?.hostId || ""))
      .limit(1);

    const propTitle = property?.title || "Shortlet Stay";
    const guestName = `${booking.guestFirstName || ""} ${booking.guestLastName || ""}`.trim() || "Valued Guest";
    const city = property?.city || "Abuja";
    const state = property?.state || "FCT";

    // A. Confirmation — NO exact address/host contact (CONFIRMED only)
    dispatchLifecycleEmail(
      booking.id,
      LIFECYCLE_EMAIL_EVENT.GUEST_PAYMENT_CONFIRMED,
      "guest",
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
        amountPaid: data.paidAmountNaira || booking.totalAmount,
        outstandingBalance: Math.max(0, booking.totalAmount - (data.paidAmountNaira || booking.totalAmount)),
        currency: booking.currency || data.currency || "NGN",
        paymentMethod: data.method || payment.method || "CARD",
        paymentReference: payment.reference || data.reference,
        paymentStatus: "SUCCESS",
        paidAt: payment.paidAt || new Date(),
        bookingStatus: "CONFIRMED",
        accessToken: booking.accessToken,
      }),
      {
        userId: booking.guestId,
        phone: booking.guestPhone,
        inboxTitle: "Payment confirmed — stay booked!",
        inboxBody: `Your stay at ${propTitle} (${booking.referenceCode}) is confirmed. Check-in on ${booking.checkInDate}.`,
        deepLink: `/trips`,
        smsMessage: booking.guestPhone
          ? `Ilé: Payment confirmed for ${booking.referenceCode} at ${propTitle}. Your stay is confirmed!`
          : undefined,
      }
    );

    // Confirmation email above is sufficient for a paid stay.

    // B. Host confirmed notification
    if (host) {
      const gross =
        booking.accommodationSubtotal ||
        (booking.nightlyPrice * booking.numberOfNights) ||
        (booking.totalAmount - (booking.serviceFee || 0));
      const commissionRate = (booking.hostCommissionPct || 10) / 100;
      const commission =
        booking.hostCommissionAmount && booking.hostCommissionAmount > 0
          ? booking.hostCommissionAmount
          : Math.round(gross * commissionRate);
      const net =
        booking.hostNetAmount && booking.hostNetAmount > 0
          ? booking.hostNetAmount
          : gross - commission;

      dispatchLifecycleEmail(
        booking.id,
        LIFECYCLE_EMAIL_EVENT.HOST_BOOKING_CONFIRMED,
        "host",
        hostBookingConfirmedEmail({
          hostName: host.firstName || "Host",
          hostEmail: host.email || "",
          propertyTitle: propTitle,
          referenceCode: booking.referenceCode,
          guestName,
          guestPhone: booking.guestPhone || undefined,
          guestEmail: booking.guestEmail,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          numberOfNights: booking.numberOfNights,
          guestCount: booking.guestCount || 1,
          grossAmount: gross,
          commissionAmount: commission,
          netPayout: net,
          currency: booking.currency || "NGN",
        }),
        {
          userId: host.id,
          phone: host.phone,
          inboxTitle: "Reservation confirmed & paid",
          inboxBody: `${guestName} confirmed payment for ${propTitle} (${booking.referenceCode}). Net payout: ₦${net.toLocaleString()}.`,
          deepLink: `/host/dashboard`,
          smsMessage: host.phone
            ? `Ilé: Confirmed booking ${booking.referenceCode} for ${propTitle} by ${guestName}. Payout: ₦${net.toLocaleString()}.`
            : undefined,
        }
      );
    }

    recordBookingAudit({
      action: "PAYMENT_CONFIRMED",
      bookingId: booking.id,
      userId: booking.guestId || null,
      details: {
        referenceCode: booking.referenceCode,
        paymentReference: payment.reference || data.reference,
        amount: data.paidAmountNaira || booking.totalAmount,
      },
    });
  } catch (emailErr) {
    console.warn("[Payments] Failed to dispatch booking confirmation emails:", emailErr);
  }

  // AUTOMATIC host payout: after backend-verified payment only (not callback alone).
  // MANUAL mode is a no-op here — settlement gates remain check-in based.
  let automaticPayout: any = null;
  try {
    const { FinanceService } = await import("../finance/finance.service");
    automaticPayout = await FinanceService.handlePostPaymentPayout(booking.id);
  } catch (autoErr: any) {
    console.error(
      `[Payments] Post-payment payout handler failed for booking ${booking.id}:`,
      autoErr?.message || autoErr
    );
    automaticPayout = {
      mode: "UNKNOWN",
      attempted: false,
      error: autoErr?.message || "automatic_payout_handler_failed",
    };
  }

  return {
    success: true,
    message: "Payment verified and booking confirmed successfully.",
    automaticPayout,
    bookingConfirmed: true,
    reconciliationRequired: false,
    booking: publicPaymentBooking(confirmedBooking, property),
  };
}

// ─── Process Failed Payment & Notify Guest ───

export async function processFailedPayment(data: {
  reference: string;
  reason?: string;
  outcome?: "failed" | "abandoned";
}): Promise<{ processed: boolean; message: string; bookingStatus?: string }> {
  const db = getDb();
  const outcome = data.outcome === "abandoned" ? "ABANDONED" : "FAILED";

  return await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.reference, data.reference))
      .limit(1)
      .for("update");

    if (!payment) return { processed: false, message: "Payment not found" };

    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, payment.bookingId))
      .limit(1)
      .for("update");

    // A captured or confirmed stay must not be cancelled by a later failed/abandoned event.
    if (payment.status === "SUCCESS" || booking?.status === "CONFIRMED" || booking?.status === "COMPLETED") {
      return {
        processed: true,
        message: "Ignored failed/abandoned event because payment or booking is already successful.",
        bookingStatus: booking?.status,
      };
    }

    if (payment.status !== "SUCCESS") {
      await tx
        .update(schema.payments)
        .set({
          status: outcome,
          rawPayload: data.reason || null,
        })
        .where(eq(schema.payments.id, payment.id));
    }

    // Leave PAYMENT_PENDING inventory in place until the payment deadline.
    // The guest may retry inside the window. Expiry releases the hold.
    if (booking && booking.guestId && booking.status !== "CANCELLED") {
      const [property] = await tx
        .select({ title: schema.properties.title })
        .from(schema.properties)
        .where(eq(schema.properties.id, booking.propertyId))
        .limit(1);

      const reason = data.reason || (outcome === "ABANDONED" ? "Payment was abandoned." : "Payment authorization was unsuccessful.");
      const emailPayload = bookingPaymentFailedEmail({
        guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
        guestEmail: booking.guestEmail,
        propertyTitle: property?.title || "Ilé Property",
        referenceCode: booking.referenceCode,
        amount: payment.amount,
        currency: payment.currency,
        reason,
      });

      notifyUserEvent({
        userId: booking.guestId,
        event: "GUEST_PAYMENT_FAILED",
        entityType: "booking",
        entityId: booking.id,
        category: "payment",
        channels: {
          category: "payment",
          email: emailPayload,
          inbox: {
            userId: booking.guestId,
            title: outcome === "ABANDONED" ? "Payment not finished" : "Payment unsuccessful",
            body: `Payment for ${property?.title || "your stay"} (${booking.referenceCode}) was not completed. You can retry until the payment deadline.`,
            deepLink: `/trips`,
          },
          sms: booking.guestPhone
            ? {
                to: booking.guestPhone,
                message: `Ilé: Payment for ${booking.referenceCode} was not completed. You can retry in the app until the deadline.`,
              }
            : undefined,
          push: true,
        },
      });
    }

    return {
      processed: true,
      message:
        "Payment attempt recorded as " +
        outcome +
        ". Booking status and inventory were not changed by this failure.",
      bookingStatus: booking?.status,
    };
  });
}

// ─── Expire Due Host/Payment Windows (absolute deadlines) ───

export async function expireStalePendingBookings(_maxAgeMinutes = 10): Promise<{
  expired: number;
  bookingIds: string[];
  hostExpired?: number;
  paymentExpired?: number;
}> {
  // Phase 3: absolute host_response_deadline_at / payment_deadline_at (ignores legacy age minutes)
  const { bookingsService } = await import("../bookings/bookings.service");
  const result = await bookingsService.expireDueBookings(200);
  console.log(
    `[Payments] Expired due bookings: host=${result.hostExpired} payment=${result.paymentExpired}`
  );
  return result;
}

/**
 * Late Paystack success after cancel/expire:
 * record payment, create REQUESTED refund for admin recon, no booking revive, no host earnings.
 */
async function recordLatePaymentForReconciliation(params: {
  payment: any;
  booking: any;
  data: {
    reference: string;
    gatewayReference?: string;
    paidAmountNaira: number;
    currency: string;
    method?: string;
    rawPayload?: string;
  };
}): Promise<{
  success: boolean;
  message: string;
  booking?: any;
  bookingConfirmed?: boolean;
  reconciliationRequired?: boolean;
  resolutionPending?: boolean;
}> {
  const { payment, booking, data } = params;
  const db = getDb();

  if (payment.status === "SUCCESS") {
    const [existingRefund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, booking.id))
      .limit(1);
    return {
      success: true,
      message: existingRefund
        ? "Late payment already recorded and queued for reconciliation (idempotent)."
        : "Late payment already recorded; ensure refund reconciliation exists.",
      booking,
      reconciliationRequired: true,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payments)
      .set({
        status: "SUCCESS",
        gatewayReference: data.gatewayReference || data.reference,
        method: data.method || "CARD",
        paidAt: new Date(),
        rawPayload:
          (data.rawPayload || "") +
          "\n[ILE_LATE_PAYMENT_RECONCILIATION] Booking was cancelled/expired; not confirmed.",
      })
      .where(eq(schema.payments.id, payment.id));

    // Ensure booking stays cancelled (do not revive)
    if (booking.status === "PAYMENT_PENDING") {
      await tx
        .update(schema.bookings)
        .set({
          status: "CANCELLED",
          cancellationReason: "PAYMENT_WINDOW_EXPIRED",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "PAYMENT_PENDING")));
    }

    await tx
      .delete(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, booking.id));

    // Never create host earnings / payouts for late payments
    await tx
      .update(schema.hostEarnings)
      .set({ status: "CANCELLED" })
      .where(eq(schema.hostEarnings.bookingId, booking.id));
    await tx
      .update(schema.payouts)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(schema.payouts.bookingId, booking.id));

    const [existingRefund] = await tx
      .select({ id: schema.refunds.id })
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, booking.id))
      .limit(1);

    if (!existingRefund) {
      const fee =
        booking.paystackFeeAmount && booking.paystackFeeAmount > 0
          ? booking.paystackFeeAmount
          : 0;
      const refundable = Math.max(0, data.paidAmountNaira - fee);
      await tx.insert(schema.refunds).values({
        id: `ref_late_${crypto.randomUUID()}`,
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid: data.paidAmountNaira,
        nonRefundableProcessingFee: fee,
        refundableAmount: refundable,
        currency: data.currency?.toUpperCase() || "NGN",
        status: "REQUESTED",
        reason: "LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE",
        adminNotes:
          "Paystack success arrived after cancel/expire. Auto-refund not executed here for safety. Admin finance must reconcile and refund. No host earnings/payout eligibility.",
      });
    }
  });

  const [property] = await db
    .select({ title: schema.properties.title })
    .from(schema.properties)
    .where(eq(schema.properties.id, booking.propertyId))
    .limit(1);

  notifyLatePaymentReconciliation({
    booking,
    propertyTitle: property?.title || "Ilé Property",
    paidAmountNaira: data.paidAmountNaira,
    currency: data.currency || booking.currency,
  });

  return {
    success: true,
    message:
      "Late payment recorded and flagged for admin reconciliation/refund. Booking was NOT confirmed.",
    booking,
    reconciliationRequired: true,
    bookingConfirmed: false,
    resolutionPending: true,
  };
}

// ─── Paystack Webhook Handler ───

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;

  const expectedSignature = crypto
    .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function handlePaystackWebhook(
  rawBody: string,
  signature: string
): Promise<{ processed: boolean; message: string }> {
  // 1. Verify HMAC SHA-512 signature using constant-time comparison
  const isValid = verifyPaystackWebhookSignature(rawBody, signature);
  if (!isValid) {
    throw new Error("Invalid Paystack webhook signature.");
  }

  const event = JSON.parse(rawBody);
  const db = getDb();

  // 2. Extract durable event identifier
  const rawEventId =
    event.id != null
      ? String(event.id)
      : event.data?.id != null
      ? String(event.data.id)
      : event.data?.reference
      ? `${event.event}_${event.data.reference}`
      : `${event.event}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const eventType = event.event || "unknown";

  // 3. Idempotency Check: Guard against duplicate delivery
  const [existingEvent] = await db
    .select()
    .from(schema.webhookEvents)
    .where(
      and(
        eq(schema.webhookEvents.eventId, rawEventId),
        eq(schema.webhookEvents.gatewayProvider, "PAYSTACK")
      )
    )
    .limit(1);

  if (existingEvent && existingEvent.status === "PROCESSED") {
    console.info(`[Paystack Webhook] Duplicate event ignored (already PROCESSED): ${rawEventId}`);
    return {
      processed: true,
      message: `Webhook event ${rawEventId} already processed (idempotent).`,
    };
  }

  // 4. Record event receipt in durable webhook audit store
  const webhookRecordId = existingEvent?.id || `wevt_${crypto.randomUUID()}`;
  if (!existingEvent) {
    try {
      await db.insert(schema.webhookEvents).values({
        id: webhookRecordId,
        eventId: rawEventId,
        eventType,
        gatewayProvider: "PAYSTACK",
        payload: rawBody,
        signature,
        status: "RECEIVED",
        attempts: 1,
        createdAt: new Date(),
      });
    } catch (insertErr: any) {
      const duplicate =
        insertErr?.code === "23505" || String(insertErr?.message || "").toLowerCase().includes("duplicate");
      if (!duplicate) throw insertErr;
      const [raced] = await db
        .select()
        .from(schema.webhookEvents)
        .where(
          and(
            eq(schema.webhookEvents.eventId, rawEventId),
            eq(schema.webhookEvents.gatewayProvider, "PAYSTACK")
          )
        )
        .limit(1);
      if (raced?.status === "PROCESSED") {
        return {
          processed: true,
          message: `Webhook event ${rawEventId} already processed (idempotent).`,
        };
      }
    }
  } else {
    await db
      .update(schema.webhookEvents)
      .set({ attempts: (existingEvent.attempts || 1) + 1 })
      .where(eq(schema.webhookEvents.id, webhookRecordId));
  }

  try {
    // ─── 5A. Handle 'charge.success' ───
    if (eventType === "charge.success") {
      const tx = event.data;
      const reference = tx.reference;
      const paidAmountNaira = Math.round(tx.amount / 100); // kobo -> naira
      const currency = tx.currency;
      const gatewayReference = String(tx.id);

      await processSuccessfulPayment({
        reference,
        gatewayReference,
        paidAmountNaira,
        currency,
        method: tx.channel === "card" ? "CARD" : "TRANSFER",
        rawPayload: JSON.stringify(event),
      });

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook charge.success processed successfully." };
    }

    // ─── 5B. Handle 'charge.failed' ───
    if (eventType === "charge.failed") {
      const tx = event.data;
      await processFailedPayment({
        reference: tx.reference,
        reason: tx.gateway_response || "Payment declined by financial institution.",
      });

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook charge.failed processed." };
    }

    // ─── 5C. Handle 'transfer.success' ───
    if (eventType === "transfer.success") {
      const txData = event.data;
      const transferRef = txData.reference;
      const transferCode = txData.transfer_code;

      const [payout] = await db
        .select()
        .from(schema.payouts)
        .where(
          or(
            eq(schema.payouts.paystackTransferRef, transferRef),
            eq(schema.payouts.paystackTransferCode, transferCode)
          )
        )
        .limit(1);

      if (payout) {
        if (payout.status !== "PAID") {
          await db.transaction(async (tx) => {
            const existingJournal = await tx
              .select({ id: schema.ledgerJournals.id })
              .from(schema.ledgerJournals)
              .where(
                and(
                  eq(schema.ledgerJournals.reference, payout.id),
                  eq(schema.ledgerJournals.eventType, "HOST_PAYOUT_DISBURSED")
                )
              )
              .limit(1);

            if (existingJournal.length === 0) {
              await LedgerService.recordHostPayout(tx, {
                payoutId: payout.id,
                bookingId: payout.bookingId,
                hostId: payout.hostId,
                amount: payout.amount,
                adminId: payout.approvedBy || undefined,
                transferRef,
                receiptUrl: payout.receiptUrl,
                notes: payout.notes,
              });
            }

            await tx
              .update(schema.payouts)
              .set({
                status: "PAID",
                transferStatus: "SUCCESS",
                disbursedAt: new Date(txData.transferred_at || Date.now()),
                paystackTransferCode: transferCode || payout.paystackTransferCode,
                paystackTransferRef: transferRef || payout.paystackTransferRef,
                updatedAt: new Date(),
              })
              .where(eq(schema.payouts.id, payout.id));
          });

          // Send host payout notification email
          import("../notifications/notifications.service").then(async ({ sendEmail, hostPayoutDisbursedEmail }) => {
            const [host] = await getDb()
              .select({ email: schema.users.email, firstName: schema.users.firstName, lastName: schema.users.lastName })
              .from(schema.users)
              .where(eq(schema.users.id, payout.hostId))
              .limit(1);

            if (host) {
              const masked = payout.accountNumber ? `******${payout.accountNumber.slice(-4)}` : undefined;
              sendEmail(
                hostPayoutDisbursedEmail({
                  hostName: `${host.firstName} ${host.lastName}`.trim(),
                  hostEmail: host.email,
                  amount: payout.amount,
                  bankName: payout.bankName || undefined,
                  accountNumberMasked: masked,
                  transferRef: transferRef || undefined,
                  currency: payout.currency || "NGN",
                })
              ).catch((e) => console.warn("[Payments] Failed to send host payout email:", e));
            }
          });
        }
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook transfer.success handled successfully." };
    }

    // ─── 5D. Handle 'transfer.failed' ───
    if (eventType === "transfer.failed") {
      const txData = event.data;
      const transferRef = txData.reference;
      const transferCode = txData.transfer_code;

      const [payout] = await db
        .select()
        .from(schema.payouts)
        .where(
          or(
            eq(schema.payouts.paystackTransferRef, transferRef),
            eq(schema.payouts.paystackTransferCode, transferCode)
          )
        )
        .limit(1);

      if (payout) {
        // Verified failure: restore READY_FOR_PAYOUT so funds remain withdrawable.
        // Do NOT invent a FAILED payout status for the wallet projection.
        // Uncertain/pending transfers stay PROCESSING (handled elsewhere).
        const restoreStatus =
          payout.status === "PROCESSING" || payout.status === "READY_FOR_PAYOUT"
            ? "READY_FOR_PAYOUT"
            : payout.status === "PAID"
              ? "PAID"
              : "READY_FOR_PAYOUT";

        await db
          .update(schema.payouts)
          .set({
            status: restoreStatus === "PAID" ? "PAID" : "READY_FOR_PAYOUT",
            transferStatus: "FAILED",
            transferFailureReason: txData.reason || txData.gateway_response || "Paystack transfer failed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.payouts.id, payout.id),
              // Never demote an already-PAID row from a late/duplicate fail webhook
              sql`${schema.payouts.status} <> 'PAID'`
            )
          );

        console.error(`[Payments] Paystack transfer failed for payout ${payout.id}: ${txData.reason}. Restored to READY_FOR_PAYOUT when applicable.`);
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook transfer.failed handled." };
    }

    // ─── 5E. Handle 'transfer.reversed' ───
    if (eventType === "transfer.reversed") {
      const txData = event.data;
      const transferRef = txData.reference;
      const transferCode = txData.transfer_code;

      const [payout] = await db
        .select()
        .from(schema.payouts)
        .where(
          or(
            eq(schema.payouts.paystackTransferRef, transferRef),
            eq(schema.payouts.paystackTransferCode, transferCode)
          )
        )
        .limit(1);

      if (payout) {
        await db.transaction(async (tx) => {
          const reversalRef = `payout:${payout.id}:reversal`;
          const [existingReversal] = await tx
            .select({ id: schema.ledgerJournals.id })
            .from(schema.ledgerJournals)
            .where(
              and(
                eq(schema.ledgerJournals.reference, reversalRef),
                eq(schema.ledgerJournals.eventType, "PAYOUT_REVERSED")
              )
            )
            .limit(1);
          if (!existingReversal && payout.status === "PAID") {
            await LedgerService.postJournalEntry(tx, {
              reference: reversalRef,
              eventType: "PAYOUT_REVERSED",
              narration: `Paystack transfer reversed for payout #${payout.id} (Ref: ${transferRef}). Funds returned to host payable.`,
              createdById: null,
              entries: [
                { accountCode: "1020", entryType: "DEBIT", amount: payout.amount },
                { accountCode: "2020", entryType: "CREDIT", amount: payout.amount },
              ],
            });
          }
          await tx
            .update(schema.payouts)
            .set({
              status: "READY_FOR_PAYOUT",
              transferStatus: "REVERSED",
              transferFailureReason: txData.reason || "Paystack transfer reversed by bank switch",
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));
        });

        console.warn(`[Payments] Payout ${payout.id} transfer reversed. Ledger adjusted.`);
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook transfer.reversed handled and ledger reversed." };
    }

    // ─── 5F. Handle 'refund.processed' ───
    if (eventType === "refund.processed") {
      const refundData = event.data;
      const paystackRefundId = String(refundData.id || "");

      if (paystackRefundId) {
        await db
          .update(schema.refunds)
          .set({
            paystackRefundId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.refunds.paystackRefundId, paystackRefundId),
              sql`${schema.refunds.status} IN ('PENDING', 'RECONCILIATION_REQUIRED')`
            )
          );
      }

      if (refundData.transaction?.reference) {
        const [payment] = await db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.reference, refundData.transaction.reference))
          .limit(1);

        if (payment) {
          const [booking] = await db
            .select()
            .from(schema.bookings)
            .where(eq(schema.bookings.id, payment.bookingId))
            .limit(1);

          if (booking) {
            const [property] = await db
              .select({ title: schema.properties.title })
              .from(schema.properties)
              .where(eq(schema.properties.id, booking.propertyId))
              .limit(1);

            const refundAmountNaira = Math.round((refundData.amount || 0) / 100);
            sendEmail(
              bookingRefundEmail({
                guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
                guestEmail: booking.guestEmail,
                propertyTitle: property?.title || "Property",
                referenceCode: booking.referenceCode,
                refundAmount: refundAmountNaira,
                currency: "NGN",
                status: "PROCESSED",
              })
            ).catch((e) => console.warn("[Payments] Failed to send refund confirmation email:", e));
          }
        }
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook refund.processed handled." };
    }

    // ─── 5G. Handle 'refund.failed' ───
    if (eventType === "refund.failed") {
      const refundData = event.data;
      const paystackRefundId = String(refundData.id || "");

      if (paystackRefundId) {
        await db
          .update(schema.refunds)
          .set({
            status: "RECONCILIATION_REQUIRED",
            adminNotes: `Paystack refund failed webhook: ${refundData.gateway_response || "Unknown reason"}. Reservation was not auto-released.`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.refunds.paystackRefundId, paystackRefundId),
              eq(schema.refunds.status, "PENDING")
            )
          );
      }

      await db
        .update(schema.webhookEvents)
        .set({ status: "PROCESSED", processedAt: new Date() })
        .where(eq(schema.webhookEvents.id, webhookRecordId));

      return { processed: true, message: "Webhook refund.failed handled." };
    }

    // Unhandled event
    await db
      .update(schema.webhookEvents)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, webhookRecordId));

    return { processed: false, message: `Ignored unhandled event: ${eventType}` };
  } catch (err: any) {
    console.error(`[Paystack Webhook] Processing failed for event ${rawEventId}:`, err.message);
    await db
      .update(schema.webhookEvents)
      .set({ status: "FAILED", processingError: err.message })
      .where(eq(schema.webhookEvents.id, webhookRecordId));

    throw err;
  }
}

// ─── Verify Paystack Transaction via API ───

export async function verifyPayment(reference: string): Promise<PaymentVerifyResult> {
  if (!env.PAYSTACK_SECRET_KEY) {
    if (!canUsePaystackDevMocks()) {
      return {
        verified: false,
        status: "failed",
        reference,
        amount: 0,
        currency: "NGN",
        method: "UNKNOWN",
        gatewayReference: "",
        gatewayProvider: "PAYSTACK",
        paidAt: new Date(),
        error: paystackNotConfiguredError(),
      };
    }
    // Dev/test only: still settle through the same booking lock. Never report
    // verified=true without a stored payment row.
    const db = getDb();
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.reference, reference))
      .limit(1);
    if (!payment) {
      return {
        verified: false,
        status: "unknown",
        reference,
        amount: 0,
        currency: "NGN",
        method: "MOCK",
        gatewayReference: "",
        gatewayProvider: "MOCK_DEV",
        paidAt: new Date(),
        error: "No payment record for this reference.",
      };
    }
    const [bookingRow] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, payment.bookingId))
      .limit(1);
    const processResult = await processSuccessfulPayment({
      reference,
      gatewayReference: `MOCK-${payment.id}`,
      paidAmountNaira: payment.amount,
      currency: payment.currency || "NGN",
      method: "MOCK",
      rawPayload: JSON.stringify({
        mock: true,
        data: {
          metadata: { bookingId: payment.bookingId },
          customer: { email: bookingRow?.guestEmail },
        },
      }),
    });
    const reconciliationRequired = !!(processResult as any).reconciliationRequired;
    return {
      verified: true,
      status: "success",
      reference,
      amount: payment.amount,
      currency: payment.currency || "NGN",
      method: "MOCK",
      gatewayReference: `MOCK-${payment.id}`,
      gatewayProvider: "MOCK_DEV",
      paidAt: new Date(),
      booking: processResult.booking,
      reconciliationRequired,
      bookingConfirmed: (processResult as any).bookingConfirmed === true,
      resolutionPending: reconciliationRequired,
    };
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const body = await res.json().catch(() => ({}));

    if (!res.ok || !body.status || !body.data) {
      return {
        verified: false,
        status: "unknown",
        reference,
        amount: 0,
        currency: "NGN",
        method: "UNKNOWN",
        gatewayReference: "",
        gatewayProvider: "PAYSTACK",
        paidAt: new Date(),
        error: body.message || "Failed to reach Paystack verification gateway.",
      };
    }

    const tx = body.data;
    if (tx.status !== "success") {
      let mappedStatus: PaymentVerifyResult["status"] = "pending";
      if (tx.status === "failed") mappedStatus = "failed";
      else if (tx.status === "abandoned") mappedStatus = "abandoned";

      return {
        verified: false,
        status: mappedStatus,
        reference,
        amount: Math.round((tx.amount || 0) / 100),
        currency: tx.currency || "NGN",
        method: tx.channel === "card" ? "CARD" : "TRANSFER",
        gatewayReference: String(tx.id || ""),
        gatewayProvider: "PAYSTACK",
        paidAt: new Date(),
        error: tx.gateway_response || `Transaction status on Paystack is ${tx.status}.`,
      };
    }

    const amountNaira = Math.round(tx.amount / 100);

    // Process & confirm in database
    const processResult = await processSuccessfulPayment({
      reference,
      gatewayReference: String(tx.id),
      paidAmountNaira: amountNaira,
      currency: tx.currency,
      method: tx.channel === "card" ? "CARD" : "TRANSFER",
      rawPayload: JSON.stringify(body),
    });

    const reconciliationRequired = !!(processResult as any).reconciliationRequired;
    return {
      verified: true,
      status: "success",
      reference,
      amount: amountNaira,
      currency: tx.currency,
      method: tx.channel === "card" ? "CARD" : "TRANSFER",
      gatewayReference: String(tx.id),
      gatewayProvider: "PAYSTACK",
      paidAt: new Date(tx.paid_at),
      rawPayload: JSON.stringify(body),
      booking: processResult.booking,
      reconciliationRequired,
      bookingConfirmed: (processResult as any).bookingConfirmed === true,
      resolutionPending: reconciliationRequired,
    };
  } catch (err: any) {
    console.error("[Paystack] Verify error:", err);
    return {
      verified: false,
      status: "unknown",
      reference,
      amount: 0,
      currency: "NGN",
      method: "UNKNOWN",
      gatewayReference: "",
      gatewayProvider: "PAYSTACK",
      paidAt: new Date(),
      error: err.message || "Failed to verify transaction.",
    };
  }
}

// ─── Health check probe ───

export async function testPaystackConnectivity(): Promise<{
  connected: boolean;
  mode: string;
  error?: string;
}> {
  if (!env.PAYSTACK_SECRET_KEY) {
    return { connected: false, mode: "NOT_CONFIGURED", error: "PAYSTACK_SECRET_KEY not set" };
  }

  try {
    // Ping Paystack API balance / transaction endpoint
    const res = await fetch("https://api.paystack.co/integration/payment_session_timeout", {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });

    if (res.ok) {
      const isTest = env.PAYSTACK_SECRET_KEY.startsWith("sk_test_");
      return { connected: true, mode: isTest ? "TEST_MODE" : "LIVE_MODE" };
    }

    return { connected: false, mode: "UNKNOWN", error: `Paystack HTTP ${res.status}` };
  } catch (err: any) {
    return { connected: false, mode: "ERROR", error: err.message || "Network error" };
  }
}
