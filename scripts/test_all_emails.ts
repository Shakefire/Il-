/**
 * Test script to generate and dispatch ALL transactional email templates to shakefire@protonmail.com
 */
import {
  welcomeEmail,
  passwordResetEmail,
  passwordResetSuccessEmail,
  emailOtpEmail,
  ownerEmailOtpEmail,
  hostWelcomeEmail,
  hostApplicationSubmittedEmail,
  hostApplicationApprovedEmail,
  hostApplicationRejectedEmail,
  hostApplicationInfoRequestedEmail,
  hostPropertySubmittedEmail,
  propertyReviewStatusEmail,
  listingPublishedEmail,
  listingSuspendedEmail,
  hostAccountSuspendedEmail,
  bookingInitiatedEmail,
  bookingConfirmationEmail,
  bookingAccessPassEmail,
  bookingPaymentFailedEmail,
  bookingCancelledEmail,
  bookingRefundEmail,
  hostBookingConfirmedEmail,
  hostUpcomingArrivalEmail,
  hostNewReviewEmail,
  sendEmail,
  EmailPayload,
} from "../backend/src/modules/notifications/notifications.service";

const TARGET_EMAIL = "shakefire@protonmail.com";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting Transactional Email Test Suite`);
  console.log(`🎯 Recipient Target: ${TARGET_EMAIL}`);
  console.log(`======================================================\n`);

  const emails: { name: string; payload: EmailPayload }[] = [
    {
      name: "1. Welcome Email (Guest)",
      payload: welcomeEmail({
        name: "Test User",
        email: TARGET_EMAIL,
      }),
    },
    {
      name: "2. Password Reset Email",
      payload: passwordResetEmail({
        name: "Test User",
        email: TARGET_EMAIL,
        resetUrl: "https://ilestays.ng/reset-password?token=sample_reset_token_12345",
      }),
    },
    {
      name: "3. Password Reset Success Email",
      payload: passwordResetSuccessEmail({
        name: "Test User",
        email: TARGET_EMAIL,
      }),
    },
    {
      name: "4. Email OTP Verification",
      payload: emailOtpEmail({
        name: "Test User",
        email: TARGET_EMAIL,
        code: "849201",
        purpose: "Email Verification",
      }),
    },
    {
      name: "5. Host Owner Email OTP",
      payload: ownerEmailOtpEmail({
        name: "Test Partner",
        email: TARGET_EMAIL,
        code: "610293",
      }),
    },
    {
      name: "6. Host Welcome Email",
      payload: hostWelcomeEmail({
        name: "Test Partner",
        email: TARGET_EMAIL,
      }),
    },
    {
      name: "7. Host Application Submitted (KYC Under Review)",
      payload: hostApplicationSubmittedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
      }),
    },
    {
      name: "8. Host Application Approved (KYC Approved)",
      payload: hostApplicationApprovedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
      }),
    },
    {
      name: "9. Host Application Rejected",
      payload: hostApplicationRejectedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        reason: "The submitted government ID scan was blurry and expired. Please upload a clear valid NIN slip or international passport.",
      }),
    },
    {
      name: "10. Host Application Info Requested",
      payload: hostApplicationInfoRequestedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        instructions: "Please provide a more recent utility bill showing your current residential address matching your proof of ownership.",
      }),
    },
    {
      name: "11. Host Property Submitted",
      payload: hostPropertySubmittedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Maitama Hilltop Penthouse",
        propertyId: "prop_sample_12345",
      }),
    },
    {
      name: "12. Property Review Status (Inspection Approved)",
      payload: propertyReviewStatusEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Maitama Hilltop Penthouse",
        status: "APPROVED",
        reason: "Physical inspection passed with flying colors. Solar inverter backup and water pressure confirmed.",
      }),
    },
    {
      name: "13. Listing Published Directly (Post-KYC)",
      payload: listingPublishedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "Contemporary Victoria Island Waterfront Villa",
        propertyId: "prop_vi_waterfront_987",
        nightlyPrice: 85000,
        city: "Lagos",
        neighborhood: "Victoria Island",
        currency: "NGN",
      }),
    },
    {
      name: "14. Listing Suspended by Admin",
      payload: listingSuspendedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Maitama Hilltop Penthouse",
        reason: "Temporary power generator maintenance reported by estate management. Listing paused until inspection report received.",
      }),
    },
    {
      name: "15. Host Account Suspended",
      payload: hostAccountSuspendedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        reason: "Compliance audit required regarding updated bank settlement account documentation.",
      }),
    },
    {
      name: "16. Booking Initiated (Pending Payment)",
      payload: bookingInitiatedEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "Contemporary Victoria Island Waterfront Villa",
        referenceCode: "ILE-2026-VIC-441",
        checkIn: "2026-11-10",
        checkOut: "2026-11-14",
        totalAmount: 342000,
        paymentUrl: "https://ilestays.ng/stay/vi-waterfront-villa",
      }),
    },
    {
      name: "17. Booking Confirmation (Guest Confirmed)",
      payload: bookingConfirmationEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
        numberOfNights: 4,
        nightlyPrice: 75000,
        totalAmount: 302000,
        serviceFee: 2000,
        bookingStatus: "CONFIRMED",
        paymentReference: "pstk_test_ref_9921",
        city: "Abuja",
        neighborhood: "Maitama",
        powerType: "24/7 Dedicated Solar + Inverter + 60kVA Generator",
        currency: "NGN",
      }),
    },
    {
      name: "18. Arrival Guide & Gate Clearance Access Pass",
      payload: bookingAccessPassEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
        address: "Plot 412, Aguiyi Ironsi Way, Maitama, Abuja",
        city: "Abuja",
        neighborhood: "Maitama",
        accessGateCode: "GATE-PASS-8842",
        accessInstructions: "Inform security guard at Main Gate of reservation under Ilé. Use gate clearance code GATE-PASS-8842. The digital lockbox code for Unit 4B is 4821#.",
      }),
    },
    {
      name: "19. Booking Payment Failed",
      payload: bookingPaymentFailedEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        amount: 302000,
        retryUrl: "https://ilestays.ng/stay/the-hibiscus-penthouse",
        reason: "Card payment declined by issuing bank (Insufficient funds / transaction limit exceeded).",
      }),
    },
    {
      name: "20. Booking Cancelled",
      payload: bookingCancelledEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
        refundNote: "Refund of ₦300,000 processed to original card.",
      }),
    },
    {
      name: "21. Booking Refund Issued",
      payload: bookingRefundEmail({
        guestName: "Traveler Guest",
        guestEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        refundAmount: 300000,
        status: "COMPLETED",
      }),
    },
    {
      name: "22. Host Payout Notification (New Confirmed Booking)",
      payload: hostBookingConfirmedEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
        numberOfNights: 4,
        guestName: "Traveler Guest",
        guestEmail: "guest@example.com",
        guestPhone: "+2348031234567",
        guestCount: 2,
        grossAmount: 300000,
        commissionAmount: 30000,
        netPayout: 270000,
        currency: "NGN",
      }),
    },
    {
      name: "23. Host Upcoming Arrival Alert",
      payload: hostUpcomingArrivalEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        referenceCode: "ILE-2026-HIB-789",
        checkIn: "2026-11-01",
        checkOut: "2026-11-05",
        guestName: "Traveler Guest",
        guestEmail: "guest@example.com",
        guestCount: 2,
        guestPhone: "+2348031234567",
      }),
    },
    {
      name: "24. Host New Guest Review Received",
      payload: hostNewReviewEmail({
        hostName: "Test Partner",
        hostEmail: TARGET_EMAIL,
        propertyTitle: "The Hibiscus Penthouse",
        rating: 5,
        guestName: "Traveler Guest",
        reviewBody: "Incredible stay! The power was truly 24/7 without a second of interruption, super fast internet, and the host was very responsive.",
      }),
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < emails.length; i++) {
    const item = emails[i];
    item.payload.to = TARGET_EMAIL;

    console.log(`[${i + 1}/${emails.length}] Sending "${item.name}"...`);
    try {
      const ok = await sendEmail(item.payload);
      if (ok) {
        console.log(`   ✅ Sent successfully! (Subject: "${item.payload.subject}")`);
        successCount++;
      } else {
        console.error(`   ❌ Failed to send "${item.name}"`);
        failCount++;
      }
    } catch (err: any) {
      console.error(`   ❌ Exception sending "${item.name}":`, err?.message || err);
      failCount++;
    }

    await sleep(800);
  }

  console.log(`\n======================================================`);
  console.log(`🏁 Email Dispatch Complete!`);
  console.log(`📊 Total: ${emails.length} | Success: ${successCount} | Failed: ${failCount}`);
  console.log(`📬 Delivered to: ${TARGET_EMAIL}`);
  console.log(`======================================================\n`);
}

run().catch(console.error);
