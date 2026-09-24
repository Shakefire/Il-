import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const locationSearchCache = pgTable("location_search_cache", {
  id: varchar("id", { length: 100 }).primaryKey(),
  query: varchar("query", { length: 255 }).notNull().unique(),
  results: text("results").notNull(), // JSON array of NormalizedLocation
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
