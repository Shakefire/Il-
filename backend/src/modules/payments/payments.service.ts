/**
 * Payments Service
 * Production integration with Paystack test environment.
 * Handles transaction initialization, webhook signature verification (HMAC SHA-512),
 * idempotent payment processing, host earnings calculation, and booking confirmation.
 */

import { env } from "../../config/env";
import { getDb, schema } from "../../db/client";
import { eq, and, or } from "drizzle-orm";
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
  bookingIdOrRef: string
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
      const commission =
        booking.hostCommissionAmount && booking.hostCommissionAmount > 0
          ? booking.hostCommissionAmount
          : Math.round(gross * 0.1);
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

  await db
    .update(schema.payments)
    .set({ status: "FAILED" })
    .where(eq(schema.payments.id, payment.id));

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

  return { processed: true, message: "Payment marked failed and guest notified." };
}

// ─── Paystack Webhook Handler ───

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!env.PAYSTACK_SECRET_KEY) return false;

  const expectedSignature = crypto
    .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
}

export async function handlePaystackWebhook(
  rawBody: string,
  signature: string
): Promise<{ processed: boolean; message: string }> {
  // 1. Verify HMAC SHA-512 signature
  const isValid = verifyPaystackWebhookSignature(rawBody, signature);
  if (!isValid) {
    throw new Error("Invalid Paystack webhook signature.");
  }

  const event = JSON.parse(rawBody);

  // 2. Handle 'charge.success'
  if (event.event === "charge.success") {
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

    return { processed: true, message: "Webhook charge.success processed successfully." };
  }

  // 3. Handle 'charge.failed'
  if (event.event === "charge.failed") {
    const tx = event.data;
    await processFailedPayment({
      reference: tx.reference,
      reason: tx.gateway_response || "Payment declined by financial institution.",
    });

    return { processed: true, message: "Webhook charge.failed processed." };
  }

  return { processed: false, message: `Ignored unhandled event: ${event.event}` };
}

// ─── Verify Paystack Transaction via API ───

export async function verifyPayment(reference: string): Promise<PaymentVerifyResult> {
  if (!env.PAYSTACK_SECRET_KEY) {
    // Development fallback
    return {
      verified: true,
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

    const body = await res.json();

    if (!res.ok || !body.status || body.data.status !== "success") {
      return {
        verified: false,
        reference,
        amount: 0,
        currency: "NGN",
        method: "UNKNOWN",
        gatewayReference: "",
        gatewayProvider: "PAYSTACK",
        paidAt: new Date(),
        error: body.message || "Transaction not successful on Paystack.",
      };
    }

    const tx = body.data;
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
