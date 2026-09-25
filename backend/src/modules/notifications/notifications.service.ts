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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #F8F7F4; padding: 24px;">
      <div style="background-color: #0B5D45; padding: 28px 32px; border-radius: 14px 14px 0 0; text-align: left;">
        <h1 style="color: #FFFFFF; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Ilé</h1>
        <p style="color: #C3E2D8; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">${subtitle}</p>
      </div>
      <div style="padding: 32px; background-color: #FFFFFF; border: 1px solid #E7E5E0; border-top: none; border-radius: 0 0 14px 14px; line-height: 1.6; color: #171717;">
        ${bodyContent}
        <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #F0EFEB; font-size: 12.5px; color: #6B6B67; text-align: center; line-height: 1.6;">
          <p style="margin: 0; font-weight: 700; color: #171717;">Ilé Nigerian Accommodation &amp; Shortlet Marketplace</p>
          <p style="margin: 4px 0 0 0;">Abuja • Lagos • Nationwide Verified Stays</p>
          <div style="margin: 14px 0 8px 0; padding: 12px 18px; background-color: #FAFAF8; border: 1px solid #EAE8E3; border-radius: 10px; display: inline-block; text-align: left;">
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #0B5D45;">Ilé Platform Support &amp; Concierge</p>
            <p style="margin: 2px 0 0 0;">Email: <a href="mailto:support@ile.ng" style="color: #0B5D45; font-weight: 600; text-decoration: underline;">support@ile.ng</a></p>
            <p style="margin: 2px 0 0 0;">24/7 Helpline: <a href="tel:+2348004537829" style="color: #171717; font-weight: 600; text-decoration: none;">+234 800 453 7829</a> · <a href="tel:+2349122029904" style="color: #171717; font-weight: 600; text-decoration: none;">+234 912 202 9904</a></p>
          </div>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #9B9B97;">© 2026 Ilé Technologies Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;
}

// ─── 1. Account Welcome Email ───

export function welcomeEmail(data: { name: string; email: string }): EmailPayload {
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Welcome to Ilé, ${data.name}!</h2>
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
  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Password Reset Request</h2>
    <p>Hello ${data.name},</p>
    <p>We received a request to reset your password for your Ilé account. Click the button below to choose a new password:</p>
    <div style="margin: 24px 0;">
      <a href="${data.resetUrl}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Reset Password</a>
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

export function bookingConfirmationEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  propertyType?: string;
  guestCount?: number;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  accessToken: string;
}): EmailPayload {
  const bookingUrl = `${env.FRONTEND_URL}/trips`;

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Reservation Confirmed &amp; Verified</h2>
    <p>Hello ${data.guestName},</p>
    <p>Your reservation for <strong>${data.propertyTitle}</strong> is locked in and confirmed.</p>

    <div style="background-color: #F8F7F4; border: 1px solid #E7E5E0; border-radius: 12px; padding: 18px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Booking Reference</td>
          <td style="padding: 8px 0; font-weight: 700; text-align: right; color: #0B5D45; font-family: monospace; font-size: 15px;">${data.referenceCode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Guest Name</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #171717;">${data.guestName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Apartment Category</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #171717;">${data.propertyType || "Serviced Residence"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Number of Guests</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #171717;">${data.guestCount || 1} ${(data.guestCount || 1) === 1 ? "Guest" : "Guests"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Check-in Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #171717;">${data.checkIn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Check-out Date</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #171717;">${data.checkOut}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 4px 0; font-weight: 700; color: #171717; font-size: 15px;">Total Paid</td>
          <td style="padding: 12px 0 4px 0; font-weight: 800; font-size: 18px; text-align: right; color: #0B5D45;">₦${data.totalAmount.toLocaleString("en-NG")}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13.5px; color: #6B6B67;">Your digital gate clearance pass and exact street navigation details have also been dispatched to your email and are accessible anytime in your trips portal.</p>

    <div style="margin: 24px 0;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 26px; border-radius: 10px; text-decoration: none; font-size: 14px;">View Reservation in My Trips →</a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Booking Confirmed: ${data.propertyTitle} (${data.referenceCode})`,
    html: emailShell("Booking Confirmed", "Your reservation is locked in", content),
    text: `Booking Confirmed — ${data.propertyTitle}\n\nReference: ${data.referenceCode}\nGuest: ${data.guestName}\nType: ${data.propertyType || "Residence"}\nGuests: ${data.guestCount || 1}\nCheck-in: ${data.checkIn}\nCheck-out: ${data.checkOut}\nTotal: ₦${data.totalAmount.toLocaleString("en-NG")}\n\nView trips: ${bookingUrl}`,
  };
}

// ─── 4. Booking Access Pass & Gate Clearance Email ───

export function bookingAccessPassEmail(data: {
  guestName: string;
  guestEmail: string;
  propertyTitle: string;
  referenceCode: string;
  checkIn: string;
  checkOut: string;
  address: string;
  unitNumber?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  accessInstructions: string;
  accessGateCode?: string;
  hostName?: string;
  hostPhone?: string;
}): EmailPayload {
  const fullAddress = [
    data.address,
    data.unitNumber ? `Unit / Apt: ${data.unitNumber}` : "",
    data.city,
    data.state,
    "Nigeria",
  ].filter(Boolean).join(", ");

  const mapQuery = data.latitude && data.longitude
    ? `${data.latitude},${data.longitude}`
    : encodeURIComponent(fullAddress);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const cleanPhone = (data.hostPhone || "").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "";

  const content = `
    <h2 style="font-size: 20px; margin-top: 0; color: #171717;">Gate Pass &amp; Check-In Access Details</h2>
    <p>Hello ${data.guestName},</p>
    <p>Your payment for <strong>${data.propertyTitle}</strong> has been verified. Below are your unquarantined check-in clearance, physical address, and dedicated host contact details:</p>

    <!-- SECTION 1: Exact Physical Address & Map Pin -->
    <div style="background-color: #F8F7F4; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 700; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">1. Exact Property Address</span>
      </div>
      <p style="margin: 0; font-size: 16px; font-weight: 700; color: #171717; line-height: 1.4;">
        ${fullAddress}
      </p>
      ${data.unitNumber ? `<p style="margin: 4px 0 0 0; font-size: 13.5px; color: #6B6B67;">Apartment / Suite: <strong>${data.unitNumber}</strong></p>` : ""}

      <!-- Map Pin Navigation Button -->
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #EAE8E3;">
        <a href="${googleMapsUrl}" target="_blank" style="display: inline-block; background-color: #FFFFFF; color: #0B5D45; border: 1.5px solid #0B5D45; font-weight: 600; font-size: 13px; padding: 9px 18px; border-radius: 8px; text-decoration: none;">
          📍 Open in Google Maps (View Exact Pin &amp; Live Distance)
        </a>
      </div>
    </div>

    <!-- SECTION 2: Estate Clearance & Gate Pass Code -->
    <div style="background-color: #EDF3F0; border: 1.5px solid #0B5D45; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <span style="font-size: 11px; font-weight: 700; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">2. Estate Gate Clearance &amp; Access Code</span>
      ${data.accessGateCode ? `
        <div style="margin: 12px 0 8px 0; background-color: #FFFFFF; border: 1px solid #C3E2D8; border-radius: 8px; padding: 12px 16px; display: inline-block;">
          <span style="font-size: 11px; color: #6B6B67; display: block; margin-bottom: 2px;">Show this code at estate security gate:</span>
          <span style="font-family: monospace; font-size: 22px; font-weight: 800; color: #0B5D45; letter-spacing: 2px;">${data.accessGateCode}</span>
        </div>
      ` : ""}
      <p style="margin: 8px 0 0 0; font-size: 13.5px; color: #171717; line-height: 1.5; white-space: pre-line;">
        ${data.accessInstructions}
      </p>
    </div>

    <!-- SECTION 3: Host / Arrival Guide Contact -->
    <div style="background-color: #FFFFFF; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <span style="font-size: 11px; font-weight: 700; color: #6B6B67; text-transform: uppercase; letter-spacing: 0.5px;">3. Assigned Host &amp; Arrival Guide</span>
      <p style="margin: 6px 0 2px 0; font-size: 15px; font-weight: 700; color: #171717;">
        ${data.hostName || "Dedicated Property Host"}
      </p>
      ${data.hostPhone ? `
        <p style="margin: 4px 0 10px 0; font-size: 13.5px; color: #6B6B67;">
          Direct Line: <a href="tel:${cleanPhone}" style="color: #0B5D45; font-weight: 700; text-decoration: none;">${data.hostPhone}</a>
        </p>
        ${waLink ? `
          <a href="${waLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-weight: 600; font-size: 12.5px; padding: 8px 16px; border-radius: 8px; text-decoration: none;">
            💬 Chat with Host on WhatsApp
          </a>
        ` : ""}
      ` : `<p style="margin: 4px 0 0 0; font-size: 13px; color: #8B8B86;">Host contact activated. Check-in assistance available on arrival.</p>`}
    </div>

    <div style="margin: 24px 0;">
      <a href="${env.FRONTEND_URL}/trips" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 600; padding: 12px 26px; border-radius: 10px; text-decoration: none; font-size: 14px;">Open Gate Pass on My Phone →</a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Gate Pass & Check-In Details — ${data.referenceCode}`,
    html: emailShell("Access Clearance", "Check-in instructions and address", content),
    text: `Gate Pass & Check-In Details\n\nReference: ${data.referenceCode}\nAddress: ${fullAddress}\nGate Code: ${data.accessGateCode || "None"}\nHost Phone: ${data.hostPhone || "Available on platform"}\nMap: ${googleMapsUrl}`,
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

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Email] Resend error: ${res.status} — ${err}`);
      return false;
    }

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
