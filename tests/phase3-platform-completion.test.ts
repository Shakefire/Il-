import "dotenv/config"
import test from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import crypto from "crypto"
import { eq } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { getStayDetails } from "../backend/src/modules/bookings/stay-details"
import { createReview, getPropertyReviews } from "../backend/src/modules/reviews/reviews.routes"
import { hostsService } from "../backend/src/modules/hosts/hosts.service"
import { createSupportCase, getSupportCase } from "../backend/src/modules/support/support.service"
import { FinanceService } from "../backend/src/modules/finance/finance.service"
import { consumeRateLimit, isGlobalRateLimitExempt, resetRateLimits } from "../backend/src/lib/rate-limit"
import { presentGuestCreateResult } from "../backend/src/lib/guest-finance-redaction"
import { defaultThingsToKnow } from "../backend/src/modules/properties/properties.service"

const db = getDb()
const ts = Date.now()

async function exec(statement: string) {
  await db.execute(sql.raw(statement))
}

async function ensureTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(30),
      role VARCHAR(20) NOT NULL DEFAULT 'guest',
      avatar_url TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      email_verification_code VARCHAR(10),
      email_verification_expires_at TIMESTAMPTZ,
      email_verification_attempts INT NOT NULL DEFAULT 0,
      email_verification_sent_at TIMESTAMPTZ,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verification_code VARCHAR(10),
      phone_verification_expires_at TIMESTAMPTZ,
      phone_verification_attempts INT NOT NULL DEFAULT 0,
      phone_verification_sent_at TIMESTAMPTZ,
      reset_token VARCHAR(100),
      reset_token_expires_at TIMESTAMPTZ,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT,
      response_rate VARCHAR(10) DEFAULT '100%',
      response_time VARCHAR(50) DEFAULT 'Within an hour',
      joined_year INT DEFAULT 2026,
      is_verified BOOLEAN DEFAULT FALSE,
      identity_document_url TEXT,
      onboarding_step INT NOT NULL DEFAULT 1,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      verification_status VARCHAR(40) NOT NULL DEFAULT 'REGISTERED',
      host_type VARCHAR(40),
      company_name VARCHAR(255),
      company_reg_number VARCHAR(100),
      residential_address TEXT,
      date_of_birth VARCHAR(30),
      operating_city VARCHAR(100),
      operating_areas TEXT,
      id_type VARCHAR(50),
      id_number VARCHAR(100),
      id_document_back_url TEXT,
      selfie_url TEXT,
      authority_doc_type VARCHAR(50),
      authority_doc_url TEXT,
      bank_name VARCHAR(100),
      bank_code VARCHAR(20),
      bank_account_number VARCHAR(20),
      bank_account_name VARCHAR(150),
      bank_account_verified_at TIMESTAMPTZ,
      paystack_recipient_code VARCHAR(100),
      property_draft_data TEXT,
      review_feedback TEXT,
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS properties (
      id VARCHAR(100) PRIMARY KEY,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      tagline TEXT,
      description TEXT NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      space_type VARCHAR(50) NOT NULL DEFAULT 'Entire place',
      bedrooms INT NOT NULL DEFAULT 1,
      bathrooms DOUBLE PRECISION NOT NULL DEFAULT 1,
      beds INT NOT NULL DEFAULT 1,
      max_guests INT NOT NULL DEFAULT 2,
      price_per_night INT NOT NULL,
      host_base_price INT,
      cleaning_fee INT NOT NULL DEFAULT 0,
      service_fee_pct INT NOT NULL DEFAULT 8,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      minimum_nights INT NOT NULL DEFAULT 1,
      city VARCHAR(100) NOT NULL,
      neighborhood VARCHAR(150) NOT NULL,
      state VARCHAR(100) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      power_type VARCHAR(100) NOT NULL,
      power_description TEXT,
      internet_description TEXT,
      security_description TEXT,
      water_description TEXT,
      parking_description TEXT,
      cover_image TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
      moderation_status VARCHAR(30) NOT NULL DEFAULT 'NONE',
      moderation_reason TEXT,
      moderated_at TIMESTAMPTZ,
      moderated_by VARCHAR(100),
      rejection_reason TEXT,
      rating DOUBLE PRECISION NOT NULL DEFAULT 5.0,
      review_count INT NOT NULL DEFAULT 0,
      verified BOOLEAN NOT NULL DEFAULT TRUE,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      things_to_know JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS property_private_details (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
      exact_address TEXT NOT NULL,
      unit_number VARCHAR(50),
      contact_name VARCHAR(100) NOT NULL,
      contact_phone VARCHAR(30) NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      check_in_instructions TEXT,
      access_gate_code VARCHAR(50),
      house_rules_private TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS property_images (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      storage_key VARCHAR(255),
      display_order INT NOT NULL DEFAULT 0,
      caption TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(100) PRIMARY KEY,
      reference_code VARCHAR(30) NOT NULL UNIQUE,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
      guest_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      guest_first_name VARCHAR(100) NOT NULL,
      guest_last_name VARCHAR(100) NOT NULL,
      guest_email VARCHAR(255) NOT NULL,
      guest_phone VARCHAR(30) NOT NULL,
      guest_count INT NOT NULL DEFAULT 1,
      check_in_date VARCHAR(10) NOT NULL,
      check_out_date VARCHAR(10) NOT NULL,
      number_of_nights INT NOT NULL,
      nightly_price INT NOT NULL,
      cleaning_fee INT NOT NULL DEFAULT 0,
      service_fee INT NOT NULL DEFAULT 0,
      total_amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      accommodation_subtotal INT,
      host_commission_pct INT DEFAULT 10,
      host_commission_amount INT DEFAULT 0,
      paystack_fee_amount INT DEFAULT 0,
      host_net_amount INT DEFAULT 0,
      host_payout_pct INT DEFAULT 100,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      host_response_deadline_at TIMESTAMPTZ,
      host_responded_at TIMESTAMPTZ,
      host_response VARCHAR(30),
      payment_deadline_at TIMESTAMPTZ,
      host_arrival_reminder_sent_at TIMESTAMPTZ,
      cancellation_reason VARCHAR(255),
      cancelled_at TIMESTAMPTZ,
      guest_check_in_confirmed_at TIMESTAMPTZ,
      guest_check_in_confirmed_by VARCHAR(100),
      settlement_override_reason TEXT,
      settlement_override_by VARCHAR(100),
      settlement_override_at TIMESTAMPTZ,
      access_token VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
      reference VARCHAR(100) NOT NULL UNIQUE,
      amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      method VARCHAR(20) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'INITIALIZED',
      gateway_provider VARCHAR(50) NOT NULL DEFAULT 'PAYSTACK',
      gateway_reference VARCHAR(100),
      paid_at TIMESTAMPTZ,
      raw_payload TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
      booking_id VARCHAR(100) NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
      guest_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      overall_rating INT NOT NULL,
      cleanliness_rating INT,
      accuracy_rating INT,
      location_rating INT,
      value_rating INT,
      communication_rating INT,
      infrastructure_rating INT,
      title VARCHAR(200),
      body TEXT,
      host_response TEXT,
      host_responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS payouts (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      bank_code VARCHAR(20),
      bank_name TEXT,
      account_number VARCHAR(30),
      account_name TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'HELD',
      payout_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
      exception_code VARCHAR(60),
      exception_reason TEXT,
      scheduled_for TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by VARCHAR(100),
      disbursed_at TIMESTAMPTZ,
      paystack_recipient_code VARCHAR(100),
      paystack_transfer_code TEXT,
      paystack_transfer_ref TEXT,
      transfer_status VARCHAR(50) NOT NULL DEFAULT 'UNINITIATED',
      transfer_failure_reason TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS review_moderation (
      review_id VARCHAR(100) PRIMARY KEY REFERENCES reviews(id) ON DELETE RESTRICT,
      status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE',
      reason TEXT,
      moderated_by VARCHAR(100),
      moderated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS support_cases (
      id VARCHAR(100) PRIMARY KEY,
      requester_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE RESTRICT,
      property_id VARCHAR(100) REFERENCES properties(id) ON DELETE RESTRICT,
      category VARCHAR(40) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      admin_response TEXT,
      admin_id VARCHAR(100),
      responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS favourites (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ]
  for (const statement of statements) {
    await exec(statement)
  }
}

async function user(id: string, role: string) {
  await db.insert(schema.users).values({
    id,
    email: `${id}@test.ile.ng`,
    passwordHash: "hash",
    firstName: "Phase",
    lastName: role,
    role,
    emailVerified: true,
    status: "ACTIVE",
  }).onConflictDoNothing()
}

async function propertyFor(hostId: string, id: string, lat = 6.5244, lng = 3.3792) {
  await db.insert(schema.properties).values({
    id,
    hostId,
    slug: id,
    title: `Stay ${id}`,
    description: "A real listing row used only by the phase 3 test.",
    propertyType: "Apartment",
    pricePerNight: 80000,
    city: "Lagos",
    neighborhood: "Ikoyi",
    state: "Lagos",
    latitude: lat,
    longitude: lng,
    powerType: "Grid",
    coverImage: "/images/test.jpg",
    status: "PUBLISHED",
    internetDescription: "Network name TestStay",
    thingsToKnow: { checkInAfter: "3:00 PM", checkOutBefore: "11:00 AM", customRules: ["No parties"] },
  }).onConflictDoNothing()
  await db.insert(schema.propertyPrivateDetails).values({
    id: `priv_${id}`,
    propertyId: id,
    exactAddress: "12 Test Close, Ikoyi",
    contactName: "Host Tester",
    contactPhone: "+2348011111111",
    contactEmail: "host@test.ile.ng",
    checkInInstructions: "Call at the gate.",
    accessGateCode: "GATE-TEST",
    houseRulesPrivate: "Quiet after 10.",
  }).onConflictDoNothing()
}

async function bookingRow(opts: {
  id: string
  propertyId: string
  guestId: string
  status: string
  checkOut: string
}) {
  await db.insert(schema.bookings).values({
    id: opts.id,
    referenceCode: `R${crypto.randomBytes(8).toString("hex")}`.slice(0, 20),
    propertyId: opts.propertyId,
    guestId: opts.guestId,
    guestFirstName: "Ada",
    guestLastName: "Guest",
    guestEmail: `${opts.guestId}@test.ile.ng`,
    guestPhone: "+2348022222222",
    guestCount: 1,
    checkInDate: "2020-01-01",
    checkOutDate: opts.checkOut,
    numberOfNights: 2,
    nightlyPrice: 80000,
    totalAmount: 160000,
    status: opts.status,
    accessToken: crypto.randomBytes(16).toString("hex"),
    hostCommissionPct: 10,
    hostCommissionAmount: 16000,
    hostNetAmount: 144000,
  })
}

test("phase 3 tables exist", async () => {
  await ensureTables()
})

test("stay details require auth, ownership, confirmed status, and a successful payment", async () => {
  await ensureTables()
  const hostId = `usr_p3_host_${ts}`
  const guestId = `usr_p3_guest_${ts}`
  const otherId = `usr_p3_other_${ts}`
  const adminId = `usr_p3_admin_${ts}`
  const propertyId = `prop_p3_${ts}`
  const bookingId = `bkg_p3_${ts}`
  await user(hostId, "host")
  await user(guestId, "guest")
  await user(otherId, "guest")
  await user(adminId, "admin")
  await propertyFor(hostId, propertyId)
  await bookingRow({
    id: bookingId,
    propertyId,
    guestId,
    status: "CONFIRMED",
    checkOut: "2020-01-03",
  })

  await assert.rejects(() => getStayDetails(bookingId, ""), /Sign in/)
  await assert.rejects(() => getStayDetails(bookingId, otherId), /not found/i)
  await assert.rejects(() => getStayDetails(bookingId, guestId), /Verified payment/)

  await db.insert(schema.payments).values({
    id: `pay_${ts}`,
    bookingId,
    reference: `ref_${ts}`,
    amount: 160000,
    method: "card",
    status: "SUCCESS",
    paidAt: new Date(),
  })

  const stay = await getStayDetails(bookingId, guestId)
  assert.equal(stay.propertyName, `Stay ${propertyId}`)
  assert.equal(stay.paymentVerified, true)
  assert.equal(stay.checkIn?.date != null, true)
  assert.equal((stay as any).gateInstructions, undefined)
  assert.equal((stay as any).wifi, undefined)
  assert.equal((stay as any).address, undefined)

  const hostStay = await getStayDetails(bookingId, hostId)
  assert.equal(hostStay.reference, stay.reference)
  const adminStay = await getStayDetails(bookingId, adminId)
  assert.equal(adminStay.propertyName, stay.propertyName)

  await db.update(schema.bookings).set({ status: "CANCELLED" }).where(eq(schema.bookings.id, bookingId))
  await assert.rejects(() => getStayDetails(bookingId, guestId), /confirmed/i)
})

test("reviews require a completed stay, reject duplicates, sanitize text, and hide from the public list", async () => {
  await ensureTables()
  const hostId = `usr_p3r_host_${ts}`
  const guestId = `usr_p3r_guest_${ts}`
  const propertyId = `prop_p3r_${ts}`
  const futureId = `bkg_p3r_future_${ts}`
  const pastId = `bkg_p3r_past_${ts}`
  await user(hostId, "host")
  await user(guestId, "guest")
  await propertyFor(hostId, propertyId)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  await bookingRow({ id: futureId, propertyId, guestId, status: "CONFIRMED", checkOut: tomorrow })
  await bookingRow({ id: pastId, propertyId, guestId, status: "CONFIRMED", checkOut: "2020-01-03" })
  await db.insert(schema.payments).values({
    id: `pay_rev_${ts}`,
    bookingId: pastId,
    reference: `ref_rev_${ts}`,
    amount: 1000,
    method: "card",
    status: "SUCCESS",
  })

  const early = await createReview(guestId, { bookingId: futureId, overallRating: 5, body: "Too soon" })
  assert.equal(early.status, 400)

  const created = await createReview(guestId, {
    bookingId: pastId,
    overallRating: 4,
    title: "<b>Great</b>",
    body: "<script>alert(1)</script>Quiet and clean",
  })
  assert.equal(created.status, 201)
  assert.equal(created.review?.title, "Great")
  assert.equal(created.review?.body, "alert(1)Quiet and clean")

  const duplicate = await createReview(guestId, { bookingId: pastId, overallRating: 3, body: "Again" })
  assert.equal(duplicate.status, 409)

  const visible = await getPropertyReviews(propertyId, { page: 1, limit: 20, offset: 0 })
  assert.equal(visible.data.length, 1)

  await db.insert(schema.reviewModeration).values({
    reviewId: created.review!.id,
    status: "HIDDEN",
    reason: "Test moderation",
    moderatedBy: hostId,
  })
  const hidden = await getPropertyReviews(propertyId, { page: 1, limit: 20, offset: 0 })
  assert.equal(hidden.data.length, 0)
})

test("KYC blocks publish and a verified host can publish more than one listing", async () => {
  await ensureTables()
  const hostId = `usr_p3k_${ts}`
  await user(hostId, "host")
  await db.insert(schema.profiles).values({
    id: `prof_${hostId}`,
    userId: hostId,
    isVerified: false,
    verificationStatus: "UNDER_REVIEW",
  })
  const first = `prop_k1_${ts}`
  const second = `prop_k2_${ts}`
  for (const id of [first, second]) {
    await db.insert(schema.properties).values({
      id,
      hostId,
      slug: id,
      title: `Listing ${id}`,
      description: "Long enough description for publish validation.",
      propertyType: "Apartment",
      pricePerNight: 50000,
      city: "Abuja",
      neighborhood: "Wuse",
      state: "FCT",
      latitude: 9.06,
      longitude: 7.49,
      powerType: "Grid",
      coverImage: "/images/test.jpg",
      status: "DRAFT",
    })
    await db.insert(schema.propertyPrivateDetails).values({
      id: `priv_${id}`,
      propertyId: id,
      exactAddress: "4 Draft Road, Wuse",
      contactName: "Host",
      contactPhone: "+2348033333333",
      contactEmail: "host@test.ile.ng",
    })
    await db.insert(schema.propertyImages).values({
      id: `img_${id}`,
      propertyId: id,
      url: "/images/test.jpg",
    })
  }

  await assert.rejects(() => hostsService.submitPropertyForReview(hostId, first), /verification/)
  await db.update(schema.profiles).set({ isVerified: true, verificationStatus: "APPROVED" }).where(eq(schema.profiles.userId, hostId))
  const publishedA = await hostsService.submitPropertyForReview(hostId, first)
  const publishedB = await hostsService.submitPropertyForReview(hostId, second)
  assert.equal(publishedA.property.status, "PUBLISHED")
  assert.equal(publishedB.property.status, "PUBLISHED")
})

test("support cases are own-booking only and do not create refunds", async () => {
  await ensureTables()
  const guestId = `usr_p3s_guest_${ts}`
  const otherId = `usr_p3s_other_${ts}`
  const hostId = `usr_p3s_host_${ts}`
  const propertyId = `prop_p3s_${ts}`
  const bookingId = `bkg_p3s_${ts}`
  await user(guestId, "guest")
  await user(otherId, "guest")
  await user(hostId, "host")
  await propertyFor(hostId, propertyId)
  await bookingRow({ id: bookingId, propertyId, guestId, status: "CONFIRMED", checkOut: "2020-01-03" })

  await assert.rejects(
    () => createSupportCase({
      requesterId: otherId,
      bookingId,
      category: "REFUND_REQUEST",
      subject: "Please refund",
      message: "I want a refund but I do not own this booking.",
    }),
    /not found/i
  )

  const created = await createSupportCase({
    requesterId: guestId,
    bookingId,
    category: "REFUND_REQUEST",
    subject: "Late arrival help <b>please</b>",
    message: "The gate code did not work.",
  })
  assert.equal(created.refundExecuted, false)
  assert.equal(created.case.subject, "Late arrival help please")
  await assert.rejects(() => getSupportCase(created.case.id, otherId, "guest"), /not found/i)
  const own = await getSupportCase(created.case.id, guestId, "guest")
  assert.equal(own.case.id, created.case.id)
})

test("host wallet available balance is scoped to that host", async () => {
  await ensureTables()
  const hostA = `usr_p3w_a_${ts}`
  const hostB = `usr_p3w_b_${ts}`
  const guestId = `usr_p3w_g_${ts}`
  const propertyId = `prop_p3w_${ts}`
  const bookingId = `bkg_p3w_${ts}`
  await user(hostA, "host")
  await user(hostB, "host")
  await user(guestId, "guest")
  await propertyFor(hostA, propertyId)
  await bookingRow({ id: bookingId, propertyId, guestId, status: "CONFIRMED", checkOut: "2020-01-03" })
  await db.insert(schema.payouts).values({
    id: `po_${ts}`,
    bookingId,
    hostId: hostA,
    amount: 144000,
    status: "READY_FOR_PAYOUT",
  })
  const walletA = await FinanceService.getHostWallet(hostA)
  const walletB = await FinanceService.getHostWallet(hostB)
  assert.equal(walletA.balances.available, 144000)
  assert.equal(walletB.balances.available, 0)
  assert.equal("hostCommissionAmount" in (walletA.history[0] || {}), false)
})

test("deleting a guest does not cascade-delete their review", async () => {
  await ensureTables()
  const hostId = `usr_p3c_host_${ts}`
  const guestId = `usr_p3c_guest_${ts}`
  const propertyId = `prop_p3c_${ts}`
  const bookingId = `bkg_p3c_${ts}`
  await user(hostId, "host")
  await user(guestId, "guest")
  await propertyFor(hostId, propertyId)
  await bookingRow({ id: bookingId, propertyId, guestId, status: "CONFIRMED", checkOut: "2020-01-03" })
  const created = await createReview(guestId, { bookingId, overallRating: 5, body: "Keep this review" })
  assert.equal(created.status, 201)
  await assert.rejects(() => db.delete(schema.users).where(eq(schema.users.id, guestId)))
  const [still] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, created.review!.id))
  assert.ok(still)
})

test("guest create payload and public defaults hide commission and the caution fee", () => {
  const presented = presentGuestCreateResult({
    booking: { id: "b", hostCommissionAmount: 10, hostNetAmount: 90, totalAmount: 100 },
    pricing: { totalAmount: 100, hostCommissionAmount: 10, hostNetAmount: 90, cleaningFee: 0 },
  })
  assert.equal("hostCommissionAmount" in presented.pricing, false)
  assert.equal("hostNetAmount" in presented.booking, false)
  assert.equal(defaultThingsToKnow().cautionFeeNgn, 0)
  const migration = fs.readFileSync("backend/src/db/migrations/0010_phase3_platform.sql", "utf8")
  assert.match(migration, /reviews_guest_id_users_id_fk/)
  assert.match(migration, /ON DELETE RESTRICT/)
  assert.match(migration, /properties_host_id_users_id_fk/)
  assert.doesNotMatch(fs.readFileSync("backend/src/modules/bookings/stay-details.ts", "utf8"), /9jaroommate/)
})

test("global rate limit exempts health and paystack webhooks", () => {
  resetRateLimits()
  assert.equal(isGlobalRateLimitExempt("/health", "GET"), true)
  assert.equal(isGlobalRateLimitExempt("/api/payments/webhook", "POST"), true)
  assert.equal(isGlobalRateLimitExempt("/api/bookings", "GET"), false)
  const first = consumeRateLimit("phase3-test", 1, 60_000)
  const second = consumeRateLimit("phase3-test", 1, 60_000)
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
})

test("notification routing still names inbox, resend email, termii sms, fcm, and vapid web push", () => {
  const orchestrator = fs.readFileSync("backend/src/modules/notifications/orchestrator.ts", "utf8")
  const envFile = fs.readFileSync("backend/src/config/env.ts", "utf8")
  assert.match(orchestrator, /inboxService/)
  assert.match(orchestrator, /sendEmail/)
  assert.match(orchestrator, /sendSms/)
  assert.match(orchestrator, /sendFcmPush/)
  assert.match(orchestrator, /sendWebPush/)
  assert.match(envFile, /SMS_PROVIDER/)
  assert.match(envFile, /TERMII_API_KEY/)
  assert.match(envFile, /RESEND_API_KEY/)
  assert.match(envFile, /FIREBASE_PROJECT_ID/)
  assert.match(envFile, /WEB_PUSH_VAPID_PUBLIC_KEY/)
  assert.match(envFile, /WEB_PUSH_VAPID_PRIVATE_KEY/)
  const termii = fs.readFileSync("backend/src/modules/notifications/termii.service.ts", "utf8")
  assert.doesNotMatch(termii, /twilio/i)
})
