import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 50 }).primaryKey(), // 'default'
  defaultHostCommissionPct: integer("default_host_commission_pct").notNull().default(10),
  payoutHoldHours: integer("payout_hold_hours").notNull().default(24),
  updatedBy: varchar("updated_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
