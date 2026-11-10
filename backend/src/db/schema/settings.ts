import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 50 }).primaryKey(), // 'default'
  defaultHostCommissionPct: integer("default_host_commission_pct").notNull().default(10),
  /** Share of classic host earnings paid to host on new bookings (1–100). Default 100 = no haircut. */
  defaultHostPayoutPct: integer("default_host_payout_pct").notNull().default(100),
  payoutHoldHours: integer("payout_hold_hours").notNull().default(24),
  /**
   * Host payout execution mode for NEW payable rows after verified guest payment.
   * AUTOMATIC — release payable + initiate transfer without check-in gate.
   * MANUAL — keep HELD until settlement gates; admin approve/hold/reject then transfer.
   * Mode switches never drain or reverse historical payouts.
   */
  hostPayoutMode: varchar("host_payout_mode", { length: 20 }).notNull().default("MANUAL"),
  updatedBy: varchar("updated_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
