import { pgTable, varchar, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { users } from "./users"
import { properties } from "./properties"
import { bookings } from "./bookings"
import { reviews } from "./reviews"

/** Admin hide/restore. Missing table means reviews stay visible until migration 0010. */
export const reviewModeration = pgTable("review_moderation", {
  reviewId: varchar("review_id", { length: 100 })
    .primaryKey()
    .references(() => reviews.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 20 }).notNull().default("VISIBLE"),
  reason: text("reason"),
  moderatedBy: varchar("moderated_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }).defaultNow().notNull(),
})

/** Booking-linked support request. Guests cannot execute refunds from this table. */
export const supportCases = pgTable("support_cases", {
  id: varchar("id", { length: 100 }).primaryKey(),
  requesterId: varchar("requester_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  bookingId: varchar("booking_id", { length: 100 }).references(() => bookings.id, { onDelete: "restrict" }),
  propertyId: varchar("property_id", { length: 100 }).references(() => properties.id, { onDelete: "restrict" }),
  category: varchar("category", { length: 40 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("OPEN"),
  adminResponse: text("admin_response"),
  adminId: varchar("admin_id", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const favourites = pgTable(
  "favourites",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    userId: varchar("user_id", { length: 100 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    propertyId: varchar("property_id", { length: 100 })
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userProperty: uniqueIndex("favourites_user_property_uidx").on(table.userId, table.propertyId),
  })
)
