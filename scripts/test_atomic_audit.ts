/**
 * Comprehensive Atomic Integration Audit Test Suite
 * Tests every requirement end-to-end:
 * Auth -> Verification -> Onboarding -> Document Upload -> Admin Review -> Gating -> Suspension
 */

import { initAndSeedDb } from "../backend/src/db/seed";
import { authService } from "../backend/src/modules/auth/auth.service";
import { hostsService } from "../backend/src/modules/hosts/hosts.service";
import { adminService } from "../backend/src/modules/admin/admin.service";
import { uploadImage } from "../backend/src/modules/uploads/uploads.service";
import { getDb, schema } from "../backend/src/db/client";
import { eq } from "drizzle-orm";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testId: string, desc: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testId}: ${desc}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testId}: ${desc}`);
    failCount++;
    throw new Error(`Test failed: ${testId} - ${desc}`);
  }
}

async function runAudit() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING ATOMIC AUDIT INTEGRATION TEST SUITE");
  console.log("=======================================================\n");

  await initAndSeedDb();
  const db = getDb();

  const testEmail = `host_audit_${Date.now()}@test.ng`;
  let testUserId = "";

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION & REGISTRATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 1: AUTHENTICATION & CREDENTIALS ---");

  // AUTH-001: Register owner account
  const regResult = await authService.registerOwner({
    firstName: "Chioma",
    lastName: "Adeyemi",
    email: testEmail,
    password: "Password123!",
    phone: "+2348012345678",
    hostType: "individual_owner",
    operatingCity: "Abuja",
  });

  testUserId = regResult.user.id;
  assert(regResult.user.role === "host", "AUTH-001a", "Registered user has 'host' role");
  assert(regResult.user.emailVerified === false, "AUTH-001b", "New owner starts with emailVerified=false");
  assert(regResult.profile.onboardingStep === 1, "AUTH-001c", "New owner profile starts at step 1");
  assert(regResult.profile.verificationStatus === "REGISTERED", "AUTH-001d", "Initial status is 'REGISTERED'");

  // AUTH-002: Duplicate email rejection
  let dupRejected = false;
  try {
    await authService.registerOwner({
      firstName: "Duplicate",
      lastName: "User",
      email: testEmail,
      password: "Password123!",
      hostType: "individual_owner",
      operatingCity: "Abuja",
    });
  } catch (err: any) {
    if (err.message.includes("already exists")) dupRejected = true;
  }
  assert(dupRejected, "AUTH-002", "Duplicate email registration is rejected with appropriate error");

  // AUTH-003: Email verification with invalid OTP
  let wrongOtpRejected = false;
  try {
    await authService.verifyEmailOtp(testUserId, "999999");
  } catch {
    wrongOtpRejected = true;
  }
  assert(wrongOtpRejected, "AUTH-003", "Invalid email OTP code is rejected");

  // AUTH-004: Email verification with correct OTP
  const [userInDb] = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
  const validOtp = userInDb.emailVerificationCode!;
  const verifyResult = await authService.verifyEmailOtp(testUserId, validOtp);
  assert(verifyResult.user.emailVerified === true, "AUTH-004a", "Email verification sets emailVerified=true");
  assert(verifyResult.profile.verificationStatus === "EMAIL_VERIFIED", "AUTH-004b", "Profile status transitions to 'EMAIL_VERIFIED'");
  assert(verifyResult.profile.onboardingStep === 2, "AUTH-004c", "Onboarding step advances to step 2");

  // AUTH-005: Password reset token generation & persistence
  await authService.requestPasswordReset(testEmail);
  const [userAfterResetReq] = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
  assert(!!userAfterResetReq.resetToken, "AUTH-005a", "Password reset token is persisted in database");
  assert(!!userAfterResetReq.resetTokenExpiresAt, "AUTH-005b", "Password reset token expiration timestamp is persisted");

  // AUTH-006: Password reset execution
  const resetToken = userAfterResetReq.resetToken!;
  await authService.resetPassword(resetToken, "NewSecurePassword456!");
  const [userAfterReset] = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
  assert(userAfterReset.resetToken === null, "AUTH-006a", "Reset token is cleared after use");

  // AUTH-007: Login authentication with new vs old credentials
  let oldLoginFailed = false;
  try {
    await authService.loginUser(testEmail, "Password123!");
  } catch {
    oldLoginFailed = true;
  }
  assert(oldLoginFailed, "AUTH-007a", "Old password no longer valid after reset");

  const newLoginUser = await authService.loginUser(testEmail, "NewSecurePassword456!");
  assert(newLoginUser.id === testUserId, "AUTH-007b", "Login succeeds with new reset password");

  // AUTH-008: Reusing used/invalid reset token
  let usedTokenRejected = false;
  try {
    await authService.resetPassword(resetToken, "AnotherPassword789!");
  } catch {
    usedTokenRejected = true;
  }
  assert(usedTokenRejected, "AUTH-008", "Used reset token is rejected");

  // ─────────────────────────────────────────────────────────────
  // 2. DOCUMENT UPLOADS (PDF & IMAGES)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 2: DOCUMENT & MEDIA UPLOADS ---");

  // UPL-001: Upload PDF document (Certificate of Occupancy / Deed)
  const dummyPdfBuffer = Buffer.from("%PDF-1.4 dummy pdf content for testing");
  const pdfUpload = await uploadImage(dummyPdfBuffer, "application/pdf", { folder: "kyc" });
  assert(pdfUpload.success === true, "UPL-001a", "PDF document upload succeeds");
  assert(pdfUpload.url.length > 0, "UPL-001b", "PDF upload returns valid file URL");
  assert(pdfUpload.storageKey.endsWith(".pdf"), "UPL-001c", "Storage key preserves .pdf extension");

  // UPL-002: Upload JPEG image (NIN ID card / selfie)
  const dummyJpgBuffer = Buffer.from("dummy-jpeg-data");
  const jpgUpload = await uploadImage(dummyJpgBuffer, "image/jpeg", { folder: "kyc" });
  assert(jpgUpload.success === true, "UPL-002", "JPEG document upload succeeds");

  // UPL-003: Upload Word DOCX document
  const dummyDocxBuffer = Buffer.from("dummy-docx-content-for-testing");
  const docxUpload = await uploadImage(dummyDocxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", { folder: "kyc" });
  assert(docxUpload.success === true, "UPL-003a", "DOCX document upload succeeds");
  assert(docxUpload.storageKey.endsWith(".docx"), "UPL-003b", "Storage key preserves .docx extension");

  // UPL-004: File exceeding 15MB limit is rejected
  const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024); // 16 MB
  const oversizedUpload = await uploadImage(oversizedBuffer, "application/pdf", { folder: "kyc" });
  assert(oversizedUpload.success === false, "UPL-004a", "Oversized file >15MB is rejected");
  assert(oversizedUpload.error?.includes("15MB") === true, "UPL-004b", "Rejection error mentions 15MB limit");

  // ─────────────────────────────────────────────────────────────
  // 3. OWNER ONBOARDING JOURNEY
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 3: OWNER ONBOARDING STAGES ---");

  // ONBOARD-001: Stage 2 Profile
  const stage2 = await hostsService.updateOnboardingProfile(testUserId, {
    firstName: "Chioma",
    lastName: "Adeyemi",
    phone: "+2348012345678",
    dateOfBirth: "1990-05-14",
    residentialAddress: "Plot 12, Diplomatic Zone, Maitama, Abuja",
    hostType: "individual_owner",
    operatingCity: "Abuja",
    operatingAreas: "Maitama, Wuse 2, Jabi",
    bio: "Experienced residential property investor and host in the FCT.",
  });
  assert(stage2.profile.onboardingStep >= 3, "ONBOARD-001a", "Profile step advances to at least 3");
  assert(stage2.profile.residentialAddress?.includes("Maitama") === true, "ONBOARD-001b", "Residential address persists");

  // ONBOARD-002: Stage 3 Identity / KYC
  const stage3 = await hostsService.updateOnboardingIdentity(testUserId, {
    idType: "nin",
    idNumber: "12345678901",
    identityDocumentUrl: jpgUpload.url,
    selfieUrl: jpgUpload.url,
  });
  assert(stage3.profile.onboardingStep >= 4, "ONBOARD-002a", "Identity step advances to at least 4");
  assert(stage3.profile.idNumber === "12345678901", "ONBOARD-002b", "NIN ID number persists");

  // ONBOARD-003: Stage 4 Authority & Bank Details
  const stage4 = await hostsService.updateOnboardingAuthority(testUserId, {
    authorityDocType: "deed_of_ownership",
    authorityDocUrl: pdfUpload.url,
    bankName: "Guaranty Trust Bank (GTBank)",
    bankAccountNumber: "0123456789",
    bankAccountName: "Chioma Adeyemi",
  });
  assert(stage4.profile.onboardingStep >= 5, "ONBOARD-003a", "Authority step advances to at least 5");
  assert(stage4.profile.bankAccountNumber === "0123456789", "ONBOARD-003b", "Bank account number persists");
  assert(stage4.profile.authorityDocUrl === pdfUpload.url, "ONBOARD-003c", "PDF authority document URL persists");

  // ONBOARD-004: Stage 5 Preliminary Property Draft
  const stage5 = await hostsService.savePropertyDraft(testUserId, {
    propertyTitle: "Luxury 2-Bedroom Oasis Maitama",
    propertyType: "Apartment",
    neighborhood: "Maitama",
    bedrooms: 2,
    bathrooms: 2,
    nightlyRate: 85000,
    powerType: "24/7 Solar + Inverter",
  });
  assert(stage5.profile.onboardingStep >= 6, "ONBOARD-004a", "Property draft step advances to 6");
  assert(!!stage5.profile.propertyDraftData, "ONBOARD-004b", "Property draft data is serialized and stored");

  // ONBOARD-005: Stage 6 Final Submission
  const stage6 = await hostsService.submitOnboardingForReview(testUserId);
  assert(stage6.profile.verificationStatus === "UNDER_REVIEW", "ONBOARD-005a", "Status transitions to 'UNDER_REVIEW'");
  assert(stage6.profile.onboardingCompleted === true, "ONBOARD-005b", "Onboarding completed flag is true");

  // ONBOARD-006: State persistence across sessions
  const retrievedStatus = await hostsService.getOnboardingStatus(testUserId);
  assert(retrievedStatus.profile?.verificationStatus === "UNDER_REVIEW", "ONBOARD-006a", "Session reload preserves 'UNDER_REVIEW' status");
  assert(retrievedStatus.profile?.idNumber === "12345678901", "ONBOARD-006b", "Session reload preserves identity data");

  // ─────────────────────────────────────────────────────────────
  // 4. SECURITY & GATING (UNVERIFIED CANNOT LIST)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 4: SECURITY GATES & WORKFLOW ENFORCEMENT ---");

  // SEC-001: Unapproved host cannot create property listing
  let listingBlocked = false;
  try {
    await hostsService.createProperty(testUserId, {
      title: "Unauthorized Listing Attempt",
      propertyType: "Apartment",
      pricePerNight: 50000,
      city: "Abuja",
      neighborhood: "Maitama",
    });
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes("verified property partners")) {
      listingBlocked = true;
    }
  }
  assert(listingBlocked, "SEC-001", "Unverified host cannot create property listing (403 Forbidden)");

  // SEC-002: Unapproved host cannot relist property
  let relistBlocked = false;
  try {
    await hostsService.relistProperty(testUserId, "any_prop_id");
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 403) relistBlocked = true;
  }
  assert(relistBlocked, "SEC-002", "Unapproved host cannot call relist endpoint");

  // ─────────────────────────────────────────────────────────────
  // 5. ADMIN REVIEW & VERIFICATION WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 5: ADMIN REVIEW & APPLICATION LIFECYCLE ---");

  // ADM-001: Admin can retrieve host application
  const [adminUser] = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
  const actualAdminId = adminUser ? adminUser.id : "usr_admin_default";

  const adminHostDossier = await adminService.getHostApplication(testUserId);
  assert(adminHostDossier.host.id === testUserId, "ADM-001a", "Admin retrieves host applicant dossier");
  assert(adminHostDossier.profile?.authorityDocUrl === pdfUpload.url, "ADM-001b", "Admin sees uploaded legal PDF document");

  // ADM-002: Admin requests info
  const infoReq = await adminService.requestHostInfo(
    testUserId,
    "Please upload a clearer image of your National ID.",
    actualAdminId
  );
  assert(infoReq.profile.verificationStatus === "ACTION_REQUIRED", "ADM-002", "Admin request-info transitions status to 'ACTION_REQUIRED'");

  // Host updates documents and resubmits
  await hostsService.submitOnboardingForReview(testUserId);
  const [resubmittedProfile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, testUserId));
  assert(resubmittedProfile.verificationStatus === "UNDER_REVIEW", "ADM-003", "Host resubmission returns status to 'UNDER_REVIEW'");

  // ADM-004: Admin approves host
  const approvalResult = await adminService.approveHostApplication(testUserId, actualAdminId);
  assert(approvalResult.profile.isVerified === true, "ADM-004a", "Admin approval sets isVerified=true");
  assert(approvalResult.profile.verificationStatus === "APPROVED", "ADM-004b", "Status transitions to 'APPROVED'");

  // ─────────────────────────────────────────────────────────────
  // 6. VERIFIED LISTING CREATION & APPROVAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 6: VERIFIED PROPERTY LISTING CREATION ---");

  // PROP-001: Now-approved host creates listing
  const newProp = await hostsService.createProperty(testUserId, {
    title: "The Glass House Maitama",
    tagline: "Ultra-luxury serviced duplex with continuous power",
    description: "Exquisite 3-bedroom penthouse with 24/7 dedicated inverter and smart amenities.",
    propertyType: "Apartment",
    spaceType: "Entire place",
    bedrooms: 3,
    bathrooms: 3,
    pricePerNight: 95000,
    city: "Abuja",
    neighborhood: "Maitama",
    exactAddress: "14 River Niger Street, Maitama, Abuja",
    coverImage: jpgUpload.url,
  });
  assert(newProp.status === "DRAFT", "PROP-001a", "Property created in DRAFT status");
  assert(newProp.hostId === testUserId, "PROP-001b", "Property correctly associated with verified host");

  // PROP-002: Host cannot relist a DRAFT property (security bypass check)
  let draftRelistBlocked = false;
  try {
    await hostsService.relistProperty(testUserId, newProp.id);
  } catch (err: any) {
    if (err.message.includes("Draft properties cannot be published directly")) {
      draftRelistBlocked = true;
    }
  }
  assert(draftRelistBlocked, "PROP-002", "Host cannot self-publish DRAFT property via relist (must undergo admin review)");

  // PROP-003: Host submits property for review
  const submitPropResult = await hostsService.submitPropertyForReview(testUserId, newProp.id);
  assert(submitPropResult.property.status === "PENDING_REVIEW", "PROP-003", "Property moves to 'PENDING_REVIEW'");

  // PROP-004: Admin approves property
  const approvePropResult = await adminService.updatePropertyStatus(newProp.id, "PUBLISHED", null, actualAdminId);
  assert(approvePropResult.status === "PUBLISHED", "PROP-004", "Admin approval transitions property to 'PUBLISHED'");

  // ─────────────────────────────────────────────────────────────
  // 7. ADMINISTRATIVE SUSPENSION LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- SECTION 7: ADMINISTRATIVE SUSPENSION & ENFORCEMENT ---");

  // ADM-005: Admin suspends host
  const suspendResult = await adminService.suspendHostApplication(
    testUserId,
    "Violation of platform guest security policies",
    actualAdminId
  );
  assert(suspendResult.profile.verificationStatus === "SUSPENDED", "ADM-005a", "Host profile status is 'SUSPENDED'");
  assert(suspendResult.profile.isVerified === false, "ADM-005b", "Host isVerified revoked to false");

  const [suspendedUser] = await db.select().from(schema.users).where(eq(schema.users.id, testUserId));
  assert(suspendedUser.status === "SUSPENDED", "ADM-005c", "User account status is 'SUSPENDED'");

  // Verify all published properties of host are automatically suspended
  const [propAfterHostSuspension] = await db.select().from(schema.properties).where(eq(schema.properties.id, newProp.id));
  assert(propAfterHostSuspension.status === "SUSPENDED", "ADM-005d", "Host's published properties are cascade-suspended");

  // SEC-003: Suspended host cannot relist property
  let suspendedRelistBlocked = false;
  try {
    await hostsService.relistProperty(testUserId, newProp.id);
  } catch (err: any) {
    if (err.statusCode === 403) suspendedRelistBlocked = true;
  }
  assert(suspendedRelistBlocked, "SEC-003", "Suspended host cannot self-relist properties (403 Forbidden)");

  console.log("\n=======================================================");
  console.log(`🎉 ALL AUDIT INTEGRATION TESTS COMPLETE!`);
  console.log(`Passed: ${passCount} | Failed: ${failCount}`);
  console.log("=======================================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
