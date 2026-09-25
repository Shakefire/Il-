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
  accessToken?: string;
  address?: string;
  unitNumber?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  accessGateCode?: string;
  hostName?: string;
  hostPhone?: string;
}): EmailPayload {
  const bookingUrl = `${env.FRONTEND_URL}/trips`;

  const fullAddress = [
    data.address,
    data.unitNumber ? `Unit / Apt ${data.unitNumber}` : "",
    data.city || "Abuja",
    data.state || "FCT",
    "Nigeria",
  ].filter(Boolean).join(", ");

  const mapQuery = data.latitude && data.longitude
    ? `${data.latitude},${data.longitude}`
    : encodeURIComponent(fullAddress);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const cleanPhone = (data.hostPhone || "+234 912 202 9904").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "";

  const content = `
    <h2 style="font-size: 22px; margin-top: 0; color: #171717; font-weight: 800;">Reservation Confirmed &amp; Secured</h2>
    <p style="font-size: 15px; color: #4A4A45; margin: 4px 0 16px 0;">Hello <strong>${data.guestName}</strong>,</p>
    <p style="font-size: 14.5px; color: #4A4A45; line-height: 1.6;">
      Your payment has been successfully processed and your stay at <strong>${data.propertyTitle}</strong> is locked in. Below are your complete reservation details, arrival address, and gate clearance:
    </p>

    <!-- SECTION 1: Booking & Guest Summary Card -->
    <div style="background-color: #F8F7F4; border: 1.5px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="margin-bottom: 12px; border-bottom: 1px solid #EAE8E3; padding-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">Reservation Summary</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Booking Reference</td>
          <td style="padding: 8px 0; font-weight: 800; text-align: right; color: #0B5D45; font-family: monospace; font-size: 15px;">${data.referenceCode}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Primary Guest</td>
          <td style="padding: 8px 0; font-weight: 700; text-align: right; color: #171717;">${data.guestName}</td>
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
          <td style="padding: 8px 0; font-weight: 700; text-align: right; color: #171717;">${data.checkIn}</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAE8E3;">
          <td style="padding: 8px 0; color: #6B6B67;">Check-out Date</td>
          <td style="padding: 8px 0; font-weight: 700; text-align: right; color: #171717;">${data.checkOut}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 4px 0; font-weight: 800; color: #171717; font-size: 15px;">Total Paid</td>
          <td style="padding: 12px 0 4px 0; font-weight: 800; font-size: 19px; text-align: right; color: #0B5D45;">₦${data.totalAmount.toLocaleString("en-NG")}</td>
        </tr>
      </table>
    </div>

    <!-- SECTION 2: Exact Location, Address & Google Maps Pin -->
    <div style="background-color: #FFFFFF; border: 1.5px solid #0B5D45; border-radius: 12px; padding: 22px; margin: 20px 0;">
      <div style="margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">📍 Exact Physical Address &amp; Location Pin</span>
      </div>
      <p style="margin: 0; font-size: 16px; font-weight: 800; color: #171717; line-height: 1.4;">
        ${fullAddress}
      </p>
      ${data.unitNumber ? `<p style="margin: 4px 0 0 0; font-size: 13.5px; color: #4A4A45;">Apartment / Plot Details: <strong>${data.unitNumber}</strong></p>` : ""}
      
      <!-- Interactive Google Maps Pin Button -->
      <div style="margin-top: 16px; padding: 14px; background-color: #FAFAF8; border: 1px solid #E7E5E0; border-radius: 10px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #6B6B67;">
          Open live Google Maps to view exact location pin and check live travel distance:
        </p>
        <a href="${googleMapsUrl}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 13.5px; padding: 11px 22px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(11,93,69,0.2);">
          🗺️ Open in Google Maps (View Exact Pin &amp; Live Distance)
        </a>
      </div>
    </div>

    <!-- SECTION 3: Estate Gate Clearance & Guide Contact -->
    <div style="background-color: #EDF3F0; border: 1.5px solid #0B5D45; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <div style="margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">🔑 Estate Gate Pass &amp; Dedicated Arrival Guide</span>
      </div>
      
      <div style="margin: 10px 0; background-color: #FFFFFF; border: 1px solid #C3E2D8; border-radius: 10px; padding: 14px 18px; display: inline-block;">
        <span style="font-size: 11px; color: #6B6B67; display: block; font-weight: 600; margin-bottom: 2px;">Estate Security Gate Pass Code:</span>
        <span style="font-family: monospace; font-size: 24px; font-weight: 800; color: #0B5D45; letter-spacing: 3px;">${data.accessGateCode || "GATE-CLEARED"}</span>
      </div>

      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #C3E2D8; font-size: 13.5px; color: #171717;">
        <p style="margin: 0 0 4px 0; font-weight: 700;">Assigned Arrival Guide / Host: <span style="font-weight: 600; color: #0B5D45;">${data.hostName || "Dedicated Ilé Host"}</span></p>
        <p style="margin: 0 0 8px 0;">Guide Helpline: <a href="tel:${cleanPhone}" style="color: #171717; font-weight: 700; text-decoration: none;">${data.hostPhone || "+234 912 202 9904"}</a></p>
        ${waLink ? `
          <a href="${waLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-weight: 700; font-size: 12.5px; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
            💬 Chat with Guide on WhatsApp
          </a>
        ` : ""}
      </div>
    </div>

    <!-- Trips Portal CTA -->
    <div style="margin: 28px 0; text-align: center;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #171717; color: #FFFFFF; font-weight: 700; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-size: 14.5px;">
        View Reservation in My Trips Portal →
      </a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Booking Confirmed & Gate Pass: ${data.propertyTitle} (${data.referenceCode})`,
    html: emailShell("Booking Confirmed", "Your reservation & clearance pass", content),
    text: `Booking Confirmed — ${data.propertyTitle}\n\nReference: ${data.referenceCode}\nGuest: ${data.guestName}\nType: ${data.propertyType || "Residence"}\nGuests: ${data.guestCount || 1}\nCheck-in: ${data.checkIn}\nCheck-out: ${data.checkOut}\nTotal: ₦${data.totalAmount.toLocaleString("en-NG")}\nAddress: ${fullAddress}\nGate Code: ${data.accessGateCode || "GATE-CLEARED"}\nHost Phone: ${data.hostPhone || "+234 912 202 9904"}\nMap: ${googleMapsUrl}\n\nView trips: ${bookingUrl}`,
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
    data.city || "Abuja",
    data.state || "FCT",
    "Nigeria",
  ].filter(Boolean).join(", ");

  const mapQuery = data.latitude && data.longitude
    ? `${data.latitude},${data.longitude}`
    : encodeURIComponent(fullAddress);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
  const cleanPhone = (data.hostPhone || "+234 912 202 9904").replace(/[^\d+]/g, "");
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : "";

  const content = `
    <h2 style="font-size: 22px; margin-top: 0; color: #171717; font-weight: 800;">Gate Pass &amp; Check-In Access Details</h2>
    <p style="font-size: 15px; color: #4A4A45; margin: 4px 0 16px 0;">Hello <strong>${data.guestName}</strong>,</p>
    <p style="font-size: 14.5px; color: #4A4A45; line-height: 1.6;">
      Your payment for <strong>${data.propertyTitle}</strong> has been verified. Below is your official check-in gate clearance, physical street address, and assigned Arrival Guide contact:
    </p>

    <!-- SECTION 1: Exact Physical Address & Map Pin -->
    <div style="background-color: #F8F7F4; border: 1.5px solid #0B5D45; border-radius: 12px; padding: 22px; margin: 20px 0;">
      <div style="margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">1. Exact Property Address</span>
      </div>
      <p style="margin: 0; font-size: 16px; font-weight: 800; color: #171717; line-height: 1.4;">
        ${fullAddress}
      </p>
      ${data.unitNumber ? `<p style="margin: 6px 0 0 0; font-size: 13.5px; color: #4A4A45;">House / Plot / Unit: <strong>${data.unitNumber}</strong></p>` : ""}

      <!-- Map Pin Navigation Button -->
      <div style="margin-top: 16px; padding: 14px; background-color: #FFFFFF; border: 1px solid #EAE8E3; border-radius: 10px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #6B6B67;">
          Use Google Maps for turn-by-turn navigation and live distance from your current location:
        </p>
        <a href="${googleMapsUrl}" target="_blank" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; font-size: 13.5px; padding: 11px 22px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(11,93,69,0.2);">
          📍 Open in Google Maps (View Exact Pin &amp; Live Distance)
        </a>
      </div>
    </div>

    <!-- SECTION 2: Estate Clearance & Gate Pass Code -->
    <div style="background-color: #EDF3F0; border: 1.5px solid #0B5D45; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">2. Estate Gate Clearance &amp; Access Code</span>
      <div style="margin: 12px 0 8px 0; background-color: #FFFFFF; border: 1px solid #C3E2D8; border-radius: 8px; padding: 12px 18px; display: inline-block;">
        <span style="font-size: 11px; color: #6B6B67; display: block; margin-bottom: 2px;">Show this code at estate security gate:</span>
        <span style="font-family: monospace; font-size: 24px; font-weight: 800; color: #0B5D45; letter-spacing: 3px;">${data.accessGateCode || "GATE-CLEARED"}</span>
      </div>
      <p style="margin: 8px 0 0 0; font-size: 13.5px; color: #171717; line-height: 1.5; white-space: pre-line;">
        ${data.accessInstructions}
      </p>
    </div>

    <!-- SECTION 3: Host / Arrival Guide Contact -->
    <div style="background-color: #FFFFFF; border: 1px solid #E7E5E0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <span style="font-size: 11px; font-weight: 800; color: #0B5D45; text-transform: uppercase; letter-spacing: 0.5px;">3. Assigned Arrival Guide &amp; Host Contact</span>
      <p style="margin: 6px 0 2px 0; font-size: 16px; font-weight: 700; color: #171717;">
        ${data.hostName || "Dedicated Property Host"}
      </p>
      <p style="margin: 4px 0 10px 0; font-size: 14px; color: #4A4A45;">
        Direct Helpline: <a href="tel:${cleanPhone}" style="color: #0B5D45; font-weight: 700; text-decoration: none;">${data.hostPhone || "+234 912 202 9904"}</a>
      </p>
      ${waLink ? `
        <a href="${waLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-weight: 700; font-size: 12.5px; padding: 8px 18px; border-radius: 6px; text-decoration: none;">
          💬 Chat with Host / Guide on WhatsApp
        </a>
      ` : ""}
    </div>

    <div style="margin: 28px 0; text-align: center;">
      <a href="${env.FRONTEND_URL}/trips" style="display: inline-block; background-color: #0B5D45; color: #FFFFFF; font-weight: 700; padding: 13px 28px; border-radius: 10px; text-decoration: none; font-size: 14px;">Open Gate Pass on My Phone →</a>
    </div>
  `;

  return {
    to: data.guestEmail,
    subject: `Gate Pass & Check-In Details — ${data.referenceCode}`,
    html: emailShell("Access Clearance", "Check-in instructions and address", content),
    text: `Gate Pass & Check-In Details\n\nReference: ${data.referenceCode}\nAddress: ${fullAddress}\nGate Code: ${data.accessGateCode || "GATE-CLEARED"}\nHost Phone: ${data.hostPhone || "+234 912 202 9904"}\nMap: ${googleMapsUrl}`,
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
