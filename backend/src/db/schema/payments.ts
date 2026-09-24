import { pgTable, varchar, timestamp, integer, text } from "drizzle-orm/pg-core";
import { users } from "./users";
import { bookings } from "./bookings";

export const payments = pgTable("payments", {
  id: varchar("id", { length: 100 }).primaryKey(),
  bookingId: varchar("booking_id", { length: 100 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  reference: varchar("reference", { length: 100 }).notNull().unique(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  method: varchar("method", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("INITIALIZED"),
  gatewayProvider: varchar("gateway_provider", { length: 50 }).notNull().default("MOCK_NIGERIAN_GATEWAY"),
  gatewayReference: varchar("gateway_reference", { length: 100 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const hostEarnings = pgTable("host_earnings", {
  id: varchar("id", { length: 100 }).primaryKey(),
  hostId: varchar("host_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bookingId: varchar("booking_id", { length: 100 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  grossAmount: integer("gross_amount").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  netAmount: integer("net_amount").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
