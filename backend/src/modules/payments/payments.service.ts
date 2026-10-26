/**
 * Payments Service
 * Production integration with Paystack test environment.
 * Handles transaction initialization, webhook signature verification (HMAC SHA-512),
 * idempotent payment processing, host earnings calculation, and booking confirmation.
 */

import { env } from "../../config/env";
import { getDb, schema } from "../../db/client";
import { eq, and, or, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  sendEmail,
  bookingConfirmationEmail,
  bookingAccessPassEmail,
  hostBookingConfirmedEmail,
  bookingPaymentFailedEmail,
  bookingRefundEmail,
} from "../notifications/notifications.service";
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

  // 2. Generate unique reference for this payment transaction
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

  // 4. Initialize with Paystack if secret key is configured
  if (env.PAYSTACK_SECRET_KEY) {
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

  // Fallback for development if no key
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
}): Promise<{ success: boolean; message: string; booking?: any }> {
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

  // 3. IDEMPOTENCY CHECK: If already confirmed, exit safely without duplicating actions
  if (payment.status === "SUCCESS" && booking.status === "CONFIRMED") {
    return {
      success: true,
      message: "Payment and booking already processed successfully (idempotent).",
      booking,
    };
  }

  // 4. Validate Amount and Currency
  if (data.currency.toUpperCase() !== "NGN") {
    throw new Error(`Unexpected transaction currency: ${data.currency}. Expected NGN.`);
  }

  if (Math.abs(data.paidAmountNaira - booking.totalAmount) > 1) {
    throw new Error(
      `Payment amount mismatch! Expected ₦${booking.totalAmount}, received ₦${data.paidAmountNaira}.`
    );
  }

  let confirmedBooking = booking;

  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.id, booking.propertyId))
    .limit(1);

  // 5-7. Transaction-safe Payment Confirmation & Host Earnings Snapshot
  await db.transaction(async (tx) => {
    // 5. Update Payment Record
    await tx
      .update(schema.payments)
      .set({
        status: "SUCCESS",
        gatewayReference: data.gatewayReference || data.reference,
        method: data.method || "CARD",
        paidAt: new Date(),
        rawPayload: data.rawPayload || null,
      })
      .where(eq(schema.payments.id, payment.id));

    // 6. Confirm Booking
    const [confirmed] = await tx
      .update(schema.bookings)
      .set({
        status: "CONFIRMED",
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, booking.id))
      .returning();
    if (confirmed) confirmedBooking = confirmed;

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

      const commissionRate = (booking.hostCommissionPct || 10) / 100;
      const commissionAmount =
        booking.hostCommissionAmount && booking.hostCommissionAmount > 0
          ? booking.hostCommissionAmount
          : Math.round(accommodationSubtotal * commissionRate);

      const netAmount =
        booking.hostNetAmount && booking.hostNetAmount > 0
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

      await LedgerService.recordBookingPayment(tx, {
        bookingId: booking.id,
        paymentRef: payment.reference,
        totalAmount: booking.totalAmount,
        accommodationSubtotal,
        paystackFeeAmount,
        hostNetAmount: netAmount,
        hostId: property.hostId,
        checkInDate: booking.checkInDate,
        payoutHoldHours: 24,
      });
    }
  });

  // 8. Fetch Quarantined Details & Send Emails via Resend
  let privateDetails: any = null;
  try {
    const [fetchedPrivateDetails] = await db
      .select()
      .from(schema.propertyPrivateDetails)
      .where(eq(schema.propertyPrivateDetails.propertyId, booking.propertyId))
      .limit(1);
    privateDetails = fetchedPrivateDetails;

    const [host] = await db
      .select({
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
    const hostFullName = host
      ? `${host.firstName} ${host.lastName}`.trim()
      : privateDetails?.contactName || "Designated Ilé Stay Guide";
    const hostPhone = privateDetails?.contactPhone || host?.phone || "+234 912 202 9904";
    const exactAddress = privateDetails?.exactAddress || `${property?.neighborhood || "Maitama"}, ${property?.city || "Abuja"}`;
    const unitNumber = privateDetails?.unitNumber || undefined;
    const gateCode = privateDetails?.accessGateCode || "GATE-CLEARED";
    const city = property?.city || "Abuja";
    const state = property?.state || "FCT";
    const latitude = property?.latitude || undefined;
    const longitude = property?.longitude || undefined;

    // A. Send Booking Confirmation (property summary, reservation details, financial breakdown — NO exact address or host contact)
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
        amountPaid: data.paidAmountNaira || booking.totalAmount,
        outstandingBalance: Math.max(0, booking.totalAmount - (data.paidAmountNaira || booking.totalAmount)),
        currency: booking.currency || data.currency || "NGN",
        paymentMethod: data.method || payment.method || "CARD",
        paymentReference: payment.reference || data.reference,
        paymentStatus: "SUCCESS",
        paidAt: payment.paidAt || new Date(),
        bookingStatus: "CONFIRMED",
        accessToken: booking.accessToken,
      })
    );

    // B. Send Private Gate Clearance / Access Pass (Enriched arrival guide)
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
        accessInstructions: privateDetails?.checkInInstructions || "Present your reservation reference to estate security guards for swift clearance.",
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

    // C. Send Host Booking Confirmed Notification with Guest & Payout Breakdown
    if (host?.email) {
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

      await sendEmail(
        hostBookingConfirmedEmail({
          hostName: host.firstName || "Host",
          hostEmail: host.email,
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
        })
      );
    }
  } catch (emailErr) {
    console.warn("[Payments] Failed to dispatch booking confirmation emails:", emailErr);
  }

  return {
    success: true,
    message: "Payment verified and booking confirmed successfully.",
    booking: {
      ...confirmedBooking,
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
      privateDetails: privateDetails
        ? {
            bookingReference: confirmedBooking.referenceCode,
            exactAddress: privateDetails.exactAddress,
            unitNumber: privateDetails.unitNumber || undefined,
            contactName: privateDetails.contactName,
            contactPhone: privateDetails.contactPhone,
            contactEmail: privateDetails.contactEmail,
            checkInInstructions: privateDetails.checkInInstructions || undefined,
            accessGateCode: privateDetails.accessGateCode || undefined,
          }
        : undefined,
    },
  };
}

// ─── Process Failed Payment & Notify Guest ───

export async function processFailedPayment(data: {
  reference: string;
  reason?: string;
}): Promise<{ processed: boolean; message: string }> {
  const db = getDb();
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.reference, data.reference))
    .limit(1);

  if (!payment) return { processed: false, message: "Payment not found" };

  // Mark payment as FAILED
  await db
    .update(schema.payments)
    .set({ status: "FAILED" })
    .where(eq(schema.payments.id, payment.id));

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, payment.bookingId))
    .limit(1);

  if (booking && booking.status !== "CONFIRMED" && booking.status !== "CANCELLED") {
    // Cancel the booking and release availability blocks
    await db
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancellationReason: data.reason || "Payment was not completed.",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, booking.id));

    // Release availability blocks so dates return to live calendar
    await db
      .delete(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, booking.id));

    // Neutralize any pending host earnings & payouts
    await db
      .update(schema.hostEarnings)
      .set({ status: "CANCELLED" })
      .where(eq(schema.hostEarnings.bookingId, booking.id));

    await db
      .update(schema.payouts)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(schema.payouts.bookingId, booking.id));

    const [property] = await db
      .select({ title: schema.properties.title })
      .from(schema.properties)
      .where(eq(schema.properties.id, booking.propertyId))
      .limit(1);

    // Notify guest of payment failure
    sendEmail(
      bookingPaymentFailedEmail({
        guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
        guestEmail: booking.guestEmail,
        propertyTitle: property?.title || "Ilé Property",
        referenceCode: booking.referenceCode,
        amount: payment.amount,
        currency: payment.currency,
        reason: data.reason || "Payment authorization was unsuccessful.",
      })
    ).catch((err) => console.warn("[Payments] Failed to send payment failed email:", err));
  }

  return { processed: true, message: "Payment marked failed, booking cancelled, and dates released." };
}

// ─── Expire Stale Pending Bookings ───

export async function expireStalePendingBookings(maxAgeMinutes = 10): Promise<{
  expired: number;
  bookingIds: string[];
}> {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  // Find all PAYMENT_PENDING bookings older than the cutoff
  const staleBookings = await db
    .select({ id: schema.bookings.id, referenceCode: schema.bookings.referenceCode })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.status, "PAYMENT_PENDING"),
        sql`${schema.bookings.createdAt} < ${cutoff.toISOString()}`
      )
    );

  const expiredIds: string[] = [];

  for (const booking of staleBookings) {
    await db
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancellationReason: "Payment not completed within the time limit.",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, booking.id));

    await db
      .delete(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.bookingId, booking.id));

    // Mark related payments as expired
    await db
      .update(schema.payments)
      .set({ status: "FAILED" })
      .where(
        and(
          eq(schema.payments.bookingId, booking.id),
          eq(schema.payments.status, "INITIALIZED")
        )
      );

    expiredIds.push(booking.id);
    console.log(`[Payments] Expired stale booking: ${booking.referenceCode}`);
  }

  return { expired: expiredIds.length, bookingIds: expiredIds };
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
        await db
          .update(schema.payouts)
          .set({
            status: "FAILED",
            transferStatus: "FAILED",
            transferFailureReason: txData.reason || txData.gateway_response || "Paystack transfer failed",
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, payout.id));

        console.error(`[Payments] Paystack transfer failed for payout ${payout.id}: ${txData.reason}`);
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
          await tx
            .update(schema.payouts)
            .set({
              status: "REVERSED",
              transferStatus: "REVERSED",
              transferFailureReason: txData.reason || "Paystack transfer reversed by bank switch",
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));

          // Post reversing ledger journal: Dr Operating Bank 1020, Cr Host Settlement Payable 2020
          await LedgerService.postJournalEntry(tx, {
            reference: `REV_${payout.id}_${Date.now()}`,
            eventType: "PAYOUT_REVERSED",
            narration: `Paystack transfer reversed for payout #${payout.id} (Ref: ${transferRef})`,
            createdById: null,
            entries: [
              { accountCode: "1020", entryType: "DEBIT", amount: payout.amount },
              { accountCode: "2020", entryType: "CREDIT", amount: payout.amount },
            ],
          });
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
            status: "PROCESSED",
            processedAt: new Date(),
            paystackRefundId,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.paystackRefundId, paystackRefundId));
      }

      if (refundData.transaction?.reference) {
        const [payment] = await db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.reference, refundData.transaction.reference))
          .limit(1);

        if (payment) {
          await db
            .update(schema.bookings)
            .set({ status: "REFUNDED", updatedAt: new Date() })
            .where(eq(schema.bookings.id, payment.bookingId));

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
            status: "FAILED",
            adminNotes: `Paystack refund failed: ${refundData.gateway_response || "Unknown reason"}`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.paystackRefundId, paystackRefundId));
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
    // Development fallback
    return {
      verified: true,
      status: "success",
      reference,
      amount: 0,
      currency: "NGN",
      method: "MOCK",
      gatewayReference: `MOCK-${Date.now()}`,
      gatewayProvider: "MOCK_DEV",
      paidAt: new Date(),
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
