import { pgTable, varchar, timestamp, integer, text } from "drizzle-orm/pg-core";
import { users } from "./users";
import { bookings } from "./bookings";

/**
 * Standard Chart of Accounts:
 * - 1010: Paystack Clearing (ASSET)
 * - 1020: Operating Bank Account (ASSET)
 * - 2010: Advance Guest Deposits (LIABILITY - Escrow)
 * - 2020: Host Settlement Payable (LIABILITY - Due to Host)
 * - 2030: Paystack Processing Fee Escrow (LIABILITY - Gateway fee pass-through)
 * - 4010: Platform Commission Revenue (REVENUE - Ilé Commission)
 * - 5010: Payment Processing Expense (EXPENSE - Gateway charges)
 * - 5020: Payout Transfer Fee (EXPENSE - Bank transfer charges)
 */
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: varchar("id", { length: 100 }).primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerJournals = pgTable("ledger_journals", {
  id: varchar("id", { length: 100 }).primaryKey(),
  journalNumber: varchar("journal_number", { length: 100 }).notNull().unique(),
  reference: varchar("reference", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'BOOKING_PAYMENT_RECEIVED' | 'CHECKIN_RECOGNITION' | 'HOST_PAYOUT_DISBURSED' | 'BOOKING_REFUND_CONFIRMED' | 'HISTORICAL_RECONCILIATION'
  narration: text("narration").notNull(),
  postedAt: timestamp("posted_at", { withTimezone: true }).defaultNow().notNull(),
  createdById: varchar("created_by_id", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: varchar("id", { length: 100 }).primaryKey(),
  journalId: varchar("journal_id", { length: 100 })
    .notNull()
    .references(() => ledgerJournals.id, { onDelete: "cascade" }),
  accountId: varchar("account_id", { length: 100 })
    .notNull()
    .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
  entryType: varchar("entry_type", { length: 10 }).notNull(), // 'DEBIT' | 'CREDIT'
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payouts = pgTable("payouts", {
  id: varchar("id", { length: 100 }).primaryKey(),
  bookingId: varchar("booking_id", { length: 100 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  hostId: varchar("host_id", { length: 100 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  bankCode: varchar("bank_code", { length: 20 }),
  bankName: text("bank_name"),
  accountNumber: varchar("account_number", { length: 30 }),
  accountName: text("account_name"),
  status: varchar("status", { length: 30 }).notNull().default("HELD"), // 'HELD' | 'READY_FOR_PAYOUT' | 'PROCESSING' | 'PAID' | 'CANCELLED'
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: varchar("approved_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  paystackRecipientCode: varchar("paystack_recipient_code", { length: 100 }),
  paystackTransferCode: text("paystack_transfer_code"),
  paystackTransferRef: text("paystack_transfer_ref"),
  transferStatus: varchar("transfer_status", { length: 50 }).notNull().default("UNINITIATED"), // 'UNINITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED'
  transferFailureReason: text("transfer_failure_reason"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refunds = pgTable("refunds", {
  id: varchar("id", { length: 100 }).primaryKey(),
  bookingId: varchar("booking_id", { length: 100 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  guestId: varchar("guest_id", { length: 100 })
    .references(() => users.id, { onDelete: "set null" }),
  grossPaid: integer("gross_paid").notNull(),
  nonRefundableProcessingFee: integer("non_refundable_processing_fee").notNull(),
  refundableAmount: integer("refundable_amount").notNull(), // accommodationSubtotal
  currency: varchar("currency", { length: 10 }).notNull().default("NGN"),
  status: varchar("status", { length: 30 }).notNull().default("REQUESTED"), // 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSED'
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: varchar("approved_by", { length: 100 }).references(() => users.id, { onDelete: "set null" }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  paystackRefundId: text("paystack_refund_id"),
  reason: text("reason"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
