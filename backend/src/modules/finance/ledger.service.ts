import { eq, sql, desc, and } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import crypto from "crypto";

export const ACCOUNT_CODES = {
  PAYSTACK_CLEARING: "1010",
  OPERATING_BANK: "1020",
  ADVANCE_DEPOSITS: "2010",
  HOST_PAYABLE: "2020",
  PAYSTACK_FEE_ESCROW: "2030",
  COMMISSION_REVENUE: "4010",
  PROCESSING_EXPENSE: "5010",
  PAYOUT_TRANSFER_FEE: "5020",
} as const;

export type AccountCode = (typeof ACCOUNT_CODES)[keyof typeof ACCOUNT_CODES];

export interface JournalEntryInput {
  accountCode: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
}

export interface PostJournalOptions {
  reference: string;
  eventType: string;
  narration: string;
  createdById?: string | null;
  postedAt?: Date;
  entries: JournalEntryInput[];
}

export class LedgerService {
  private static accountCache: Map<string, string> = new Map();

  /**
   * Resolves internal account ID by account code (e.g. "1010" -> account.id)
   */
  static async getAccountIdByCode(tx: any, code: string): Promise<string> {
    if (this.accountCache.has(code)) {
      return this.accountCache.get(code)!;
    }

    const [account] = await tx
      .select({ id: schema.ledgerAccounts.id })
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.code, code))
      .limit(1);

    if (!account) {
      throw new Error(`Ledger account with code ${code} not found in chart of accounts.`);
    }

    this.accountCache.set(code, account.id);
    return account.id;
  }

  /**
   * Atomic Double-Entry Journal Posting with Strict Zero-Sum Validation.
   * Total Debits MUST equal Total Credits.
   */
  static async postJournalEntry(tx: any, options: PostJournalOptions) {
    const { reference, eventType, narration, createdById = null, postedAt = new Date(), entries } = options;

    if (!entries || entries.length < 2) {
      throw new Error("A double-entry journal requires at least two entry legs.");
    }

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
      if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
        throw new Error(`Invalid entry amount ${entry.amount}. Amounts must be positive integers.`);
      }
      if (entry.entryType === "DEBIT") {
        totalDebits += entry.amount;
      } else if (entry.entryType === "CREDIT") {
        totalCredits += entry.amount;
      } else {
        throw new Error(`Invalid entryType: ${entry.entryType}. Must be DEBIT or CREDIT.`);
      }
    }

    // STRICT ZERO-SUM BALANCING CONSTRAINT
    if (totalDebits !== totalCredits) {
      throw new Error(
        `Double-entry imbalance detected for ${eventType} (Ref: ${reference}): Total Debits (₦${totalDebits.toLocaleString()}) !== Total Credits (₦${totalCredits.toLocaleString()}). Difference: ₦${Math.abs(totalDebits - totalCredits).toLocaleString()}`
      );
    }

    const journalId = `jrn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const journalNumber = `JRN-${dateStr}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 1. Insert Journal Header
    const [journal] = await tx
      .insert(schema.ledgerJournals)
      .values({
        id: journalId,
        journalNumber,
        reference,
        eventType,
        narration,
        postedAt,
        createdById,
      })
      .returning();

    // 2. Insert Entry Lines
    const linesToInsert = [];
    for (const entry of entries) {
      const accountId = await this.getAccountIdByCode(tx, entry.accountCode);
      linesToInsert.push({
        id: `ent_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        journalId: journal.id,
        accountId,
        entryType: entry.entryType,
        amount: entry.amount,
        createdAt: postedAt,
      });
    }

    const insertedEntries = await tx.insert(schema.ledgerEntries).values(linesToInsert).returning();

    return {
      journal,
      entries: insertedEntries,
      balancedAmount: totalDebits,
    };
  }

  /**
   * 1. Booking Payment Received
   * DEBIT  1010 Paystack Clearing (totalAmount)
   * CREDIT 2010 Advance Guest Deposits (accommodationSubtotal)
   * CREDIT 2030 Paystack Fee Escrow (paystackFeeAmount)
   * And creates a HELD payout queue entry for host.
   */
  static async recordBookingPayment(
    tx: any,
    params: {
      bookingId: string;
      paymentRef: string;
      totalAmount: number;
      accommodationSubtotal: number;
      paystackFeeAmount: number;
      hostNetAmount: number;
      hostId: string;
      checkInDate: string;
      payoutHoldHours?: number;
      createdById?: string | null;
    }
  ) {
    const {
      bookingId,
      paymentRef,
      totalAmount,
      accommodationSubtotal,
      paystackFeeAmount,
      hostNetAmount,
      hostId,
      checkInDate,
      payoutHoldHours = 24,
      createdById = null,
    } = params;

    // Guard against duplicate journal posting
    const existing = await tx
      .select({ id: schema.ledgerJournals.id })
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, paymentRef),
          eq(schema.ledgerJournals.eventType, "BOOKING_PAYMENT_RECEIVED")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { alreadyRecorded: true as const, journalId: existing[0].id };
    }

    const entries: JournalEntryInput[] = [
      {
        accountCode: ACCOUNT_CODES.PAYSTACK_CLEARING,
        entryType: "DEBIT",
        amount: totalAmount,
      },
      {
        accountCode: ACCOUNT_CODES.ADVANCE_DEPOSITS,
        entryType: "CREDIT",
        amount: accommodationSubtotal,
      },
    ];

    if (paystackFeeAmount > 0) {
      entries.push({
        accountCode: ACCOUNT_CODES.PAYSTACK_FEE_ESCROW,
        entryType: "CREDIT",
        amount: paystackFeeAmount,
      });
    }

    const result = await this.postJournalEntry(tx, {
      reference: paymentRef,
      eventType: "BOOKING_PAYMENT_RECEIVED",
      narration: `Payment received for booking #${bookingId} via Paystack ref ${paymentRef}`,
      createdById,
      entries,
    });

    // Schedule Payout (Held until check-in + payoutHoldHours)
    let scheduledDate: Date | null = null;
    try {
      const checkIn = new Date(checkInDate);
      if (!isNaN(checkIn.getTime())) {
        scheduledDate = new Date(checkIn.getTime() + payoutHoldHours * 3600 * 1000);
      }
    } catch {
      scheduledDate = null;
    }

    // Lookup host profile bank details if available
    const [hostProfile] = await tx
      .select({
        bankCode: schema.profiles.bankCode,
        bankName: schema.profiles.bankName,
        bankAccountNumber: schema.profiles.bankAccountNumber,
        bankAccountName: schema.profiles.bankAccountName,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, hostId))
      .limit(1);

    const payoutId = `pay_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    await tx
      .insert(schema.payouts)
      .values({
        id: payoutId,
        bookingId,
        hostId,
        amount: hostNetAmount,
        bankCode: hostProfile?.bankCode || null,
        bankName: hostProfile?.bankName || null,
        accountNumber: hostProfile?.bankAccountNumber || null,
        accountName: hostProfile?.bankAccountName || null,
        status: "HELD",
        scheduledFor: scheduledDate,
      })
      .onConflictDoNothing();

    return {
      ...result,
      payoutId,
      alreadyRecorded: false as const,
    };
  }

  /**
   * 2. Stay Check-In / Settlement Recognition
   * DEBIT  2010 Advance Guest Deposits (accommodationSubtotal)
   * CREDIT 2020 Host Settlement Payable (hostNetAmount)
   * CREDIT 4010 Platform Commission Revenue (hostCommissionAmount)
   * And moves payout queue from HELD to READY_FOR_PAYOUT.
   */
  static async recognizeCheckInSettlement(
    tx: any,
    params: {
      bookingId: string;
      accommodationSubtotal: number;
      hostNetAmount: number;
      hostCommissionAmount: number;
      createdById?: string | null;
    }
  ) {
    const { bookingId, accommodationSubtotal, hostNetAmount, hostCommissionAmount, createdById = null } = params;

    const existing = await tx
      .select({ id: schema.ledgerJournals.id })
      .from(schema.ledgerJournals)
      .where(
        and(
          eq(schema.ledgerJournals.reference, bookingId),
          eq(schema.ledgerJournals.eventType, "CHECKIN_RECOGNITION")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { alreadyRecorded: true as const, journalId: existing[0].id };
    }

    const entries: JournalEntryInput[] = [
      {
        accountCode: ACCOUNT_CODES.ADVANCE_DEPOSITS,
        entryType: "DEBIT",
        amount: accommodationSubtotal,
      },
      {
        accountCode: ACCOUNT_CODES.HOST_PAYABLE,
        entryType: "CREDIT",
        amount: hostNetAmount,
      },
    ];

    if (hostCommissionAmount > 0) {
      entries.push({
        accountCode: ACCOUNT_CODES.COMMISSION_REVENUE,
        entryType: "CREDIT",
        amount: hostCommissionAmount,
      });
    }

    const result = await this.postJournalEntry(tx, {
      reference: bookingId,
      eventType: "CHECKIN_RECOGNITION",
      narration: `Check-in settlement recognized for booking #${bookingId}: Released escrow to host payable and platform commission`,
      createdById,
      entries,
    });

    // Update payout queue status
    await tx
      .update(schema.payouts)
      .set({
        status: "READY_FOR_PAYOUT",
        updatedAt: new Date(),
      })
      .where(and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD")));

    // Update host earnings status
    await tx
      .update(schema.hostEarnings)
      .set({ status: "READY" })
      .where(and(eq(schema.hostEarnings.bookingId, bookingId), eq(schema.hostEarnings.status, "PENDING")));

    return {
      ...result,
      alreadyRecorded: false as const,
    };
  }

  /**
   * 3. Admin Disburses Host Payout (Manual Transfer Execution)
   * DEBIT  2020 Host Settlement Payable (amount)
   * CREDIT 1020 Operating Bank Account (amount)
   * And marks payout as PAID.
   */
  static async recordHostPayout(
    tx: any,
    params: {
      payoutId: string;
      bookingId: string;
      hostId: string;
      amount: number;
      adminId: string;
      transferRef?: string | null;
      receiptUrl?: string | null;
      notes?: string | null;
    }
  ) {
    const { payoutId, bookingId, amount, adminId, transferRef = null, receiptUrl = null, notes = null } = params;

    const [payout] = await tx
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId))
      .limit(1);

    if (!payout) {
      throw new Error(`Payout record ${payoutId} not found.`);
    }

    if (payout.status === "PAID") {
      throw new Error(`Payout ${payoutId} has already been paid and disbursed.`);
    }

    const entries: JournalEntryInput[] = [
      {
        accountCode: ACCOUNT_CODES.HOST_PAYABLE,
        entryType: "DEBIT",
        amount,
      },
      {
        accountCode: ACCOUNT_CODES.OPERATING_BANK,
        entryType: "CREDIT",
        amount,
      },
    ];

    const result = await this.postJournalEntry(tx, {
      reference: payoutId,
      eventType: "HOST_PAYOUT_DISBURSED",
      narration: `Admin disbursed host payout for booking #${bookingId} (Ref: ${transferRef || "MANUAL_BANK_TRANSFER"})`,
      createdById: adminId,
      entries,
    });

    // Update payout status
    await tx
      .update(schema.payouts)
      .set({
        status: "PAID",
        approvedBy: adminId,
        approvedAt: new Date(),
        disbursedAt: new Date(),
        paystackTransferRef: transferRef,
        receiptUrl,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.payouts.id, payoutId));

    // Update host earnings status
    await tx
      .update(schema.hostEarnings)
      .set({ status: "PAID" })
      .where(eq(schema.hostEarnings.bookingId, bookingId));

    return {
      ...result,
      alreadyRecorded: false as const,
    };
  }

  /**
   * 4. Admin Confirms Booking Refund
   * DEBIT  2010 Advance Guest Deposits (refundableAmount = accommodationSubtotal)
   * CREDIT 1010 Paystack Clearing (refundableAmount)
   * Non-refundable Paystack processing fee is forfeited by guest.
   */
  static async recordBookingRefund(
    tx: any,
    params: {
      bookingId: string;
      guestId?: string | null;
      grossPaid: number;
      refundableAmount: number;
      nonRefundableProcessingFee: number;
      adminId: string;
      reason?: string | null;
      adminNotes?: string | null;
      paystackRefundId?: string | null;
    }
  ) {
    const {
      bookingId,
      guestId = null,
      grossPaid,
      refundableAmount,
      nonRefundableProcessingFee,
      adminId,
      reason = "Guest requested refund",
      adminNotes = null,
      paystackRefundId = null,
    } = params;

    const entries: JournalEntryInput[] = [
      {
        accountCode: ACCOUNT_CODES.ADVANCE_DEPOSITS,
        entryType: "DEBIT",
        amount: refundableAmount,
      },
      {
        accountCode: ACCOUNT_CODES.PAYSTACK_CLEARING,
        entryType: "CREDIT",
        amount: refundableAmount,
      },
    ];

    const result = await this.postJournalEntry(tx, {
      reference: bookingId,
      eventType: "BOOKING_REFUND_CONFIRMED",
      narration: `Admin confirmed refund for booking #${bookingId}. Accommodation refunded: ₦${refundableAmount.toLocaleString()}. Processing fee retained: ₦${nonRefundableProcessingFee.toLocaleString()}`,
      createdById: adminId,
      entries,
    });

    const refundId = `ref_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    await tx.insert(schema.refunds).values({
      id: refundId,
      bookingId,
      guestId,
      grossPaid,
      nonRefundableProcessingFee,
      refundableAmount,
      status: "PROCESSED",
      approvedBy: adminId,
      approvedAt: new Date(),
      processedAt: new Date(),
      paystackRefundId,
      reason,
      adminNotes,
    });

    // Neutralize payout & host earnings
    await tx
      .update(schema.payouts)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(schema.payouts.bookingId, bookingId));

    await tx
      .update(schema.hostEarnings)
      .set({ status: "CANCELLED" })
      .where(eq(schema.hostEarnings.bookingId, bookingId));

    // Mark booking cancelled
    await tx
      .update(schema.bookings)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, bookingId));

    return {
      ...result,
      refundId,
    };
  }

  /**
   * Trial Balance Calculation
   * Asserts total debits across the platform equal total credits.
   */
  static async getTrialBalance() {
    const db = getDb();

    const accounts = await db
      .select()
      .from(schema.ledgerAccounts)
      .orderBy(schema.ledgerAccounts.code);

    const entriesSum = await db
      .select({
        accountId: schema.ledgerEntries.accountId,
        entryType: schema.ledgerEntries.entryType,
        totalAmount: sql<number>`COALESCE(SUM(${schema.ledgerEntries.amount}), 0)::int`,
      })
      .from(schema.ledgerEntries)
      .groupBy(schema.ledgerEntries.accountId, schema.ledgerEntries.entryType);

    const sumMap: Record<string, { debit: number; credit: number }> = {};
    for (const row of entriesSum) {
      if (!sumMap[row.accountId]) {
        sumMap[row.accountId] = { debit: 0, credit: 0 };
      }
      if (row.entryType === "DEBIT") {
        sumMap[row.accountId].debit = row.totalAmount;
      } else {
        sumMap[row.accountId].credit = row.totalAmount;
      }
    }

    let platformTotalDebits = 0;
    let platformTotalCredits = 0;

    const reportRows = accounts.map((acc) => {
      const totals = sumMap[acc.id] || { debit: 0, credit: 0 };
      platformTotalDebits += totals.debit;
      platformTotalCredits += totals.credit;

      // Net balance calculation by standard accounting nature
      let netBalance = 0;
      if (acc.type === "ASSET" || acc.type === "EXPENSE") {
        netBalance = totals.debit - totals.credit;
      } else {
        // LIABILITY, REVENUE, EQUITY
        netBalance = totals.credit - totals.debit;
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: totals.debit,
        credit: totals.credit,
        netBalance,
      };
    });

    const isBalanced = platformTotalDebits === platformTotalCredits;

    return {
      rows: reportRows,
      totals: {
        debits: platformTotalDebits,
        credits: platformTotalCredits,
        isBalanced,
        imbalance: Math.abs(platformTotalDebits - platformTotalCredits),
      },
    };
  }

  /**
   * Audit Journal Feed
   */
  static async getJournals(limit = 50, offset = 0) {
    const db = getDb();

    const journals = await db
      .select()
      .from(schema.ledgerJournals)
      .orderBy(desc(schema.ledgerJournals.postedAt))
      .limit(limit)
      .offset(offset);

    if (journals.length === 0) {
      return [];
    }

    const journalIds = journals.map((j) => j.id);

    const entries = await db
      .select({
        id: schema.ledgerEntries.id,
        journalId: schema.ledgerEntries.journalId,
        entryType: schema.ledgerEntries.entryType,
        amount: schema.ledgerEntries.amount,
        accountCode: schema.ledgerAccounts.code,
        accountName: schema.ledgerAccounts.name,
        accountType: schema.ledgerAccounts.type,
      })
      .from(schema.ledgerEntries)
      .innerJoin(schema.ledgerAccounts, eq(schema.ledgerEntries.accountId, schema.ledgerAccounts.id))
      .where(sql`${schema.ledgerEntries.journalId} IN ${journalIds}`);

    const entriesByJournal: Record<string, any[]> = {};
    for (const ent of entries) {
      if (!entriesByJournal[ent.journalId]) {
        entriesByJournal[ent.journalId] = [];
      }
      entriesByJournal[ent.journalId].push(ent);
    }

    return journals.map((j) => ({
      ...j,
      entries: entriesByJournal[j.id] || [],
    }));
  }
}
