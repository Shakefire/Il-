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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
];

export async function initAndSeedDb() {
  const db = getDb();
  console.log("📦 Initializing database schema...");

  for (const stmt of TABLE_STATEMENTS) {
    await db.execute(stmt);
  }

  console.log("✅ Schema initialized. Checking seed data...");

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
    });

    await db.insert(schema.users).values({
      id: hostId,
      email: "host@ile.ng",
      passwordHash,
      firstName: "Amina",
      lastName: "Bello",
      phone: "+2348031234567",
      role: "host",
    });

    await db.insert(schema.profiles).values({
      id: "prof_host_default",
      userId: hostId,
      bio: "Practicing residential architect in Abuja. I curate spaces with an emphasis on natural lighting, quiet acoustics, and reliable daily infrastructure.",
      responseRate: "100%",
      responseTime: "Within an hour",
      joinedYear: 2022,
      isVerified: true,
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
