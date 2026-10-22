/**
 * Notification Service
 * Handles transactional emails for booking confirmations, gate access passes,
 * host listing submissions, moderation status, and account onboarding.
 *
 * Configured provider: Resend (domain: notifications.9jaroommate.com)
 */

import { env } from "../../config/env";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ─── Email Template Helpers ───

function emailShell(title: string, subtitle: string, bodyContent: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F8F7F4; padding: 20px;">
      <!-- Header Banner -->
      <div style="background-color: #0B5D45; padding: 28px 32px; border-radius: 14px 14px 0 0; text-align: left;">
        <h1 style="color: #FFFFFF; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Ilé</h1>
        <p style="color: #C3E2D8; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">${subtitle}</p>
      </div>

      <!-- Main Body Card -->
      <div style="padding: 32px; background-color: #FFFFFF; border: 1px solid #E7E5E0; border-top: none; border-radius: 0 0 14px 14px; line-height: 1.6; color: #171717;">
        ${bodyContent}

        <!-- Official Platform Footer -->
        <div style="margin-top: 36px; padding-top: 24px; border-top: 2px solid #EAE8E3; font-size: 13px; color: #6B6B67; text-align: center; line-height: 1.6;">
          <p style="margin: 0; font-weight: 800; font-size: 15px; color: #171717; letter-spacing: -0.2px;">Ilé Nigerian Accommodation &amp; Shortlet Marketplace</p>
          <p style="margin: 4px 0 14px 0; font-size: 12.5px; color: #8B8B86;">Verified Stays across Abuja, Lagos &amp; Nationwide</p>
          
          <!-- Platform Support Contacts Box -->
          <div style="margin: 0 auto; max-width: 500px; padding: 18px 22px; background-color: #FAFAF8; border: 1.5px solid #0B5D45; border-radius: 12px; text-align: left;">
            <p style="margin: 0 0 10px 0; font-weight: 800; font-size: 13px; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">
              Ilé Platform Support &amp; Concierge Service
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; color: #6B6B67; width: 120px; font-weight: 600;">Platform Email:</td>
                <td style="padding: 4px 0;">
                  <a href="mailto:support@ile.ng" style="color: #0B5D45; font-weight: 700; text-decoration: underline;">support@ile.ng</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6B6B67; font-weight: 600;">24/7 Helpline:</td>
                <td style="padding: 4px 0;">
                  <a href="tel:+2348004537829" style="color: #171717; font-weight: 700; text-decoration: none;">+234 800 453 7829</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #6B6B67; font-weight: 600;">Support Desk:</td>
                <td style="padding: 4px 0;">
                  <a href="tel:+2349122029904" style="color: #171717; font-weight: 700; text-decoration: none;">+234 912 202 9904</a>
                </td>
              </tr>
            </table>
          </div>
          
          <p style="margin: 16px 0 0 0; font-size: 11px; color: #9B9B97;">© 2026 Ilé Technologies Ltd. All rights reserved. Your peace of mind and comfort are our highest priority.</p>
        </div>
      </div>
    </div>
  `;
}

// ─── Shared Utilities for Safe Formatting & Escaping ───

export function escapeHtml(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(url?: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }
  return "";
}

export function formatCurrency(amount: number | undefined | null, currency: string = "NGN"): string {
  const val = Number(amount || 0);
  const cur = (currency || "NGN").toUpperCase().trim();
  if (cur === "NGN" || cur === "₦") {
    return `₦${val.toLocaleString("en-NG")}`;
  }
  if (cur === "USD" || cur === "$") {
    return `$${val.toLocaleString("en-US")}`;
  }
  if (cur === "EUR" || cur === "€") {
    return `€${val.toLocaleString("en-IE")}`;
  }
  if (cur === "GBP" || cur === "£") {
    return `£${val.toLocaleString("en-GB")}`;
  }
  return `${cur} ${val.toLocaleString()}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.trim().split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          timeZone: "UTC",
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function calculateStayNights(inStr: string, outStr: string, explicitNights?: number): number {
  if (explicitNights && explicitNights > 0) return explicitNights;
  try {
    const inDate = new Date(inStr + (inStr.includes("T") ? "" : "T00:00:00Z"));
    const outDate = new Date(outStr + (outStr.includes("T") ? "" : "T00:00:00Z"));
    const diff = Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
    return isNaN(diff) || diff < 1 ? 1 : diff;
  } catch {
    return 1;
  }
}

// ─── 1. Account Welcome Email ───

export function welcomeEmail(data: { name: string; email: string }): EmailPayload {
  const safeName = escapeHtml(data.name);
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Welcome to Ilé, ${safeName}!</h2>
    <p>Your account has been created. You can now discover, reserve, and enjoy verified shortlets across Abuja, Lagos, and throughout Nigeria.</p>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/search" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Explore Stays</a>
    </div>
    <p style="font-size: 14px; color: #6B6B67;">Interested in hosting? You can list your home anytime through your account dashboard.</p>
  `;

  return {
    to: data.email,
    subject: `Welcome to Ilé — Verified Nigerian Shortlets`,
    html: emailShell("Welcome", "Your account is ready", content),
    text: `Welcome to Ilé, ${data.name}!\n\nYour account is ready. Discover verified shortlets at ${env.FRONTEND_URL}/search`,
  };
}

// ─── 2. Password Reset Email ───

export function passwordResetEmail(data: { name: string; email: string; resetUrl: string }): EmailPayload {
  const safeName = escapeHtml(data.name);
  const safeReset = safeUrl(data.resetUrl);
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Password Reset Request</h2>
    <p>Hello ${safeName},</p>
    <p>We received a request to reset your password for your Ilé account. Click the button below to choose a new password:</p>
    <div style="margin: 24px 0;">
      <a href="${safeReset}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #8B8B86;">If you did not request this, you can safely ignore this email. The link will expire in 2 hours.</p>
  `;

  return {
    to: data.email,
    subject: `Reset Your Ilé Password`,
    html: emailShell("Password Reset", "Account Security", content),
    text: `Password Reset Request\n\nClick here to reset your password: ${data.resetUrl}`,
  };
}

// ─── 3. Booking Confirmation Email ───

// ─── 3. Booking Confirmation Email ───

export interface BookingConfirmationData {
  // Core guest & booking identity
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;

  // Reservation Status & Token
  bookingStatus?: "CONFIRMED" | "PENDING" | "PAYMENT_PENDING" | "CANCELLED" | "FAILED" | string;
  accessToken?: string;

  // Property Details & Hero Section
  propertyImage?: string;
  propertyType?: string;
  spaceType?: string;
  propertyTagline?: string;
  propertyDescription?: string;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  maxGuests?: number;
  guestCount?: number;
  neighborhood?: string;
  city?: string;
  state?: string;
  powerType?: string;

  // Stay timing & unit (no exact street address in confirmation email)
  address?: string;
  unitNumber?: string;
  latitude?: number;
  longitude?: number;
  accessGateCode?: string;
  accessInstructions?: string;
  checkInTime?: string;
  checkOutTime?: string;

  // Price Breakdown & Currency
  nightlyPrice?: number;
  numberOfNights?: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  discount?: number;
  amountPaid?: number;
  outstandingBalance?: number;
  currency?: string;

  // Payment Details
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: "SUCCESS" | "INITIALIZED" | "PENDING" | "FAILED" | string;
  paidAt?: string | Date;

  // Payer (if separate from lead guest)
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;

  // Guest Contact
  guestPhone?: string;

  // Host & Dedicated Guide
  hostName?: string;
  hostPhone?: string;
  hostEmail?: string;

  // Policies & Rules
  houseRules?: string;
  cancellationPolicy?: string;

  // Custom CTA override
  manageUrl?: string;
}

export function bookingConfirmationEmail(data: BookingConfirmationData): EmailPayload {
  const status = (data.bookingStatus || "CONFIRMED").toUpperCase().trim();
  const isConfirmed = status === "CONFIRMED";
  const isPending = status === "PENDING" || status === "PAYMENT_PENDING";
  const isCancelled = status === "CANCELLED";
  const isFailed = status === "FAILED";

  const nights = calculateStayNights(data.checkIn, data.checkOut, data.numberOfNights);
  const currency = data.currency || "NGN";

  // Financial calculations
  const totalAmount = data.totalAmount || 0;
  const cleaningFee = data.cleaningFee || 0;
  const serviceFee = data.serviceFee || 0;
  const discount = data.discount || 0;

  let nightlyPrice = data.nightlyPrice;
  if (!nightlyPrice || nightlyPrice <= 0) {
    const accommodationSubtotal = Math.max(0, totalAmount - cleaningFee - serviceFee + discount);
    nightlyPrice = Math.round(accommodationSubtotal / Math.max(1, nights));
  }
  const subtotal = nightlyPrice * nights;

  let amountPaid = data.amountPaid;
  if (amountPaid === undefined) {
    amountPaid = isConfirmed ? totalAmount : 0;
  }

  let outstandingBalance = data.outstandingBalance;
  if (outstandingBalance === undefined) {
    outstandingBalance = Math.max(0, totalAmount - amountPaid);
  }

  // No address computed here — exact address is only in the arrival guide email

  // Call to action URL
  const bookingUrl = data.manageUrl || (
    data.accessToken
      ? `${env.FRONTEND_URL}/trips?ref=${encodeURIComponent(data.referenceCode)}&token=${encodeURIComponent(data.accessToken)}`
      : `${env.FRONTEND_URL}/trips?ref=${encodeURIComponent(data.referenceCode)}`
  );

  // Status Badge Metadata
  let statusBadgeText = "● CONFIRMED";
  let statusBadgeBg = "#EDF5F2";
  let statusBadgeBorder = "#D1E5DE";
  let statusBadgeColor = "#0B5D45";
  let headlineTitle = "Your reservation is confirmed.";
  let headlineSubtitle = `Dear ${escapeHtml(data.guestName)}, your stay at <strong>${escapeHtml(data.propertyTitle)}</strong> is secured. Below is your official reservation record, apartment summary, arrival address, and gate clearance.`;
  let ctaButtonLabel = "View Reservation &amp; Access Pass &rarr;";

  if (isPending) {
    statusBadgeText = "● PAYMENT PENDING";
    statusBadgeBg = "#FEF7ED";
    statusBadgeBorder = "#FCE8CF";
    statusBadgeColor = "#9A5B13";
    headlineTitle = "Reservation received — awaiting payment.";
    headlineSubtitle = `Dear ${escapeHtml(data.guestName)}, we have received your booking request for <strong>${escapeHtml(data.propertyTitle)}</strong>. Please finalize your payment to confirm your dates and unlock arrival clearance.`;
    ctaButtonLabel = "Complete Payment &amp; Secure Stay &rarr;";
  } else if (isCancelled) {
    statusBadgeText = "✕ CANCELLED";
    statusBadgeBg = "#FDF2F2";
    statusBadgeBorder = "#F8D7D7";
    statusBadgeColor = "#B91C1C";
    headlineTitle = "Your reservation has been cancelled.";
    headlineSubtitle = `Dear ${escapeHtml(data.guestName)}, this is to confirm that reservation <strong>${escapeHtml(data.referenceCode)}</strong> for ${escapeHtml(data.propertyTitle)} has been cancelled and dates released.`;
    ctaButtonLabel = "Explore Verified Stays &rarr;";
  } else if (isFailed) {
    statusBadgeText = "⚠ PAYMENT INCOMPLETE";
    statusBadgeBg = "#FDF2F2";
    statusBadgeBorder = "#F8D7D7";
    statusBadgeColor = "#B91C1C";
    headlineTitle = "Payment was not completed.";
    headlineSubtitle = `Dear ${escapeHtml(data.guestName)}, your payment transaction could not be completed. Your reservation remains on hold. Please retry or choose an alternative payment method.`;
    ctaButtonLabel = "Retry Payment &rarr;";
  }

  // Subject line
  let emailSubject = `Booking Confirmed: ${data.propertyTitle} (${data.referenceCode})`;
  if (isPending) emailSubject = `Reservation Received — Payment Pending: ${data.propertyTitle} (${data.referenceCode})`;
  else if (isCancelled) emailSubject = `Reservation Cancelled: ${data.propertyTitle} (${data.referenceCode})`;
  else if (isFailed) emailSubject = `Payment Required: ${data.propertyTitle} (${data.referenceCode})`;

  const checkInFormatted = formatDisplayDate(data.checkIn);
  const checkOutFormatted = formatDisplayDate(data.checkOut);
  const checkInTime = data.checkInTime || "From 3:00 PM";
  const checkOutTime = data.checkOutTime || "By 11:00 AM";

  // HTML content construction with inline CSS and table layout for bulletproof email client rendering
  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(emailSubject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border: none !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 28px 20px 18px 20px !important; }
      .col-split { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .col-split-right { display: block !important; width: 100% !important; padding-top: 14px !important; text-align: left !important; }
      .hero-img { height: 210px !important; }
      .cta-btn { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F7F4; font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #171717; -webkit-font-smoothing: antialiased;">
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8F7F4" style="background-color: #F8F7F4; width: 100%; margin: 0; padding: 24px 0 40px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        
        <!-- MAIN SURFACE CARD (Max 600px) -->
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #EAE8E2; box-shadow: 0 4px 20px rgba(0,0,0,0.03); overflow: hidden;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td class="header-padding" style="padding: 34px 36px 20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Brand Wordmark -->
                  <td valign="middle" align="left">
                    <div style="line-height: 1;">
                      <span style="font-family: 'DM Serif Display', Georgia, Cambria, 'Times New Roman', serif; font-size: 30px; font-weight: 400; color: #171717; letter-spacing: -0.5px; text-decoration: none;">Ilé</span><span style="display: inline-block; width: 7px; height: 7px; background-color: #0B5D45; border-radius: 50%; margin-left: 2px; vertical-align: baseline;"></span>
                    </div>
                    <p style="margin: 5px 0 0 0; font-size: 10.5px; font-weight: 700; color: #8B8B86; letter-spacing: 1.5px; text-transform: uppercase;">Verified Nigerian Shortlets</p>
                  </td>
                  <!-- Status Badge -->
                  <td class="col-split-right" valign="middle" align="right">
                    <span style="display: inline-block; background-color: ${statusBadgeBg}; border: 1px solid ${statusBadgeBorder}; color: ${statusBadgeColor}; border-radius: 20px; padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap;">
                      ${statusBadgeText}
                    </span>
                    <div style="margin-top: 6px; font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace; font-size: 12px; font-weight: 700; color: #575753; letter-spacing: 0.5px;">
                      REF: ${escapeHtml(data.referenceCode)}
                    </div>
                  </td>
                </tr>
              </table>
              <div style="height: 1px; background-color: #F0EFEA; margin-top: 22px; width: 100%;"></div>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 10px 36px 36px 36px;">

              <!-- Editorial Headline -->
              <h1 style="font-family: 'DM Serif Display', Georgia, Cambria, serif; font-size: 26px; font-weight: 400; color: #171717; line-height: 1.25; margin: 0 0 10px 0; letter-spacing: -0.3px;">
                ${headlineTitle}
              </h1>
              <p style="font-size: 14.5px; line-height: 1.6; color: #4A4A45; margin: 0 0 24px 0;">
                ${headlineSubtitle}
              </p>

              <!-- PROPERTY HERO CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 14px; overflow: hidden; margin-bottom: 24px;">
                ${data.propertyImage && safeUrl(data.propertyImage) ? `
                <tr>
                  <td style="padding: 0; line-height: 0;">
                    <img class="hero-img" src="${safeUrl(data.propertyImage)}" alt="${escapeHtml(data.propertyTitle)}" width="600" style="width: 100%; max-width: 600px; height: 260px; object-fit: cover; display: block; border: 0;" />
                  </td>
                </tr>
                ` : ""}
                <tr>
                  <td style="padding: 22px;">
                    <div style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                      ${escapeHtml(data.propertyType || "Verified Shortlet Residence")}${data.spaceType ? ` &bull; ${escapeHtml(data.spaceType)}` : ""}
                    </div>
                    <h2 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 22px; font-weight: 400; color: #171717; margin: 0 0 6px 0; line-height: 1.3;">
                      ${escapeHtml(data.propertyTitle)}
                    </h2>
                    <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #575753; font-weight: 500;">
                      📍 ${escapeHtml([data.neighborhood, data.city || "Abuja", data.state || "FCT"].filter(Boolean).join(", "))}
                    </p>

                    ${data.propertyTagline || data.propertyDescription ? `
                    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.55; color: #6B6B67; font-style: italic;">
                      &ldquo;${escapeHtml((data.propertyTagline || data.propertyDescription || "").slice(0, 180))}${(data.propertyTagline || data.propertyDescription || "").length > 180 ? "…" : ""}&rdquo;
                    </p>
                    ` : ""}

                    <!-- Key Property Attributes Badges -->
                    <table cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #4A4A45;">
                      <tr>
                        ${data.bedrooms ? `
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          🛏️ ${data.bedrooms} Bedroom${data.bedrooms > 1 ? "s" : ""}
                        </td>
                        <td width="6"></td>
                        ` : ""}
                        ${data.bathrooms ? `
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          🚿 ${data.bathrooms} Bath${data.bathrooms > 1 ? "s" : ""}
                        </td>
                        <td width="6"></td>
                        ` : ""}
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          👥 ${data.guestCount || data.maxGuests || 1} Guest${(data.guestCount || data.maxGuests || 1) > 1 ? "s" : ""}
                        </td>
                        ${data.powerType ? `
                        <td width="6"></td>
                        <td style="background-color: #EDF5F2; border: 1px solid #D1E5DE; color: #0B5D45; border-radius: 6px; padding: 4px 10px; font-weight: 700; white-space: nowrap;">
                          ⚡ ${escapeHtml(data.powerType)}
                        </td>
                        ` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- RESERVATION SUMMARY CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 24px; padding: 0;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Reservation Details
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px;">
                      <tr>
                        <!-- Check In -->
                        <td class="col-split" width="48%" valign="top" style="padding-bottom: 14px;">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Check-In
                          </div>
                          <div style="font-size: 15px; font-weight: 700; color: #171717;">
                            ${checkInFormatted}
                          </div>
                          <div style="font-size: 12.5px; color: #6B6B67; margin-top: 2px;">
                            ${escapeHtml(checkInTime)}
                          </div>
                        </td>
                        <td width="4%" class="col-split"></td>
                        <!-- Check Out -->
                        <td class="col-split" width="48%" valign="top" style="padding-bottom: 14px;">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Check-Out
                          </div>
                          <div style="font-size: 15px; font-weight: 700; color: #171717;">
                            ${checkOutFormatted}
                          </div>
                          <div style="font-size: 12.5px; color: #6B6B67; margin-top: 2px;">
                            ${escapeHtml(checkOutTime)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <!-- Nights -->
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Length of Stay
                          </div>
                          <div style="font-size: 14px; font-weight: 600; color: #171717;">
                            ${nights} ${nights === 1 ? "Night" : "Nights"}
                          </div>
                        </td>
                        <td width="4%" class="col-split"></td>
                        <!-- Occupancy & Reference -->
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Booked Occupancy
                          </div>
                          <div style="font-size: 14px; font-weight: 600; color: #171717;">
                            ${data.guestCount || 1} ${Number(data.guestCount || 1) === 1 ? "Guest" : "Guests"}${data.unitNumber ? ` &bull; Unit ${escapeHtml(data.unitNumber)}` : ""}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- PRICE BREAKDOWN & PAYMENT SUMMARY CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border: 1.5px solid #E7E5E0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 22px; background-color: #FAFAF8; border-bottom: 1px solid #EAE8E2;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="left">
                          <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                            Financial Summary &amp; Payment Ledger
                          </span>
                        </td>
                        <td align="right">
                          <span style="font-size: 11.5px; font-weight: 700; color: #6B6B67;">
                            Currency: ${escapeHtml(currency)}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px; line-height: 1.5;">
                      <!-- Nightly Rate Subtotal -->
                      <tr>
                        <td style="padding: 6px 0; color: #575753;">
                          Accommodation (${formatCurrency(nightlyPrice, currency)} &times; ${nights} night${nights > 1 ? "s" : ""})
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">
                          ${formatCurrency(subtotal, currency)}
                        </td>
                      </tr>

                      <!-- Cleaning Fee -->
                      ${cleaningFee > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #575753;">
                          Cleaning &amp; Housekeeping Preparation
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">
                          ${formatCurrency(cleaningFee, currency)}
                        </td>
                      </tr>
                      ` : ""}

                      <!-- Service Fee / Processing Fee -->
                      ${serviceFee > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #575753;">
                          Payment Processing Fee (Paystack)
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #171717;">
                          ${formatCurrency(serviceFee, currency)}
                        </td>
                      </tr>
                      ` : ""}

                      <!-- Discounts / Promo -->
                      ${discount > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #0B5D45;">
                          Promotional / Partner Discount
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0B5D45;">
                          -${formatCurrency(discount, currency)}
                        </td>
                      </tr>
                      ` : ""}

                      <!-- Total Booking Amount Divider -->
                      <tr>
                        <td colspan="2" style="padding: 10px 0 6px 0;">
                          <div style="height: 1.5px; background-color: #EAE8E2;"></div>
                        </td>
                      </tr>

                      <!-- Total Booking Amount -->
                      <tr>
                        <td style="padding: 6px 0; font-size: 15px; font-weight: 800; color: #171717;">
                          Total Reservation Cost
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-size: 17px; font-weight: 800; color: #171717;">
                          ${formatCurrency(totalAmount, currency)}
                        </td>
                      </tr>

                      <!-- Amount Paid -->
                      <tr>
                        <td style="padding: 6px 0; color: #0B5D45; font-weight: 700;">
                          Amount Paid &amp; Processed
                        </td>
                        <td style="padding: 6px 0; text-align: right; font-size: 16px; font-weight: 800; color: #0B5D45;">
                          ${formatCurrency(amountPaid, currency)}
                        </td>
                      </tr>

                      <!-- Outstanding Balance -->
                      ${outstandingBalance > 0 ? `
                      <tr style="background-color: #FEF7ED;">
                        <td style="padding: 8px 10px; font-weight: 700; color: #9A5B13; border-radius: 6px;">
                          Outstanding Balance Due
                        </td>
                        <td style="padding: 8px 10px; text-align: right; font-size: 15px; font-weight: 800; color: #9A5B13; border-radius: 6px;">
                          ${formatCurrency(outstandingBalance, currency)}
                        </td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="padding: 4px 0; font-size: 12px; color: #6B6B67;">
                          Balance Status
                        </td>
                        <td style="padding: 4px 0; text-align: right; font-size: 12px; font-weight: 700; color: #0B5D45;">
                          ✓ Settled in Full (₦0.00 Due)
                        </td>
                      </tr>
                      `}

                      <!-- Payment Method & Transaction Reference Metadata -->
                      ${data.paymentReference || data.paymentMethod ? `
                      <tr>
                        <td colspan="2" style="padding: 12px 0 4px 0;">
                          <div style="padding: 10px 14px; background-color: #FAFAF8; border: 1px solid #ECEAE4; border-radius: 8px; font-size: 12px; color: #6B6B67;">
                            <span style="font-weight: 700; color: #171717;">Payment Method:</span> ${escapeHtml(data.paymentMethod || "Paystack Secured Checkout")}
                            ${data.paymentReference ? ` &bull; <span style="font-weight: 700; color: #171717;">Transaction Ref:</span> <code style="font-family: monospace; color: #0B5D45;">${escapeHtml(data.paymentReference)}</code>` : ""}
                            ${data.paidAt ? ` &bull; <span style="font-weight: 700; color: #171717;">Date:</span> ${escapeHtml(String(data.paidAt).slice(0, 24))}` : ""}
                          </div>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- GUEST & PAYER INFORMATION -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Guest &amp; Contact Records
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px; font-size: 13.5px; line-height: 1.6;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8B8B86; margin-bottom: 2px;">Primary Guest</div>
                          <div style="font-size: 14.5px; font-weight: 700; color: #171717;">${escapeHtml(data.guestName)}</div>
                          <div style="font-size: 13px; color: #575753;">${escapeHtml(data.guestEmail)}</div>
                          ${data.guestPhone ? `<div style="font-size: 13px; color: #575753;">${escapeHtml(data.guestPhone)}</div>` : ""}
                        </td>
                        <td width="4%" class="col-split"></td>
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8B8B86; margin-bottom: 2px;">
                            ${data.payerName && data.payerName !== data.guestName ? "Billing / Payer Record" : "Reservation Contact"}
                          </div>
                          <div style="font-size: 14.5px; font-weight: 700; color: #171717;">
                            ${escapeHtml(data.payerName || data.guestName)}
                          </div>
                          <div style="font-size: 13px; color: #575753;">
                            ${escapeHtml(data.payerEmail || data.guestEmail)}
                          </div>
                          <div style="font-size: 12px; color: #8B8B86; margin-top: 2px;">
                            Verified Marketplace Transaction
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ARRIVAL GUIDE NOTICE (Confirmed bookings only) -->
              ${isConfirmed ? `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border: 1.5px solid #0B5D45; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDF5F2; padding: 14px 20px; border-bottom: 1px solid #D1E5DE;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      ✈️ Arrival Guide &amp; Access Details
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 22px;">
                    <p style="margin: 0 0 10px 0; font-size: 14.5px; font-weight: 600; color: #171717; line-height: 1.5;">
                      Your complete arrival package has been sent in a separate email.
                    </p>
                    <p style="margin: 0 0 18px 0; font-size: 13.5px; color: #575753; line-height: 1.6;">
                      Check your inbox for the <strong style="color: #0B5D45;">Arrival Guide &amp; Stay Details</strong> email. It contains your <strong>exact street address</strong>, <strong>estate gate pass code</strong>, <strong>host contact</strong>, <strong>check-in instructions</strong>, and <strong>Google Maps directions</strong> — everything you need to arrive smoothly.
                    </p>
                    <a href="${safeUrl(bookingUrl)}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 10px 22px; border-radius: 8px; text-decoration: none;">
                      Open Arrival Guide on My Trips &rarr;
                    </a>
                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #8B8B86; line-height: 1.5;">
                      Can't find the email? Check your spam folder or visit your trips portal above. You can also contact <a href="mailto:support@ile.ng" style="color: #0B5D45; text-decoration: underline;">support@ile.ng</a>.
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- IMPORTANT POLICIES & HOUSE RULES -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Important Stay Policies &amp; Guidelines
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px; font-size: 12.5px; line-height: 1.6; color: #575753;">
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Standard Timing:</strong> Check-in is active ${escapeHtml(checkInTime)}, and check-out is strictly ${escapeHtml(checkOutTime)} to allow housekeeping inspection.
                    </div>
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Continuous Power:</strong> This property features verified automated backup power (Solar / Inverter / Standby Generator) engineered for continuous operation.
                    </div>
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Security &amp; Quiet Hours:</strong> Estate security guidelines require quiet hours between 10:00 PM and 7:00 AM. Unregistered parties are not permitted.
                    </div>
                    ${data.houseRules ? `
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Host Rules:</strong> ${escapeHtml(data.houseRules)}
                    </div>
                    ` : ""}
                    <div>
                      &bull; <strong style="color: #171717;">Cancellation Terms:</strong> Verified stays follow standard Ilé marketplace protection. Review terms in your trips dashboard.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- PRIMARY CALL TO ACTION BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a class="cta-btn" href="${safeUrl(bookingUrl)}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 6px rgba(11,93,69,0.25);">
                      ${ctaButtonLabel}
                    </a>
                    <div style="margin-top: 10px; font-size: 12px; color: #8B8B86;">
                      Secure, direct access to your reservation ledger &amp; trip pass
                    </div>
                  </td>
                </tr>
              </table>

              <!-- FOOTER & CONCIERGE SUPPORT -->
              <div style="border-top: 1px solid #EAE8E2; padding-top: 24px; text-align: center; font-size: 12px; color: #6B6B67; line-height: 1.6;">
                <p style="margin: 0 0 4px 0; font-weight: 800; font-size: 14px; color: #171717;">
                  Ilé Nigerian Accommodation &amp; Shortlet Marketplace
                </p>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #8B8B86;">
                  Curated, infrastructure-verified residences across Abuja, Lagos &amp; nationwide
                </p>

                <!-- Support Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="max-width: 460px; margin: 0 auto 18px auto; border: 1px solid #EAE8E2; border-radius: 10px; padding: 14px 18px; font-size: 12.5px; text-align: left;">
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600; width: 120px;">Platform Concierge:</td>
                    <td style="padding: 3px 0;">
                      <a href="mailto:support@ile.ng" style="color: #0B5D45; font-weight: 700; text-decoration: underline;">support@ile.ng</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600;">24/7 Helpline:</td>
                    <td style="padding: 3px 0;">
                      <a href="tel:+2348004537829" style="color: #171717; font-weight: 700; text-decoration: none;">+234 800 453 7829</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600;">Support Desk:</td>
                    <td style="padding: 3px 0;">
                      <a href="tel:+2349122029904" style="color: #171717; font-weight: 700; text-decoration: none;">+234 912 202 9904</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px 0;">
                  <a href="${env.FRONTEND_URL}/terms" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Terms of Service</a> &bull;
                  <a href="${env.FRONTEND_URL}/privacy" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Privacy Policy</a> &bull;
                  <a href="${env.FRONTEND_URL}/cancellation" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Cancellation Guidelines</a>
                </p>

                <p style="margin: 0; font-size: 11px; color: #9B9B97;">
                  &copy; 2026 Ilé Technologies Ltd. All rights reserved. This is an authoritative transactional record for reservation ${escapeHtml(data.referenceCode)}.
                </p>
              </div>

            </td>
          </tr>
        </table>
        <!-- /MAIN SURFACE CARD -->

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Plain-text alternative
  const plainText = `
ILÉ — VERIFIED NIGERIAN SHORTLETS
${emailSubject}
--------------------------------------------------------------------------------
STATUS: ${status}
BOOKING REFERENCE: ${data.referenceCode}

${headlineTitle}
${headlineSubtitle.replace(/<[^>]+>/g, "")}

ACCOMMODATION DETAILS:
Property: ${data.propertyTitle}
Type: ${data.propertyType || "Verified Shortlet Residence"}${data.spaceType ? ` (${data.spaceType})` : ""}
Location: ${[data.neighborhood, data.city || "Abuja", data.state || "FCT"].filter(Boolean).join(", ")}
${data.bedrooms ? `Bedrooms: ${data.bedrooms} | Bathrooms: ${data.bathrooms || 1}\n` : ""}Occupancy: ${data.guestCount || 1} Guests${data.unitNumber ? ` | Unit: ${data.unitNumber}` : ""}

STAY SCHEDULE:
Check-in: ${checkInFormatted} (${checkInTime})
Check-out: ${checkOutFormatted} (${checkOutTime})
Duration: ${nights} ${nights === 1 ? "Night" : "Nights"}

FINANCIAL SUMMARY (${currency}):
- Accommodation: ${formatCurrency(subtotal, currency)} (${formatCurrency(nightlyPrice, currency)}/night x ${nights} nights)
${cleaningFee > 0 ? `- Cleaning Fee: ${formatCurrency(cleaningFee, currency)}\n` : ""}${serviceFee > 0 ? `- Payment Processing Fee: ${formatCurrency(serviceFee, currency)}\n` : ""}${discount > 0 ? `- Discount: -${formatCurrency(discount, currency)}\n` : ""}- Total Cost: ${formatCurrency(totalAmount, currency)}
- Total Paid: ${formatCurrency(amountPaid, currency)}
${outstandingBalance > 0 ? `- Outstanding Balance: ${formatCurrency(outstandingBalance, currency)}\n` : "- Balance Status: Settled in Full (₦0.00)\n"}${data.paymentReference ? `Payment Method: ${data.paymentMethod || "Paystack"} | Ref: ${data.paymentReference}\n` : ""}
GUEST & CONTACT:
Primary Guest: ${data.guestName}
Email: ${data.guestEmail}
Phone: ${data.guestPhone || "+234 912 202 9904"}
${data.payerName && data.payerName !== data.guestName ? `Billing Payer: ${data.payerName} (${data.payerEmail || data.guestEmail})\n` : ""}
${isConfirmed ? `
ARRIVAL GUIDE:
Your complete arrival details (exact address, host contact, gate pass code, and directions) are in a separate email titled "Arrival Guide & Stay Details". Check your inbox.
` : ""}
MANAGE RESERVATION:
${bookingUrl}

--------------------------------------------------------------------------------
Ilé Concierge: support@ile.ng | Helpline: +234 800 453 7829 | +234 912 202 9904
(c) 2026 Ilé Technologies Ltd. All rights reserved.
  `.trim();

  return {
    to: data.guestEmail,
    subject: emailSubject,
    html,
    text: plainText,
  };
}

// ─── 4. Booking Access Pass & Gate Clearance Email ───

export interface BookingAccessPassData {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  address: string;

  // Optional extensions
  unitNumber?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  accessInstructions?: string;
  accessGateCode?: string;

  propertyImage?: string;
  propertyType?: string;
  spaceType?: string;
  propertyTagline?: string;
  propertyDescription?: string;
  bedrooms?: number;
  bathrooms?: number;
  guestCount?: number;
  numberOfNights?: number;

  hostName?: string;
  hostPhone?: string;
  hostEmail?: string;
  hostAvatar?: string;
  hostRole?: string;

  checkInTime?: string;
  checkOutTime?: string;
  timeZone?: string;

  parkingDescription?: string;
  powerDescription?: string;
  securityDescription?: string;
  waterDescription?: string;
  houseRules?: string;

  accessToken?: string;
  manageUrl?: string;
}

export function bookingAccessPassEmail(data: BookingAccessPassData): EmailPayload {
  const nights = calculateStayNights(data.checkIn, data.checkOut, data.numberOfNights);

  // Full formatted street address
  const fullAddress = [
    data.address,
    data.unitNumber ? `Unit / Apt: ${data.unitNumber}` : "",
    data.neighborhood,
    data.city || "Abuja",
    data.state || "FCT",
    "Nigeria",
  ].filter(Boolean).join(", ");

  const mapQuery = data.latitude && data.longitude
    ? `${data.latitude},${data.longitude}`
    : encodeURIComponent(fullAddress || `${data.city || "Abuja"}, Nigeria`);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const cleanPhone = (data.hostPhone || "+234 912 202 9904").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "";

  // Call to action URL
  const bookingUrl = data.manageUrl || (
    data.accessToken
      ? `${env.FRONTEND_URL}/trips?ref=${encodeURIComponent(data.referenceCode)}&token=${encodeURIComponent(data.accessToken)}`
      : `${env.FRONTEND_URL}/trips?ref=${encodeURIComponent(data.referenceCode)}`
  );

  const checkInFormatted = formatDisplayDate(data.checkIn);
  const checkOutFormatted = formatDisplayDate(data.checkOut);
  const checkInTime = data.checkInTime || "From 3:00 PM (15:00)";
  const checkOutTime = data.checkOutTime || "By 11:00 AM (11:00)";
  const timeZone = data.timeZone || "West Africa Time (WAT / UTC+1)";

  const hostDisplayName = data.hostName || "Dedicated Ilé Host";
  const hostInitials = hostDisplayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "IL";

  const hostRole = data.hostRole || "Your accommodation host & arrival concierge";
  const hostEmail = data.hostEmail || "support@ile.ng";

  const emailSubject = `Arrival Guide & Stay Details: ${data.propertyTitle} (${data.referenceCode})`;

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(emailSubject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border: none !important; }
      .content-padding { padding: 24px 20px !important; }
      .header-padding { padding: 28px 20px 18px 20px !important; }
      .col-split { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .col-split-right { display: block !important; width: 100% !important; padding-top: 14px !important; text-align: left !important; }
      .hero-img { height: 210px !important; }
      .cta-btn { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F7F4; font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #171717; -webkit-font-smoothing: antialiased;">
  <table class="email-wrapper" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8F7F4" style="background-color: #F8F7F4; width: 100%; margin: 0; padding: 24px 0 40px 0;">
    <tr>
      <td align="center" style="padding: 0 12px;">
        
        <!-- MAIN SURFACE CARD (Max 600px) -->
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width: 100%; max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #EAE8E2; box-shadow: 0 4px 20px rgba(0,0,0,0.03); overflow: hidden;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td class="header-padding" style="padding: 34px 36px 20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Brand Wordmark -->
                  <td valign="middle" align="left">
                    <div style="line-height: 1;">
                      <span style="font-family: 'DM Serif Display', Georgia, Cambria, 'Times New Roman', serif; font-size: 30px; font-weight: 400; color: #171717; letter-spacing: -0.5px; text-decoration: none;">Ilé</span><span style="display: inline-block; width: 7px; height: 7px; background-color: #0B5D45; border-radius: 50%; margin-left: 2px; vertical-align: baseline;"></span>
                    </div>
                    <p style="margin: 5px 0 0 0; font-size: 10.5px; font-weight: 700; color: #8B8B86; letter-spacing: 1.5px; text-transform: uppercase;">Your Stay Details &bull; Arrival Guide</p>
                  </td>
                  <!-- Reference Pill -->
                  <td class="col-split-right" valign="middle" align="right">
                    <span style="display: inline-block; background-color: #EDF5F2; border: 1px solid #D1E5DE; color: #0B5D45; border-radius: 20px; padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap;">
                      ARRIVAL CLEARANCE
                    </span>
                    <div style="margin-top: 6px; font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace; font-size: 12px; font-weight: 700; color: #575753; letter-spacing: 0.5px;">
                      REF: ${escapeHtml(data.referenceCode)}
                    </div>
                  </td>
                </tr>
              </table>
              <div style="height: 1px; background-color: #F0EFEA; margin-top: 22px; width: 100%;"></div>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 10px 36px 36px 36px;">

              <!-- Editorial Headline & Greeting -->
              <h1 style="font-family: 'DM Serif Display', Georgia, Cambria, serif; font-size: 26px; font-weight: 400; color: #171717; line-height: 1.25; margin: 0 0 10px 0; letter-spacing: -0.3px;">
                Here&rsquo;s where you&rsquo;re staying and how to reach your host.
              </h1>
              <p style="font-size: 14.5px; line-height: 1.6; color: #4A4A45; margin: 0 0 24px 0;">
                Dear ${escapeHtml(data.guestName)}, your reservation at <strong>${escapeHtml(data.propertyTitle)}</strong> is secured. Below is your complete arrival guide, including the exact street address, your assigned host&rsquo;s direct contact, estate gate clearance, and check-in procedures.
              </p>

              <!-- PROPERTY HERO CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 14px; overflow: hidden; margin-bottom: 24px;">
                ${data.propertyImage && safeUrl(data.propertyImage) ? `
                <tr>
                  <td style="padding: 0; line-height: 0;">
                    <img class="hero-img" src="${safeUrl(data.propertyImage)}" alt="${escapeHtml(data.propertyTitle)}" width="600" style="width: 100%; max-width: 600px; height: 260px; object-fit: cover; display: block; border: 0;" />
                  </td>
                </tr>
                ` : ""}
                <tr>
                  <td style="padding: 22px;">
                    <div style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                      ${escapeHtml(data.propertyType || "Verified Shortlet Residence")}${data.spaceType ? ` &bull; ${escapeHtml(data.spaceType)}` : ""}
                    </div>
                    <h2 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 22px; font-weight: 400; color: #171717; margin: 0 0 6px 0; line-height: 1.3;">
                      ${escapeHtml(data.propertyTitle)}
                    </h2>
                    <p style="margin: 0 0 12px 0; font-size: 13.5px; color: #575753; font-weight: 500;">
                      📍 ${escapeHtml([data.neighborhood, data.city || "Abuja", data.state || "FCT"].filter(Boolean).join(", "))}
                    </p>

                    ${data.propertyTagline || data.propertyDescription ? `
                    <p style="margin: 0 0 14px 0; font-size: 13px; line-height: 1.55; color: #6B6B67; font-style: italic;">
                      &ldquo;${escapeHtml((data.propertyTagline || data.propertyDescription || "").slice(0, 180))}${(data.propertyTagline || data.propertyDescription || "").length > 180 ? "…" : ""}&rdquo;
                    </p>
                    ` : ""}

                    <!-- Attributes Badges -->
                    <table cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #4A4A45;">
                      <tr>
                        ${data.bedrooms ? `
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          🛏️ ${data.bedrooms} Bedroom${data.bedrooms > 1 ? "s" : ""}
                        </td>
                        <td width="6"></td>
                        ` : ""}
                        ${data.bathrooms ? `
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          🚿 ${data.bathrooms} Bath${data.bathrooms > 1 ? "s" : ""}
                        </td>
                        <td width="6"></td>
                        ` : ""}
                        <td style="background-color: #FFFFFF; border: 1px solid #E5E3DC; border-radius: 6px; padding: 4px 10px; font-weight: 600; white-space: nowrap;">
                          👥 ${data.guestCount || 1} Guest${Number(data.guestCount || 1) > 1 ? "s" : ""}
                        </td>
                        <td width="6"></td>
                        <td style="background-color: #EDF5F2; border: 1px solid #D1E5DE; color: #0B5D45; border-radius: 6px; padding: 4px 10px; font-weight: 700; white-space: nowrap;">
                          ⚡ 24/7 Verified Power
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SECTION 1: APARTMENT ADDRESS CARD (MOST PROMINENT) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1.5px solid #0B5D45; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="background-color: #EDF5F2; padding: 14px 20px; border-bottom: 1.5px solid #0B5D45;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      📍 Exact Physical Property Address
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 22px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8B8B86; margin-bottom: 4px;">
                      Physical Street Address (Selectable Text)
                    </div>
                    <div style="font-size: 16.5px; font-weight: 800; color: #171717; line-height: 1.45; margin: 4px 0 8px 0;">
                      ${escapeHtml(fullAddress)}
                    </div>
                    ${data.unitNumber ? `
                    <div style="font-size: 13.5px; font-weight: 600; color: #0B5D45; margin-bottom: 8px;">
                      Unit / Apartment Details: <strong>${escapeHtml(data.unitNumber)}</strong>
                    </div>
                    ` : ""}

                    <p style="margin: 0 0 16px 0; font-size: 12.5px; color: #6B6B67; line-height: 1.5;">
                      Please provide this exact address to your driver or dispatch service. The compound security gate is manned 24 hours.
                    </p>

                    <!-- Get Directions Button -->
                    <a href="${googleMapsUrl}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 13.5px; padding: 11px 22px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(11,93,69,0.2);">
                      🗺️ Get Directions on Google Maps &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- SECTION 2: HOST CONTACT CARD (WELCOMING & DISTINCT) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color: #FFFFFF; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #FAFAF8; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Your Accommodation Host &amp; Arrival Concierge
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 22px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <!-- Host Photo or Monogram Avatar -->
                        <td width="66" valign="top">
                          ${data.hostAvatar && safeUrl(data.hostAvatar) ? `
                          <img src="${safeUrl(data.hostAvatar)}" alt="${escapeHtml(hostDisplayName)}" width="58" height="58" style="width: 58px; height: 58px; border-radius: 50%; object-fit: cover; display: block; border: 2px solid #EDF5F2;" />
                          ` : `
                          <div style="width: 58px; height: 58px; border-radius: 50%; background-color: #EDF5F2; border: 2px solid #D1E5DE; color: #0B5D45; font-size: 19px; font-weight: 800; text-align: center; line-height: 58px; letter-spacing: 0.5px;">
                            ${escapeHtml(hostInitials)}
                          </div>
                          `}
                        </td>
                        <!-- Host Identity & Contact -->
                        <td valign="top" style="padding-left: 14px;">
                          <div style="font-size: 16.5px; font-weight: 700; color: #171717; margin-bottom: 2px;">
                            ${escapeHtml(hostDisplayName)}
                          </div>
                          <div style="font-size: 12.5px; color: #6B6B67; margin-bottom: 8px;">
                            ${escapeHtml(hostRole)}
                          </div>

                          <table cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px; color: #4A4A45;">
                            <tr>
                              <td style="padding: 2px 0; font-weight: 600; width: 68px; color: #8B8B86; font-size: 12px; text-transform: uppercase;">Direct Line:</td>
                              <td style="padding: 2px 0;">
                                <a href="tel:${cleanPhone}" style="color: #171717; font-weight: 700; text-decoration: none;">${escapeHtml(data.hostPhone || "+234 912 202 9904")}</a>
                              </td>
                            </tr>
                            ${data.hostEmail ? `
                            <tr>
                              <td style="padding: 2px 0; font-weight: 600; color: #8B8B86; font-size: 12px; text-transform: uppercase;">Email:</td>
                              <td style="padding: 2px 0;">
                                <a href="mailto:${escapeHtml(hostEmail)}" style="color: #0B5D45; font-weight: 600; text-decoration: underline;">${escapeHtml(hostEmail)}</a>
                              </td>
                            </tr>
                            ` : ""}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Direct Contact Actions -->
                    <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #EAE8E2;">
                      ${waLink ? `
                      <a href="${waLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-weight: 700; font-size: 12.5px; padding: 9px 18px; border-radius: 6px; text-decoration: none; margin-right: 8px;">
                        💬 Message Host on WhatsApp
                      </a>
                      ` : ""}
                      <a href="${safeUrl(bookingUrl)}" target="_blank" style="display: inline-block; background-color: #FAFAF8; border: 1px solid #D5D3CE; color: #171717; font-weight: 600; font-size: 12.5px; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
                        Open Trips Portal &rarr;
                      </a>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECTION 3: ARRIVAL SCHEDULE & REQUIREMENTS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Arrival &amp; Stay Schedule
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13.5px;">
                      <tr>
                        <!-- Check In -->
                        <td class="col-split" width="48%" valign="top" style="padding-bottom: 14px;">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Check-In
                          </div>
                          <div style="font-size: 15px; font-weight: 700; color: #171717;">
                            ${checkInFormatted}
                          </div>
                          <div style="font-size: 12.5px; color: #6B6B67; margin-top: 2px;">
                            ${escapeHtml(checkInTime)}
                          </div>
                        </td>
                        <td width="4%" class="col-split"></td>
                        <!-- Check Out -->
                        <td class="col-split" width="48%" valign="top" style="padding-bottom: 14px;">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Check-Out
                          </div>
                          <div style="font-size: 15px; font-weight: 700; color: #171717;">
                            ${checkOutFormatted}
                          </div>
                          <div style="font-size: 12.5px; color: #6B6B67; margin-top: 2px;">
                            ${escapeHtml(checkOutTime)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <!-- Time Zone & Duration -->
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Time Zone
                          </div>
                          <div style="font-size: 13px; font-weight: 600; color: #171717;">
                            ${escapeHtml(timeZone)}
                          </div>
                        </td>
                        <td width="4%" class="col-split"></td>
                        <!-- Length of stay -->
                        <td class="col-split" width="48%" valign="top">
                          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #8B8B86; letter-spacing: 0.6px; margin-bottom: 3px;">
                            Length of Stay
                          </div>
                          <div style="font-size: 13.5px; font-weight: 600; color: #171717;">
                            ${nights} ${nights === 1 ? "Night" : "Nights"} &bull; ${data.guestCount || 1} Guest${Number(data.guestCount || 1) > 1 ? "s" : ""}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #EAE8E2; font-size: 12.5px; color: #575753; line-height: 1.5;">
                      <strong style="color: #171717;">Check-In Verification:</strong> Please ensure the primary guest (${escapeHtml(data.guestName)}) has a valid government-issued photo ID (NIN, Driver&rsquo;s License, or International Passport) for gate reception matching.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECTION 4: ACCESS INSTRUCTIONS & ESTATE GATE PASS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EDF5F2" style="background-color: #EDF5F2; border: 1.5px solid #0B5D45; border-radius: 12px; margin-bottom: 24px; padding: 22px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
                      🔑 Estate Gate Clearance &amp; Access Procedures
                    </div>

                    <!-- Gate Pass Code Box -->
                    <div style="background-color: #FFFFFF; border: 1.5px dashed #0B5D45; border-radius: 10px; padding: 14px 18px; margin: 10px 0 14px 0; display: inline-block;">
                      <div style="font-size: 10.5px; font-weight: 700; color: #6B6B67; text-transform: uppercase; margin-bottom: 2px;">
                        Estate Security Gate Pass Code:
                      </div>
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', Consolas, monospace; font-size: 24px; font-weight: 800; color: #0B5D45; letter-spacing: 3px;">
                        ${escapeHtml(data.accessGateCode || "GATE-CLEARED")}
                      </div>
                    </div>

                    <div style="font-size: 13.5px; line-height: 1.6; color: #171717;">
                      ${escapeHtml(data.accessInstructions || "Present your reservation reference to estate security guards for swift clearance. Your assigned host will greet you at the entrance to hand over keys.")}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- SECTION 5: HELPFUL ARRIVAL REMINDERS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="background-color: #FAFAF8; border: 1px solid #EAE8E2; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #EAE8E2;">
                    <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.8px;">
                      Helpful Arrival Reminders
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px; font-size: 12.5px; line-height: 1.6; color: #575753;">
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Parking:</strong> ${escapeHtml(data.parkingDescription || "Dedicated covered parking bay available inside the secured compound.")}
                    </div>
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Power &amp; Climate:</strong> ${escapeHtml(data.powerDescription || "Continuous 24/7 power backed by automated solar inverter and silent standby generator.")}
                    </div>
                    <div style="margin-bottom: 6px;">
                      &bull; <strong style="color: #171717;">Quiet Hours:</strong> Estate security guidelines require quiet hours between 10:00 PM and 7:00 AM.
                    </div>
                    ${data.houseRules ? `
                    <div>
                      &bull; <strong style="color: #171717;">House Guidelines:</strong> ${escapeHtml(data.houseRules)}
                    </div>
                    ` : ""}
                  </td>
                </tr>
              </table>

              <!-- PRIMARY CALL TO ACTION BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a class="cta-btn" href="${safeUrl(bookingUrl)}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 6px rgba(11,93,69,0.25);">
                      Open Gate Pass on My Phone &rarr;
                    </a>
                    <div style="margin-top: 10px; font-size: 12px; color: #8B8B86;">
                      Instant digital gate pass &bull; Accessible offline on your mobile device
                    </div>
                  </td>
                </tr>
              </table>

              <!-- FOOTER & CONCIERGE SUPPORT -->
              <div style="border-top: 1px solid #EAE8E2; padding-top: 24px; text-align: center; font-size: 12px; color: #6B6B67; line-height: 1.6;">
                <p style="margin: 0 0 4px 0; font-weight: 800; font-size: 14px; color: #171717;">
                  Ilé Nigerian Accommodation &amp; Shortlet Marketplace
                </p>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #8B8B86;">
                  Curated, infrastructure-verified residences across Abuja, Lagos &amp; nationwide
                </p>

                <!-- Support Box -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAFAF8" style="max-width: 460px; margin: 0 auto 18px auto; border: 1px solid #EAE8E2; border-radius: 10px; padding: 14px 18px; font-size: 12.5px; text-align: left;">
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600; width: 120px;">Platform Concierge:</td>
                    <td style="padding: 3px 0;">
                      <a href="mailto:support@ile.ng" style="color: #0B5D45; font-weight: 700; text-decoration: underline;">support@ile.ng</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600;">24/7 Helpline:</td>
                    <td style="padding: 3px 0;">
                      <a href="tel:+2348004537829" style="color: #171717; font-weight: 700; text-decoration: none;">+234 800 453 7829</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0; color: #6B6B67; font-weight: 600;">Support Desk:</td>
                    <td style="padding: 3px 0;">
                      <a href="tel:+2349122029904" style="color: #171717; font-weight: 700; text-decoration: none;">+234 912 202 9904</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px 0;">
                  <a href="${env.FRONTEND_URL}/terms" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Terms of Service</a> &bull;
                  <a href="${env.FRONTEND_URL}/privacy" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Privacy Policy</a> &bull;
                  <a href="${env.FRONTEND_URL}/cancellation" style="color: #0B5D45; text-decoration: underline; margin: 0 6px;">Cancellation Guidelines</a>
                </p>

                <p style="margin: 0; font-size: 11px; color: #9B9B97;">
                  &copy; 2026 Ilé Technologies Ltd. All rights reserved. This is an authoritative arrival clearance for reservation ${escapeHtml(data.referenceCode)}.
                </p>
              </div>

            </td>
          </tr>
        </table>
        <!-- /MAIN SURFACE CARD -->

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const plainText = `
ILÉ — VERIFIED NIGERIAN SHORTLETS
${emailSubject}
--------------------------------------------------------------------------------
RESERVATION REFERENCE: ${data.referenceCode}

Here's where you're staying and how to reach your host.
Dear ${data.guestName}, your reservation at ${data.propertyTitle} is secured.

EXACT APARTMENT ADDRESS:
${fullAddress}
${data.unitNumber ? `Unit / Apt: ${data.unitNumber}\n` : ""}Get Directions: ${googleMapsUrl}

ASSIGNED HOST / ARRIVAL CONCIERGE:
Host Name: ${hostDisplayName}
Role: ${hostRole}
Helpline: ${data.hostPhone || "+234 912 202 9904"}
Email: ${hostEmail}
WhatsApp: ${waLink}

ARRIVAL & STAY SCHEDULE:
Check-In: ${checkInFormatted} (${checkInTime})
Check-Out: ${checkOutFormatted} (${checkOutTime})
Time Zone: ${timeZone}
Length of Stay: ${nights} ${nights === 1 ? "Night" : "Nights"} (${data.guestCount || 1} Guests)

ESTATE SECURITY GATE CLEARANCE & PROCEDURES:
Gate Pass Code: ${data.accessGateCode || "GATE-CLEARED"}
Instructions: ${data.accessInstructions || "Present reservation reference to estate security guards."}

HELPFUL REMINDERS:
- Parking: ${data.parkingDescription || "Dedicated covered parking inside compound."}
- Power: ${data.powerDescription || "Continuous 24/7 power backed by solar & generator."}
${data.houseRules ? `- House Rules: ${data.houseRules}\n` : ""}
MANAGE DIGITAL GATE PASS:
${bookingUrl}

--------------------------------------------------------------------------------
Ilé Concierge: support@ile.ng | Helpline: +234 800 453 7829 | +234 912 202 9904
(c) 2026 Ilé Technologies Ltd. All rights reserved.
  `.trim();

  return {
    to: data.guestEmail,
    subject: emailSubject,
    html,
    text: plainText,
  };
}

// ─── 5. Host Property Submission Notification ───

export function hostPropertySubmittedEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  propertyId: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Listing Received for Review</h2>
    <p>Hello ${data.hostName},</p>
    <p>Thank you for submitting <strong>${data.propertyTitle}</strong> to Ilé.</p>
    <p>Our quality and safety review team inspects every listing to ensure power stability, verified addresses, and photo accuracy. Reviews typically take less than 24 hours.</p>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Host Dashboard</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Listing Received: ${data.propertyTitle} — Under Review`,
    html: emailShell("Listing Under Review", "We are reviewing your property", content),
    text: `Listing Received: ${data.propertyTitle}\n\nOur team is reviewing your listing. View status: ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 6. Host Property Review Moderation Email (Approval / Rejection) ───

export function propertyReviewStatusEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  status: "APPROVED" | "REJECTED";
  reason?: string;
}): EmailPayload {
  const isApproved = data.status === "APPROVED";

  const content = isApproved
    ? `
      <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Congratulations! Your Listing is Live</h2>
      <p>Hello ${data.hostName},</p>
      <p>Your property <strong>${data.propertyTitle}</strong> has passed our verification and is now live on Ilé.</p>
      <div style="margin: 24px 0;">
        <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Manage Listing</a>
      </div>
    `
    : `
      <h2 style="font-size: 20px; margin-top: 0; color: #B91C1C;">Listing Update Required</h2>
      <p>Hello ${data.hostName},</p>
      <p>Your listing <strong>${data.propertyTitle}</strong> requires a few revisions before it can be published:</p>
      <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B;">
        <p style="margin: 0; font-size: 14px;">${data.reason || "Please verify your photos and power infrastructure specifications."}</p>
      </div>
      <div style="margin: 24px 0;">
        <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Edit Listing in Dashboard</a>
      </div>
    `;

  return {
    to: data.hostEmail,
    subject: isApproved
      ? `🎉 Your listing is live: ${data.propertyTitle}`
      : `Action required for your listing: ${data.propertyTitle}`,
    html: emailShell(
      isApproved ? "Listing Approved" : "Listing Review Update",
      isApproved ? "Published on Ilé" : "Review feedback",
      content
    ),
    text: isApproved
      ? `Congratulations! ${data.propertyTitle} is now live on Ilé.`
      : `Listing review update for ${data.propertyTitle}: ${data.reason || "Revisions required."}`,
  };
}

// ─── 7. Property Owner Email OTP Verification ───

export function ownerEmailOtpEmail(data: {
  name: string;
  email: string;
  code: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Verify your email address</h2>
    <p>Hello ${escapeHtml(data.name)},</p>
    <p>Thank you for partnering with Ilé as a property owner. Please enter the following 6-digit verification code to confirm your email and continue your onboarding:</p>
    <div style="margin: 28px 0; text-align: center;">
      <span style="display: inline-block; background-color: #FAFAF8; border: 2px dashed #0B5D45; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0B5D45; padding: 16px 32px; font-family: monospace;">
        ${escapeHtml(data.code)}
      </span>
    </div>
    <p style="font-size: 13.5px; color: #6B6B67;">This code is valid for 15 minutes. If you did not initiate this request, you can safely ignore this email.</p>
  `;

  return {
    to: data.email,
    subject: `${data.code} is your Ilé owner verification code`,
    html: emailShell("Email Verification", "Owner account setup", content),
    text: `Your Ilé verification code is: ${data.code}. It is valid for 15 minutes.`,
  };
}

// ─── 8. Host Onboarding Application Submitted ───

export function hostApplicationSubmittedEmail(data: {
  hostName: string;
  hostEmail: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Verification Application Submitted</h2>
    <p>Hello ${data.hostName},</p>
    <p>Thank you for completing your Ilé host onboarding and identity verification submission.</p>
    <p>Our compliance and trust team is reviewing your identification documents, ownership credentials, and Nigerian payout details. We verify every partner to ensure a trusted, secure marketplace for both hosts and tenants.</p>
    <div style="background-color: #F8F9FA; border-left: 4px solid #0B5D45; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Standard Review Window:</strong> 24 to 48 hours. You will receive an immediate notification once reviewed.</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Track Application Status</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Host Application Received — Under Review by Ilé`,
    html: emailShell("Application Received", "Identity & Authority Verification", content),
    text: `Hello ${data.hostName}, your host application has been received and is under review. Track status at ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 9. Host Application Approved ───

export function hostApplicationApprovedEmail(data: {
  hostName: string;
  hostEmail: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Congratulations! You are now a Verified Host</h2>
    <p>Hello ${data.hostName},</p>
    <p>Your property owner verification has been approved by the Ilé moderation team. Your identity and ownership credentials have met our verified marketplace standards.</p>
    <p>You can now publish your property listings, manage guest bookings, and receive automated payouts to your registered Nigerian bank account.</p>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Go to Host Dashboard →</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `🎉 Host Verification Approved — Welcome to Ilé`,
    html: emailShell("Account Approved", "Verified Property Partner", content),
    text: `Congratulations ${data.hostName}! Your host verification is approved. Manage your properties at ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 10. Host Application Rejected ───

export function hostApplicationRejectedEmail(data: {
  hostName: string;
  hostEmail: string;
  reason?: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #B91C1C;">Host Application Update</h2>
    <p>Hello ${data.hostName},</p>
    <p>Thank you for your interest in partnering with Ilé. Unfortunately, after inspecting the submitted credentials, your host application could not be approved at this time:</p>
    <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B;">
      <p style="margin: 0; font-size: 14px;"><strong>Feedback from Verification Team:</strong><br/>${data.reason || "The submitted identification or property authority documents could not be validated."}</p>
    </div>
    <p style="font-size: 14px; color: #4B5563;">You can sign in to update your credentials or contact Ilé partner support for assistance.</p>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/signup" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Review Onboarding Application</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Host Application Update — Action Required`,
    html: emailShell("Verification Update", "Application Status", content),
    text: `Hello ${data.hostName}, your host application status update: ${data.reason || "Action required"}. Check ${env.FRONTEND_URL}/signup`,
  };
}

// ─── 11. Host Application Info Requested ───

export function hostApplicationInfoRequestedEmail(data: {
  hostName: string;
  hostEmail: string;
  instructions: string;
}): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #D97706;">Information Requested for Verification</h2>
    <p>Hello ${data.hostName},</p>
    <p>Our verification team needs additional details to complete your host onboarding:</p>
    <div style="background-color: #FFFBEB; border: 1px solid #FCD34D; border-radius: 10px; padding: 16px; margin: 20px 0; color: #92400E;">
      <p style="margin: 0; font-size: 14px;"><strong>Instructions:</strong><br/>${data.instructions}</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/signup" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Update Your Documents →</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Action Required: Additional info requested for Ilé host onboarding`,
    html: emailShell("Document Request", "Action Required", content),
    text: `Additional information requested: ${data.instructions}. Update at ${env.FRONTEND_URL}/signup`,
  };
}

// ─── 12. Host Account Welcome Email ───

export function hostWelcomeEmail(data: { name: string; email: string }): EmailPayload {
  const safeName = escapeHtml(data.name);
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Welcome to Ilé Hosting, ${safeName}!</h2>
    <p>Thank you for partnering with Ilé as a host. Ilé connects verified Nigerian shortlets and premium residences with discerning guests looking for trusted, seamless stays across Abuja, Lagos, and nationwide.</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <h3 style="font-size: 15px; margin: 0 0 12px 0; color: #0B5D45; font-weight: 700;">Next Steps to Publish Your Listings</h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
        <li><strong>Complete Verification (KYC):</strong> Submit your valid government ID and property ownership or management authority.</li>
        <li><strong>Add Payout Details:</strong> Enter your Nigerian bank account to receive automated guest payouts.</li>
        <li><strong>Create &amp; Publish:</strong> Once verified, create and publish your listings immediately without routine per-listing delays.</li>
      </ol>
    </div>

    <div style="margin: 28px 0;">
      <a href="${env.FRONTEND_URL}/host/onboarding/authority" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 13px 26px; border-radius: 8px; text-decoration: none;">Continue Host Verification →</a>
    </div>

    <p style="font-size: 13px; color: #6B6B67;">Questions about hosting or payout structures? Reach our host concierge team at <a href="mailto:support@ile.ng" style="color: #0B5D45;">support@ile.ng</a>.</p>
  `;

  return {
    to: data.email,
    subject: `Welcome to Ilé Hosting — Complete Your Verification`,
    html: emailShell("Host Account Welcome", "Partner Onboarding", content),
    text: `Welcome to Ilé Hosting, ${data.name}!\n\nComplete your identity and property verification to begin publishing listings and receiving payouts: ${env.FRONTEND_URL}/host/onboarding/authority`,
  };
}

// ─── 13. Generic Email OTP Verification ───

export function emailOtpEmail(data: { name: string; email: string; code: string; purpose?: string }): EmailPayload {
  const safeName = escapeHtml(data.name);
  const purpose = data.purpose ? escapeHtml(data.purpose) : "verification";
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Verify your email address</h2>
    <p>Hello ${safeName},</p>
    <p>Please enter the following 6-digit one-time code to complete your ${purpose}:</p>
    <div style="margin: 28px 0; text-align: center;">
      <span style="display: inline-block; background-color: #FAFAF8; border: 2px dashed #0B5D45; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0B5D45; padding: 16px 32px; font-family: monospace;">
        ${escapeHtml(data.code)}
      </span>
    </div>
    <p style="font-size: 13.5px; color: #6B6B67;">This security code expires in 15 minutes. For your security, never share this code with anyone. Ilé staff will never ask for your code.</p>
  `;

  return {
    to: data.email,
    subject: `${data.code} is your Ilé verification code`,
    html: emailShell("Email Verification", "Security Code", content),
    text: `Your Ilé verification code is: ${data.code}. It is valid for 15 minutes.`,
  };
}

// ─── 14. Password Reset Success Confirmation ───

export function passwordResetSuccessEmail(data: { name: string; email: string }): EmailPayload {
  const safeName = escapeHtml(data.name);
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Password Changed Successfully</h2>
    <p>Hello ${safeName},</p>
    <p>The password for your Ilé account (<strong>${escapeHtml(data.email)}</strong>) was recently updated.</p>
    <div style="background-color: #FAFAF8; border-left: 4px solid #0B5D45; padding: 14px 18px; margin: 20px 0; border-radius: 4px; font-size: 13.5px; color: #374151;">
      <p style="margin: 0;"><strong>Security Notice:</strong> If you performed this change, no further action is needed.</p>
      <p style="margin: 6px 0 0 0; color: #B91C1C;">If you did not initiate this change, please contact Ilé Trust &amp; Safety immediately at <a href="mailto:support@ile.ng" style="color: #B91C1C; font-weight: 700;">support@ile.ng</a> or call our 24/7 Helpline.</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/login" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Sign In to Your Account</a>
    </div>
  `;

  return {
    to: data.email,
    subject: `Security Alert: Your Ilé Password Has Been Updated`,
    html: emailShell("Password Changed", "Security Alert", content),
    text: `Hello ${data.name}, your Ilé password has been updated. If you did not make this change, contact support@ile.ng immediately.`,
  };
}

// ─── 15. Listing Published Email (KYC-Approved Instant Publication) ───

export function listingPublishedEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  propertyId: string;
  nightlyPrice: number;
  city: string;
  neighborhood: string;
  currency?: string;
}): EmailPayload {
  const safeTitle = escapeHtml(data.propertyTitle);
  const formattedPrice = formatCurrency(data.nightlyPrice, data.currency || "NGN");
  const location = `${escapeHtml(data.neighborhood)}, ${escapeHtml(data.city)}`;

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Your Listing is Live!</h2>
    <p>Hello ${escapeHtml(data.hostName)},</p>
    <p>Great news! Your property <strong>${safeTitle}</strong> is published and now visible to guests on Ilé.</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600; width: 140px;">Property:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #171717;">${safeTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600;">Location:</td>
          <td style="padding: 6px 0; color: #171717;">${location}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600;">Nightly Rate:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B5D45;">${formattedPrice} / night</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600;">Status:</td>
          <td style="padding: 6px 0;"><span style="display: inline-block; background-color: #ECFDF5; color: #065F46; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">PUBLISHED</span></td>
        </tr>
      </table>
    </div>

    <div style="margin: 28px 0;">
      <a href="${env.FRONTEND_URL}/properties/${data.propertyId}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-right: 12px;">View Public Listing</a>
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #FAFAF8; color: #171717; border: 1px solid #D1D5DB; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Host Dashboard</a>
    </div>

    <p style="font-size: 13.5px; color: #6B6B67;">As a verified host, you can update dates, adjust nightly rates, and manage bookings anytime from your dashboard.</p>
  `;

  return {
    to: data.hostEmail,
    subject: `🎉 Your listing is live: ${data.propertyTitle}`,
    html: emailShell("Listing Published", "Live on Ilé", content),
    text: `Congratulations ${data.hostName}! Your property "${data.propertyTitle}" (${location} at ${formattedPrice}/night) is live on Ilé.\n\nView listing: ${env.FRONTEND_URL}/properties/${data.propertyId}`,
  };
}

// ─── 16. Listing Suspended Email (Moderation Enforcement) ───

export function listingSuspendedEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  reason?: string;
}): EmailPayload {
  const safeTitle = escapeHtml(data.propertyTitle);
  const safeReason = escapeHtml(data.reason || "Administrative policy or documentation review.");

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #B91C1C;">Listing Notice: ${safeTitle} Has Been Suspended</h2>
    <p>Hello ${escapeHtml(data.hostName)},</p>
    <p>We are writing to notify you that an Ilé administrator has suspended your listing <strong>${safeTitle}</strong> from public discovery and booking.</p>
    
    <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B;">
      <p style="margin: 0; font-size: 14px;"><strong>Reason for Suspension:</strong><br/>${safeReason}</p>
    </div>

    <p style="font-size: 14px; color: #4B5563;">While suspended, this property is not visible to guests and cannot receive new reservations. Existing confirmed reservations remain protected under Ilé guarantee terms.</p>
    <p style="font-size: 14px; color: #4B5563;">To appeal this suspension or submit required clarifications, please contact our Trust &amp; Safety team.</p>

    <div style="margin: 24px 0;">
      <a href="mailto:support@ile.ng?subject=Listing%20Suspension%20Appeal%20-%20${encodeURIComponent(data.propertyTitle)}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Contact Moderation Team</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Notice: Listing suspended by moderation — ${data.propertyTitle}`,
    html: emailShell("Listing Moderation", "Suspension Notice", content),
    text: `Hello ${data.hostName}, your listing "${data.propertyTitle}" has been suspended by an administrator.\n\nReason: ${data.reason || "Administrative review"}.\n\nContact support@ile.ng to appeal.`,
  };
}

// ─── 17. Host Account Suspended Email ───

export function hostAccountSuspendedEmail(data: {
  hostName: string;
  hostEmail: string;
  reason?: string;
}): EmailPayload {
  const safeReason = escapeHtml(data.reason || "Non-compliance with host standards or failed verification audit.");
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #B91C1C;">Notice: Ilé Host Account Suspended</h2>
    <p>Hello ${escapeHtml(data.hostName)},</p>
    <p>Your host privileges on Ilé have been suspended following an administrative review.</p>
    
    <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B;">
      <p style="margin: 0; font-size: 14px;"><strong>Reason:</strong><br/>${safeReason}</p>
    </div>

    <p style="font-size: 14px; color: #4B5563;">All associated active listings have been withdrawn from search. You will receive separate communication regarding any pending guest stays or outstanding payouts.</p>

    <div style="margin: 24px 0;">
      <a href="mailto:support@ile.ng?subject=Host%20Account%20Suspension%20Appeal" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Contact Support Concierge</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Notice: Ilé Host Account Suspended`,
    html: emailShell("Account Status", "Suspension Notice", content),
    text: `Hello ${data.hostName}, your host account has been suspended.\n\nReason: ${data.reason || "Administrative review"}.\n\nContact support@ile.ng for inquiries.`,
  };
}

// ─── 18. Guest Booking Initiated Email ───

export function bookingInitiatedEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency?: string;
  paymentUrl?: string;
}): EmailPayload {
  const safeName = escapeHtml(data.guestName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const formattedTotal = formatCurrency(data.totalAmount, data.currency || "NGN");
  const dates = `${formatDisplayDate(data.checkIn)} → ${formatDisplayDate(data.checkOut)}`;
  const payUrl = safeUrl(data.paymentUrl) || `${env.FRONTEND_URL}/booking/status/${data.referenceCode}`;

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Booking Reservation Initiated</h2>
    <p>Hello ${safeName},</p>
    <p>We received your reservation request for <strong>${safeTitle}</strong>. Your reservation reference is <strong>#${escapeHtml(data.referenceCode)}</strong>.</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600; width: 140px;">Stay Dates:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #171717;">${dates}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600;">Total Amount:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B5D45;">${formattedTotal}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B6B67; font-weight: 600;">Status:</td>
          <td style="padding: 6px 0;"><span style="display: inline-block; background-color: #FEF3C7; color: #92400E; padding: 3px 10px; border-radius: 6px; font-weight: 700; font-size: 12px;">PAYMENT PENDING</span></td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; color: #374151;">To secure your stay and receive full gate access details, please complete your payment before the reservation window expires.</p>

    <div style="margin: 28px 0;">
      <a href="${payUrl}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 26px; border-radius: 8px; text-decoration: none;">Complete Payment →</a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Reservation Initiated: ${data.propertyTitle} (#${data.referenceCode})`,
    html: emailShell("Booking Initiated", "Payment Pending", content),
    text: `Hello ${data.guestName}, your reservation #${data.referenceCode} for ${data.propertyTitle} (${dates}) is awaiting payment (${formattedTotal}). Complete payment: ${payUrl}`,
  };
}

// ─── 19. Booking Payment Failed Email ───

export function bookingPaymentFailedEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  amount: number;
  currency?: string;
  reason?: string;
  retryUrl?: string;
}): EmailPayload {
  const safeName = escapeHtml(data.guestName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const formattedTotal = formatCurrency(data.amount, data.currency || "NGN");
  const safeReason = escapeHtml(data.reason || "Transaction was declined by your financial institution or timed out.");
  const retry = safeUrl(data.retryUrl) || `${env.FRONTEND_URL}/booking/status/${data.referenceCode}`;

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #B91C1C;">Payment Not Completed</h2>
    <p>Hello ${safeName},</p>
    <p>We were unable to process your payment of <strong>${formattedTotal}</strong> for your stay at <strong>${safeTitle}</strong> (Ref: #${escapeHtml(data.referenceCode)}).</p>
    
    <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 10px; padding: 16px; margin: 20px 0; color: #991B1B;">
      <p style="margin: 0; font-size: 14px;"><strong>Payment Gateway Notice:</strong><br/>${safeReason}</p>
    </div>

    <p style="font-size: 14px; color: #374151;">Your reservation has not been confirmed. You can retry with a different debit card, Nigerian bank transfer, or USSD.</p>

    <div style="margin: 28px 0;">
      <a href="${retry}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 26px; border-radius: 8px; text-decoration: none;">Retry Payment</a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Payment Issue: Reservation #${data.referenceCode}`,
    html: emailShell("Payment Failed", "Action Required", content),
    text: `Hello ${data.guestName}, your payment for #${data.referenceCode} could not be completed (${data.reason || "Declined"}). Retry: ${retry}`,
  };
}

// ─── 20. Booking Cancelled Email ───

export function bookingCancelledEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  cancellationReason?: string;
  refundNote?: string;
}): EmailPayload {
  const safeName = escapeHtml(data.guestName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const dates = `${formatDisplayDate(data.checkIn)} → ${formatDisplayDate(data.checkOut)}`;
  const reason = escapeHtml(data.cancellationReason || "Cancelled at customer or host request.");
  const refundText = data.refundNote ? `<p style="margin: 8px 0 0 0; font-size: 13.5px; color: #065F46;"><strong>Refund Status:</strong> ${escapeHtml(data.refundNote)}</p>` : "";

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Reservation Cancelled</h2>
    <p>Hello ${safeName},</p>
    <p>Your booking for <strong>${safeTitle}</strong> (Ref: <strong>#${escapeHtml(data.referenceCode)}</strong>) scheduled for <strong>${dates}</strong> has been cancelled.</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Reason:</strong> ${reason}</p>
      ${refundText}
    </div>

    <p style="font-size: 13.5px; color: #6B6B67;">If you have any questions or require an adjustment, contact our 24/7 concierge at <a href="mailto:support@ile.ng" style="color: #0B5D45;">support@ile.ng</a>.</p>
  `;

  return {
    to: data.guestEmail,
    subject: `Reservation Cancelled: #${data.referenceCode} — ${data.propertyTitle}`,
    html: emailShell("Reservation Cancelled", "Booking Update", content),
    text: `Hello ${data.guestName}, your reservation #${data.referenceCode} for ${data.propertyTitle} (${dates}) has been cancelled. Reason: ${data.cancellationReason || "Cancelled"}`,
  };
}

// ─── 21. Booking Refund Update Email ───

export function bookingRefundEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  refundAmount: number;
  currency?: string;
  status: string;
}): EmailPayload {
  const safeName = escapeHtml(data.guestName);
  const formattedRefund = formatCurrency(data.refundAmount, data.currency || "NGN");
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Refund Update</h2>
    <p>Hello ${safeName},</p>
    <p>A refund of <strong>${formattedRefund}</strong> has been processed for your booking at <strong>${escapeHtml(data.propertyTitle)}</strong> (Ref: #${escapeHtml(data.referenceCode)}).</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #6B6B67; font-weight: 600; width: 140px;">Refund Amount:</td>
          <td style="padding: 4px 0; font-weight: 700; color: #0B5D45;">${formattedRefund}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B6B67; font-weight: 600;">Status:</td>
          <td style="padding: 4px 0; font-weight: 700; color: #171717;">${escapeHtml(data.status)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B6B67; font-weight: 600;">Processing Time:</td>
          <td style="padding: 4px 0; color: #374151;">3 to 5 business days for Nigerian bank crediting</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13.5px; color: #6B6B67;">Funds will reflect in the originating Nigerian bank account or card used during checkout.</p>
  `;

  return {
    to: data.guestEmail,
    subject: `Refund Notice: ${formattedRefund} for #${data.referenceCode}`,
    html: emailShell("Refund Processed", "Payment Update", content),
    text: `Hello ${data.guestName}, a refund of ${formattedRefund} has been processed for booking #${data.referenceCode}. Funds typically arrive in 3-5 business days.`,
  };
}

// ─── 22. Host Booking Confirmed Email (Payout & Guest Breakdown) ───

export function hostBookingConfirmedEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  referenceCode: string;
  guestName: string;
  guestPhone?: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  numberOfNights: number;
  guestCount: number;
  grossAmount: number;
  commissionAmount: number;
  netPayout: number;
  currency?: string;
}): EmailPayload {
  const safeHostName = escapeHtml(data.hostName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const safeGuest = escapeHtml(data.guestName);
  const cur = data.currency || "NGN";
  const dates = `${formatDisplayDate(data.checkIn)} → ${formatDisplayDate(data.checkOut)} (${data.numberOfNights} night${data.numberOfNights > 1 ? "s" : ""})`;

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">New Confirmed Reservation!</h2>
    <p>Hello ${safeHostName},</p>
    <p>You have a new confirmed reservation for <strong>${safeTitle}</strong> (Ref: <strong>#${escapeHtml(data.referenceCode)}</strong>). Guest payment has been verified.</p>
    
    <!-- Stay & Guest Details -->
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">Guest &amp; Stay Information</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; color: #6B6B67; font-weight: 600; width: 140px;">Guest Name:</td>
          <td style="padding: 5px 0; font-weight: 700; color: #171717;">${safeGuest}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6B6B67; font-weight: 600;">Guest Contact:</td>
          <td style="padding: 5px 0; color: #171717;">
            ${escapeHtml(data.guestEmail)}${data.guestPhone ? ` &bull; <a href="tel:${escapeHtml(data.guestPhone)}" style="color: #0B5D45; font-weight: 600; text-decoration: none;">${escapeHtml(data.guestPhone)}</a>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6B6B67; font-weight: 600;">Dates:</td>
          <td style="padding: 5px 0; font-weight: 600; color: #171717;">${dates}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6B6B67; font-weight: 600;">Guest Count:</td>
          <td style="padding: 5px 0; color: #171717;">${data.guestCount} guest${data.guestCount > 1 ? "s" : ""}</td>
        </tr>
      </table>
    </div>

    <!-- Payout Breakdown -->
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">Host Payout Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; color: #6B6B67;">Gross Booking Total:</td>
          <td style="padding: 5px 0; text-align: right; font-weight: 600;">${formatCurrency(data.grossAmount, cur)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6B6B67;">Ilé Platform Commission:</td>
          <td style="padding: 5px 0; text-align: right; color: #6B6B67;">- ${formatCurrency(data.commissionAmount, cur)}</td>
        </tr>
        <tr style="border-top: 1.5px solid #E7E5E0;">
          <td style="padding: 8px 0 0 0; font-weight: 800; color: #0B5D45; font-size: 15px;">Estimated Net Payout:</td>
          <td style="padding: 8px 0 0 0; text-align: right; font-weight: 800; color: #0B5D45; font-size: 16px;">${formatCurrency(data.netPayout, cur)}</td>
        </tr>
      </table>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #8B8B86;">Payouts are automatically scheduled to your verified Nigerian bank account after guest check-in verification.</p>
    </div>

    <div style="margin: 28px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View in Host Dashboard</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `💰 New Booking Confirmed: ${data.propertyTitle} (${formatCurrency(data.netPayout, cur)} net)`,
    html: emailShell("Booking Confirmed", "Host Notification", content),
    text: `Hello ${data.hostName}, new confirmed booking for ${data.propertyTitle} from ${data.guestName} (${dates}). Net payout: ${formatCurrency(data.netPayout, cur)}. View dashboard: ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 23. Host Upcoming Arrival Reminder ───

export function hostUpcomingArrivalEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  referenceCode: string;
  guestName: string;
  guestPhone?: string;
  guestEmail: string;
  checkIn: string;
  checkInTime?: string;
  checkOut: string;
  guestCount: number;
}): EmailPayload {
  const safeHost = escapeHtml(data.hostName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const safeGuest = escapeHtml(data.guestName);
  const checkInDisplay = formatDisplayDate(data.checkIn);
  const time = data.checkInTime || "2:00 PM";

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Guest Arrival Reminder</h2>
    <p>Hello ${safeHost},</p>
    <p>This is a reminder that <strong>${safeGuest}</strong> is scheduled to arrive tomorrow, <strong>${checkInDisplay}</strong> (from ${escapeHtml(time)}) at <strong>${safeTitle}</strong> (Ref: #${escapeHtml(data.referenceCode)}).</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="font-size: 14px; margin: 0 0 10px 0; color: #0B5D45; text-transform: uppercase;">Host Readiness Checklist</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #374151; line-height: 1.8;">
        <li>Confirm primary and backup power (generator / solar inverter) are operational.</li>
        <li>Verify water supply and pump functioning.</li>
        <li>Ensure gate security and estate access codes are active.</li>
        <li>Inspect unit cleanliness and fresh linens.</li>
      </ul>
    </div>

    <div style="background-color: #F8F9FA; border-left: 4px solid #0B5D45; padding: 14px 18px; margin: 20px 0; border-radius: 4px; font-size: 13.5px;">
      <p style="margin: 0; font-weight: 600; color: #171717;">Guest Contact:</p>
      <p style="margin: 4px 0 0 0; color: #374151;">${safeGuest} &bull; ${escapeHtml(data.guestEmail)}${data.guestPhone ? ` &bull; <a href="tel:${escapeHtml(data.guestPhone)}" style="color: #0B5D45; font-weight: 600;">${escapeHtml(data.guestPhone)}</a>` : ""}</p>
    </div>

    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Open Host Dashboard</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `Arrival Tomorrow: ${data.guestName} checking in to ${data.propertyTitle}`,
    html: emailShell("Upcoming Arrival", "Guest Check-in Reminder", content),
    text: `Reminder: ${data.guestName} arrives tomorrow (${checkInDisplay}) at ${data.propertyTitle}. Check dashboard: ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 24. Host New Review Received Email ───

export function hostNewReviewEmail(data: {
  hostName: string;
  hostEmail: string;
  propertyTitle: string;
  guestName: string;
  rating: number;
  reviewTitle?: string;
  reviewBody?: string;
}): EmailPayload {
  const safeHost = escapeHtml(data.hostName);
  const safeTitle = escapeHtml(data.propertyTitle);
  const safeGuest = escapeHtml(data.guestName);
  const stars = "★".repeat(Math.min(5, Math.max(1, Math.round(data.rating)))) + "☆".repeat(Math.max(0, 5 - Math.round(data.rating)));
  const reviewBody = data.reviewBody ? escapeHtml(data.reviewBody) : "No written comment provided.";

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">New Guest Review Received!</h2>
    <p>Hello ${safeHost},</p>
    <p><strong>${safeGuest}</strong> has shared a review for their stay at <strong>${safeTitle}</strong>:</p>
    
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="color: #F59E0B; font-size: 18px; margin-bottom: 8px; letter-spacing: 2px;">${stars} <span style="font-size: 14px; font-weight: 700; color: #171717;">(${data.rating} / 5)</span></div>
      ${data.reviewTitle ? `<p style="margin: 0 0 6px 0; font-weight: 700; font-size: 15px; color: #171717;">${escapeHtml(data.reviewTitle)}</p>` : ""}
      <p style="margin: 0; font-size: 14px; color: #374151; font-style: italic;">&ldquo;${reviewBody}&rdquo;</p>
    </div>

    <p style="font-size: 13.5px; color: #6B6B67;">Responding promptly to reviews showcases your hospitality and helps attract more verified reservations.</p>

    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/host/dashboard" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Reply to Review in Dashboard</a>
    </div>
  `;

  return {
    to: data.hostEmail,
    subject: `⭐ New ${data.rating}-Star Review for ${data.propertyTitle}`,
    html: emailShell("New Review", "Guest Feedback", content),
    text: `New review for ${data.propertyTitle} by ${data.guestName}: ${data.rating}/5 stars. "${data.reviewBody || ""}". Manage in dashboard: ${env.FRONTEND_URL}/host/dashboard`,
  };
}

// ─── 25. Host Payout Disbursed ───

export function hostPayoutDisbursedEmail(data: {
  hostName: string;
  hostEmail: string;
  amount: number;
  bankName?: string;
  accountNumberMasked?: string;
  transferRef?: string;
  currency?: string;
}): EmailPayload {
  const safeHost = escapeHtml(data.hostName);
  const formattedAmount = formatCurrency(data.amount, data.currency || "NGN");
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #0B5D45;">Host Payout Disbursed</h2>
    <p>Hello ${safeHost},</p>
    <p>A payout of <strong>${formattedAmount}</strong> has been transferred to your Nigerian bank account.</p>
    <div style="background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B6B67;">Amount Disbursed:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0B5D45;">${formattedAmount}</td>
        </tr>
        ${data.bankName ? `
        <tr>
          <td style="padding: 6px 0; color: #6B6B67;">Bank:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600;">${escapeHtml(data.bankName)}</td>
        </tr>` : ""}
        ${data.accountNumberMasked ? `
        <tr>
          <td style="padding: 6px 0; color: #6B6B67;">Account:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600;">${escapeHtml(data.accountNumberMasked)}</td>
        </tr>` : ""}
        ${data.transferRef ? `
        <tr>
          <td style="padding: 6px 0; color: #6B6B67;">NIP / Transfer Ref:</td>
          <td style="padding: 6px 0; text-align: right; font-mono; font-size: 13px;">${escapeHtml(data.transferRef)}</td>
        </tr>` : ""}
      </table>
    </div>
    <p style="font-size: 13px; color: #6B6B67;">Funds typically reflect in your account within minutes via NIBSS Instant Payments (NIP).</p>
  `;

  return {
    to: data.hostEmail,
    subject: `💰 Payout Disbursed: ${formattedAmount}`,
    html: emailShell("Payout Disbursed", "Host Earnings", content),
    text: `Hello ${data.hostName}, a payout of ${formattedAmount} has been disbursed to your account. Transfer ref: ${data.transferRef || "Completed"}.`,
  };
}

// ─── Dispatch Function ───

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const provider = env.EMAIL_PROVIDER;

  if (provider === "console" || !env.EMAIL_API_KEY) {
    console.log(`\n📧 [Email Mock] To: ${payload.to} | Subject: ${payload.subject}`);
    return true;
  }

  if (provider === "resend") {
    return sendViaResend(payload);
  }

  console.warn(`[Email] Unknown provider: ${provider}, falling back to console`);
  return true;
}

async function sendViaResend(payload: EmailPayload): Promise<boolean> {
  try {
    const fromAddress = env.EMAIL_FROM || "noreply@notifications.9jaroommate.com";
    console.log(`[Email] Sending via Resend → To: ${payload.to} | Subject: ${payload.subject} | From: ${fromAddress}`);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const resBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[Email] Resend error: HTTP ${res.status} — ${JSON.stringify(resBody)}`);
      return false;
    }

    console.log(`[Email] Resend delivered ✓ id=${(resBody as any).id || "unknown"} → ${payload.to}`);
    return true;
  } catch (err) {
    console.error("[Email] Resend network error:", err);
    return false;
  }
}

/**
 * Health check connectivity probe for Resend without leaking secrets
 */
export async function testResendConnectivity(): Promise<{ connected: boolean; domain: string; error?: string }> {
  const domain = env.RESEND_DOMAIN || "notifications.9jaroommate.com";
  if (!env.EMAIL_API_KEY) {
    return { connected: false, domain, error: "EMAIL_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}` },
    });

    if (res.ok) {
      return { connected: true, domain };
    }

    return { connected: false, domain, error: `Resend HTTP ${res.status}` };
  } catch (err: any) {
    return { connected: false, domain, error: err.message || "Failed to reach Resend API" };
  }
}
