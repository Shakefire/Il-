import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { properties } from "./properties";

export const bookings = pgTable("bookings", {
  id: varchar("id", { length: 100 }).primaryKey(),
  referenceCode: varchar("reference_code", { length: 30 }).notNull().unique(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),

  guestId: varchar("guest_id", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  guestFirstName: varchar("guest_first_name", { length: 100 }).notNull(),
  guestLastName: varchar("guest_last_name", { length: 100 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 30 }).notNull(),
  guestCount: integer("guest_count").notNull().default(1),

  checkInDate: varchar("check_in_date", { length: 10 }).notNull(),
  checkOutDate: varchar("check_out_date", { length: 10 }).notNull(),
  numberOfNights: integer("number_of_nights").notNull(),
  nightlyPrice: integer("nightly_price").notNull(),
  cleaningFee: integer("cleaning_fee").notNull().default(0),
  serviceFee: integer("service_fee").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),

  // Authoritative financial snapshots (Phase 1)
  accommodationSubtotal: integer("accommodation_subtotal"),
  hostCommissionPct: integer("host_commission_pct").default(10),
  hostCommissionAmount: integer("host_commission_amount").default(0),
  paystackFeeAmount: integer("paystack_fee_amount").default(0),
  hostNetAmount: integer("host_net_amount").default(0),

  status: varchar("status", { length: 30 }).notNull().default("PENDING"),
  hostArrivalReminderSentAt: timestamp("host_arrival_reminder_sent_at", { withTimezone: true }),
  cancellationReason: varchar("cancellation_reason", { length: 255 }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

  accessToken: varchar("access_token", { length: 64 }).notNull().unique(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
