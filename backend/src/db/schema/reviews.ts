import { pgTable, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { properties } from "./properties";
import { bookings } from "./bookings";

/**
 * Guest Reviews
 * A guest can leave one review per booking (enforced by unique bookingId).
 */
export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 100 }).primaryKey(),
  propertyId: varchar("property_id", { length: 100 })
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  bookingId: varchar("booking_id", { length: 100 })
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  guestId: varchar("guest_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Ratings (1–5 stars)
  overallRating: integer("overall_rating").notNull(),
  cleanlinessRating: integer("cleanliness_rating"),
  accuracyRating: integer("accuracy_rating"),
  locationRating: integer("location_rating"),
  valueRating: integer("value_rating"),
  communicationRating: integer("communication_rating"),
  infrastructureRating: integer("infrastructure_rating"),

  // Text
  title: varchar("title", { length: 200 }),
  body: text("body"),

  // Host response
  hostResponse: text("host_response"),
  hostRespondedAt: timestamp("host_responded_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
