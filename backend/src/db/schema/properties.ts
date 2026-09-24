import { pgTable, varchar, text, timestamp, boolean, integer, doublePrecision } from "drizzle-orm/pg-core";
import { users } from "./users";

export const properties = pgTable("properties", {
  id: varchar("id", { length: 100 }).primaryKey(),
  hostId: varchar("host_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  tagline: text("tagline"),
  description: text("description").notNull(),

  propertyType: varchar("property_type", { length: 50 }).notNull(),
  spaceType: varchar("space_type", { length: 50 }).notNull().default("Entire place"),

  bedrooms: integer("bedrooms").notNull().default(1),
  bathrooms: doublePrecision("bathrooms").notNull().default(1),
  beds: integer("beds").notNull().default(1),
  maxGuests: integer("max_guests").notNull().default(2),

  pricePerNight: integer("price_per_night").notNull(),
  cleaningFee: integer("cleaning_fee").notNull().default(0),
  serviceFeePct: integer("service_fee_pct").notNull().default(8),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  minimumNights: integer("minimum_nights").notNull().default(1),

  city: varchar("city", { length: 100 }).notNull(),
  neighborhood: varchar("neighborhood", { length: 150 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),

  powerType: varchar("power_type", { length: 100 }).notNull(),
  powerDescription: text("power_description"),
  internetDescription: text("internet_description"),
  securityDescription: text("security_description"),
  waterDescription: text("water_description"),
  parkingDescription: text("parking_description"),

  coverImage: text("cover_image").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("PENDING_REVIEW"),
  rejectionReason: text("rejection_reason"),

  rating: doublePrecision("rating").notNull().default(5.0),
  reviewCount: integer("review_count").notNull().default(0),
  verified: boolean("verified").notNull().default(true),
  featured: boolean("featured").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const propertyPrivateDetails = pgTable("property_private_details", {
  id: varchar("id", { length: 100 }).primaryKey(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),
  exactAddress: text("exact_address").notNull(),
  unitNumber: varchar("unit_number", { length: 50 }),
  contactName: varchar("contact_name", { length: 100 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 30 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  checkInInstructions: text("check_in_instructions"),
  accessGateCode: varchar("access_gate_code", { length: 50 }),
  houseRulesPrivate: text("house_rules_private"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const propertyImages = pgTable("property_images", {
  id: varchar("id", { length: 100 }).primaryKey(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: varchar("storage_key", { length: 255 }),
  displayOrder: integer("display_order").notNull().default(0),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const propertyAmenities = pgTable("property_amenities", {
  id: varchar("id", { length: 100 }).primaryKey(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  isHighlight: boolean("is_highlight").notNull().default(false),
});

export const availabilityBlocks = pgTable("availability_blocks", {
  id: varchar("id", { length: 100 }).primaryKey(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }).notNull(),
  type: varchar("type", { length: 30 }).notNull().default("RESERVATION"),
  bookingId: varchar("booking_id", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
