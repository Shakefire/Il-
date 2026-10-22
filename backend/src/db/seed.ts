import { getDb, schema } from "./client";
import { PROPERTIES } from "../../../src/data/properties";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const TABLE_STATEMENTS = [
  sql`
    CREATE TABLE IF NOT EXISTS users (
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
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verification_code VARCHAR(10),
      phone_verification_expires_at TIMESTAMPTZ,
      reset_token VARCHAR(100),
      reset_token_expires_at TIMESTAMPTZ,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS profiles (
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
      property_draft_data TEXT,
      review_feedback TEXT,
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS verification_logs (
      id VARCHAR(100) PRIMARY KEY,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      previous_status VARCHAR(40) NOT NULL,
      new_status VARCHAR(40) NOT NULL,
      action VARCHAR(50) NOT NULL,
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS properties (
      id VARCHAR(100) PRIMARY KEY,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS property_private_details (
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
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS property_images (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      storage_key VARCHAR(255),
      display_order INT NOT NULL DEFAULT 0,
      caption TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS property_amenities (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      is_highlight BOOLEAN NOT NULL DEFAULT FALSE
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS availability_blocks (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      start_date VARCHAR(10) NOT NULL,
      end_date VARCHAR(10) NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'RESERVATION',
      booking_id VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(100) PRIMARY KEY,
      reference_code VARCHAR(30) NOT NULL UNIQUE,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id),
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
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      host_arrival_reminder_sent_at TIMESTAMPTZ,
      cancellation_reason VARCHAR(255),
      cancelled_at TIMESTAMPTZ,
      access_token VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      reference VARCHAR(100) NOT NULL UNIQUE,
      amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      method VARCHAR(20) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'INITIALIZED',
      gateway_provider VARCHAR(50) NOT NULL DEFAULT 'MOCK_NIGERIAN_GATEWAY',
      gateway_reference VARCHAR(100),
      paid_at TIMESTAMPTZ,
      raw_payload TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS host_earnings (
      id VARCHAR(100) PRIMARY KEY,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      gross_amount INT NOT NULL,
      commission_amount INT NOT NULL,
      net_amount INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(100),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      booking_id VARCHAR(100) NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      guest_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS location_search_cache (
      id VARCHAR(100) PRIMARY KEY,
      query VARCHAR(255) NOT NULL UNIQUE,
      results TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id VARCHAR(50) PRIMARY KEY,
      default_host_commission_pct INT NOT NULL DEFAULT 10,
      payout_hold_hours INT NOT NULL DEFAULT 24,
      updated_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  // Phase 2: Double-Entry Ledger Core & Payout/Refund Queues
  sql`
    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id VARCHAR(100) PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type VARCHAR(20) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS ledger_journals (
      id VARCHAR(100) PRIMARY KEY,
      journal_number VARCHAR(100) NOT NULL UNIQUE,
      reference VARCHAR(100) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      narration TEXT NOT NULL,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id VARCHAR(100) PRIMARY KEY,
      journal_id VARCHAR(100) NOT NULL REFERENCES ledger_journals(id) ON DELETE CASCADE,
      account_id VARCHAR(100) NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
      entry_type VARCHAR(10) NOT NULL,
      amount INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS payouts (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      host_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      bank_code VARCHAR(20),
      bank_name TEXT,
      account_number VARCHAR(30),
      account_name TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'HELD',
      scheduled_for TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      disbursed_at TIMESTAMPTZ,
      paystack_transfer_code TEXT,
      paystack_transfer_ref TEXT,
      receipt_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  sql`
    CREATE TABLE IF NOT EXISTS refunds (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      guest_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      gross_paid INT NOT NULL,
      non_refundable_processing_fee INT NOT NULL,
      refundable_amount INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
      approved_at TIMESTAMPTZ,
      approved_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
      processed_at TIMESTAMPTZ,
      paystack_refund_id TEXT,
      reason TEXT,
      admin_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
];

export async function initAndSeedDb() {
  const db = getDb();
  console.log("📦 Initializing database schema...");

  for (const stmt of TABLE_STATEMENTS) {
    await db.execute(stmt);
  }

  // Safe schema migrations for existing databases
  const MIGRATIONS = [
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(10);`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_code VARCHAR(10);`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verification_expires_at TIMESTAMPTZ;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(100);`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_attempts INT NOT NULL DEFAULT 0;`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;`,

    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 1;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(40) NOT NULL DEFAULT 'REGISTERED';`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS host_type VARCHAR(40);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_reg_number VARCHAR(100);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS residential_address TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(30);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS operating_city VARCHAR(100);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS operating_areas TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_type VARCHAR(50);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_number VARCHAR(100);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_document_back_url TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS authority_doc_type VARCHAR(50);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS authority_doc_url TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_code VARCHAR(20);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(20);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(150);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS property_draft_data TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_feedback TEXT;`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100);`,
    sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;`,

    sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(30) NOT NULL DEFAULT 'NONE';`,
    sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT;`,
    sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;`,
    sql`ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderated_by VARCHAR(100);`,

    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_arrival_reminder_sent_at TIMESTAMPTZ;`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason VARCHAR(255);`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;`,

    // Phase 1: Authoritative Financial Snapshot Columns
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accommodation_subtotal INT;`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_commission_pct INT DEFAULT 10;`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_commission_amount INT DEFAULT 0;`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paystack_fee_amount INT DEFAULT 0;`,
    sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_net_amount INT DEFAULT 0;`,

    // Phase 1: Concurrency Guard - Unique Booking ID on Host Earnings
    sql`CREATE UNIQUE INDEX IF NOT EXISTS host_earnings_booking_id_unique ON host_earnings (booking_id);`,

    // Phase 1: Default Platform Settings Row
    sql`INSERT INTO platform_settings (id, default_host_commission_pct, payout_hold_hours, updated_at) VALUES ('default', 10, 24, NOW()) ON CONFLICT (id) DO NOTHING;`,

    sql`UPDATE properties SET moderation_status = 'SUSPENDED' WHERE status = 'SUSPENDED' AND (moderation_status IS NULL OR moderation_status = 'NONE');`,
    sql`UPDATE properties SET moderation_status = 'REJECTED' WHERE status = 'REJECTED' AND (moderation_status IS NULL OR moderation_status = 'NONE');`,
  ];

  for (const m of MIGRATIONS) {
    try {
      await db.execute(m);
    } catch {
      // Ignore if already applied
    }
  }

  console.log("✅ Schema initialized & migrations applied. Checking seed data...");

  // Phase 2: Seed Default Chart of Accounts
  const DEFAULT_LEDGER_ACCOUNTS = [
    { id: "acc_1010", code: "1010", name: "Paystack Clearing", type: "ASSET", description: "Inflow from Paystack gateway for guest bookings" },
    { id: "acc_1020", code: "1020", name: "Operating Bank Account", type: "ASSET", description: "Platform primary bank/operating account" },
    { id: "acc_2010", code: "2010", name: "Advance Guest Deposits", type: "LIABILITY", description: "Escrow liability held for guest reservations until check-in" },
    { id: "acc_2020", code: "2020", name: "Host Settlement Payable", type: "LIABILITY", description: "Net payout liability owed to hosts awaiting admin disbursement" },
    { id: "acc_2030", code: "2030", name: "Paystack Processing Fee Escrow", type: "LIABILITY", description: "Pass-through payment processing fees collected from guests" },
    { id: "acc_4010", code: "4010", name: "Platform Commission Revenue", type: "REVENUE", description: "Earned platform commission on completed bookings" },
    { id: "acc_5010", code: "5010", name: "Payment Processing Expense", type: "EXPENSE", description: "Paystack domestic gateway transaction charges" },
    { id: "acc_5020", code: "5020", name: "Payout Transfer Fee", type: "EXPENSE", description: "Bank NIP / payout disbursement transfer fees" },
  ];

  for (const acc of DEFAULT_LEDGER_ACCOUNTS) {
    await db.insert(schema.ledgerAccounts).values(acc).onConflictDoNothing();
  }

  const existingUsers = await db.select().from(schema.users);
  const passwordHash = await bcrypt.hash("Password123!", 10);

  let hostId = "usr_host_default";

  if (existingUsers.length === 0) {
    console.log("🌱 Seeding default users (Admin, Host, Guest)...");

    await db.insert(schema.users).values({
      id: "usr_admin_default",
      email: "admin@ile.ng",
      passwordHash,
      firstName: "Ilé",
      lastName: "Administrator",
      phone: "+2348000000001",
      role: "admin",
      emailVerified: true,
      phoneVerified: true,
      status: "ACTIVE",
    });

    await db.insert(schema.users).values({
      id: hostId,
      email: "host@ile.ng",
      passwordHash,
      firstName: "Amina",
      lastName: "Bello",
      phone: "+2348031234567",
      role: "host",
      emailVerified: true,
      phoneVerified: true,
      status: "ACTIVE",
    });

    await db.insert(schema.profiles).values({
      id: "prof_host_default",
      userId: hostId,
      bio: "Practicing residential architect in Abuja. I curate spaces with an emphasis on natural lighting, quiet acoustics, and reliable daily infrastructure.",
      responseRate: "100%",
      responseTime: "Within an hour",
      joinedYear: 2022,
      isVerified: true,
      onboardingStep: 6,
      onboardingCompleted: true,
      verificationStatus: "APPROVED",
      hostType: "individual_owner",
      operatingCity: "Abuja",
    });

    await db.insert(schema.users).values({
      id: "usr_guest_default",
      email: "guest@ile.ng",
      passwordHash,
      firstName: "Chukwudi",
      lastName: "Nnadi",
      phone: "+2348029876543",
      role: "guest",
    });
  } else {
    const hostUser = existingUsers.find((u: any) => u.role === "host");
    if (hostUser) hostId = hostUser.id;
  }

  const existingProps = await db.select().from(schema.properties);
  if (existingProps.length === 0) {
    console.log(`🌱 Seeding ${PROPERTIES.length} curated properties...`);

    for (let i = 0; i < PROPERTIES.length; i++) {
      const p = PROPERTIES[i];
      const propId = `prop_${i + 1}_${p.slug}`;

      await db.insert(schema.properties).values({
        id: propId,
        hostId,
        slug: p.slug,
        title: p.title,
        tagline: p.tagline,
        description: p.description,
        propertyType: p.propertyType,
        spaceType: "Entire place",
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        beds: p.bedrooms,
        maxGuests: p.maxGuests,
        pricePerNight: p.pricePerNight,
        cleaningFee: Math.round(p.pricePerNight * 0.05),
        serviceFeePct: 8,
        currency: "NGN",
        minimumNights: 1,
        city: p.city,
        neighborhood: p.neighborhood,
        state: p.state,
        latitude: p.coordinates.lat,
        longitude: p.coordinates.lng,
        powerType: p.infrastructure.powerType,
        powerDescription: p.infrastructure.power,
        internetDescription: p.infrastructure.internet,
        securityDescription: p.infrastructure.security,
        waterDescription: p.infrastructure.water,
        parkingDescription: p.infrastructure.parking,
        coverImage: p.coverImage,
        status: "PUBLISHED",
        rating: p.rating,
        reviewCount: p.reviewCount,
        verified: p.verified,
        featured: p.featured ?? (i < 3),
      });

      await db.insert(schema.propertyPrivateDetails).values({
        id: `pvd_${propId}`,
        propertyId: propId,
        exactAddress: `Plot ${100 + i * 14}, Crescent View Estate, Off ${p.neighborhood} Way, ${p.city}`,
        unitNumber: `Unit ${String.fromCharCode(65 + (i % 6))}${i + 1}`,
        contactName: p.host.name,
        contactPhone: "+234 803 555 " + (1000 + i),
        contactEmail: `${p.slug.split("-")[1] || "host"}@ile.ng`,
        checkInInstructions: "Security clearance pass will be activated upon gate arrival. State your name and show your reservation QR code.",
        accessGateCode: `GATE-${8800 + i}`,
        houseRulesPrivate: "No loud parties after 10:00 PM. No unauthorized commercial video equipment without estate clearance.",
      });

      for (let imgIdx = 0; imgIdx < p.images.length; imgIdx++) {
        await db.insert(schema.propertyImages).values({
          id: `img_${propId}_${imgIdx}`,
          propertyId: propId,
          url: p.images[imgIdx],
          displayOrder: imgIdx,
          caption: `${p.title} view ${imgIdx + 1}`,
        });
      }

      for (let amIdx = 0; amIdx < p.amenities.length; amIdx++) {
        const am = p.amenities[amIdx];
        await db.insert(schema.propertyAmenities).values({
          id: `amenity_${propId}_${amIdx}`,
          propertyId: propId,
          name: am.name,
          category: am.category,
          isHighlight: am.highlight ?? false,
        });
      }
    }
    console.log("✅ Properties seeded successfully.");
  }

  console.log("✅ Database initialization and seed complete!");
}

if (require.main === module) {
  initAndSeedDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed error:", err);
      process.exit(1);
    });
}
