import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 50 }).primaryKey(), // 'default'
  defaultHostCommissionPct: integer("default_host_commission_pct").notNull().default(10),
  /** Share of classic host earnings paid to host on new bookings (1–100). Default 100 = no haircut. */
  defaultHostPayoutPct: integer("default_host_payout_pct").notNull().default(100),
  payoutHoldHours: integer("payout_hold_hours").notNull().default(24),
  updatedBy: varchar("updated_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
