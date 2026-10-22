import { eq, desc, and, sql } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { LedgerService } from "./ledger.service";

export class FinanceService {
  /**
   * Financial Executive Summary for Admin Dashboard
   */
  static async getFinancialSummary() {
    const trialBalance = await LedgerService.getTrialBalance();
    const rows = trialBalance.rows;

    const findBal = (code: string) => {
      const row = rows.find((r) => r.code === code);
      return row ? row.netBalance : 0;
    };

    // Asset balances
    const paystackClearing = findBal("1010");
    const operatingBank = findBal("1020");

    // Liability balances
    const advanceGuestDeposits = findBal("2010"); // Escrow liability
    const hostSettlementPayable = findBal("2020"); // Owed to hosts
    const processingFeeEscrow = findBal("2030"); // Fee pass-through

    // Revenue balance
    const platformCommissionRevenue = findBal("4010"); // Earned platform commission

    const db = getDb();

    // Payout stats
    const [payoutStats] = await db
      .select({
        totalDisbursed: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PAID' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        pendingPayoutsCount: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} IN ('HELD', 'READY_FOR_PAYOUT') THEN 1 END)::int`,
        pendingPayoutsAmount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} IN ('HELD', 'READY_FOR_PAYOUT') THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
      })
      .from(schema.payouts);

    // Refund stats
    const [refundStats] = await db
      .select({
        totalRefunded: sql<number>`COALESCE(SUM(${schema.refunds.refundableAmount}), 0)::int`,
        refundCount: sql<number>`COUNT(*)::int`,
      })
      .from(schema.refunds);

    return {
      trialBalance,
      metrics: {
        paystackClearing,
        operatingBank,
        advanceGuestDeposits,
        hostSettlementPayable,
        processingFeeEscrow,
        platformCommissionRevenue,
        totalDisbursed: payoutStats?.totalDisbursed || 0,
        pendingPayoutsCount: payoutStats?.pendingPayoutsCount || 0,
        pendingPayoutsAmount: payoutStats?.pendingPayoutsAmount || 0,
        totalRefunded: refundStats?.totalRefunded || 0,
        refundCount: refundStats?.refundCount || 0,
      },
    };
  }

  /**
   * Payout Queue for Admin Disbursement
   */
  static async getPayoutQueue(filters: { status?: string; limit?: number; offset?: number } = {}) {
    const db = getDb();
    const { status, limit = 50, offset = 0 } = filters;

    let query = db
      .select({
        id: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        hostId: schema.payouts.hostId,
        amount: schema.payouts.amount,
        currency: schema.payouts.currency,
        bankCode: schema.payouts.bankCode,
        bankName: schema.payouts.bankName,
        accountNumber: schema.payouts.accountNumber,
        accountName: schema.payouts.accountName,
        status: schema.payouts.status,
        scheduledFor: schema.payouts.scheduledFor,
        approvedAt: schema.payouts.approvedAt,
        disbursedAt: schema.payouts.disbursedAt,
        paystackTransferRef: schema.payouts.paystackTransferRef,
        receiptUrl: schema.payouts.receiptUrl,
        notes: schema.payouts.notes,
        createdAt: schema.payouts.createdAt,
        // Host Info
        hostName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
        hostEmail: schema.users.email,
        hostPhone: schema.users.phone,
        // Booking Info
        bookingRef: schema.bookings.referenceCode,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        bookingStatus: schema.bookings.status,
        propertyName: schema.properties.title,
      })
      .from(schema.payouts)
      .innerJoin(schema.users, eq(schema.payouts.hostId, schema.users.id))
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .$dynamic();

    if (status) {
      query = query.where(eq(schema.payouts.status, status));
    }

    const items = await query.orderBy(desc(schema.payouts.createdAt)).limit(limit).offset(offset);
    return items;
  }

  /**
   * Admin Authorizes and Disburses a Host Payout
   */
  static async disbursePayout(
    adminId: string,
    params: {
      payoutId: string;
      transferRef?: string;
      receiptUrl?: string;
      notes?: string;
    }
  ) {
    const db = getDb();
    const { payoutId, transferRef, receiptUrl, notes } = params;

    return await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .limit(1);

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      if (payout.status === "PAID") {
        throw new Error(`Payout ${payoutId} has already been marked as PAID`);
      }

      const result = await LedgerService.recordHostPayout(tx, {
        payoutId: payout.id,
        bookingId: payout.bookingId,
        hostId: payout.hostId,
        amount: payout.amount,
        adminId,
        transferRef,
        receiptUrl,
        notes,
      });

      return {
        success: true,
        payoutId: payout.id,
        amount: payout.amount,
        journalId: result.journal.id,
      };
    });
  }

  /**
   * Refund Queue for Admin
   */
  static async getRefundQueue(filters: { status?: string; limit?: number; offset?: number } = {}) {
    const db = getDb();
    const { status, limit = 50, offset = 0 } = filters;

    let query = db
      .select({
        id: schema.refunds.id,
        bookingId: schema.refunds.bookingId,
        guestId: schema.refunds.guestId,
        grossPaid: schema.refunds.grossPaid,
        nonRefundableProcessingFee: schema.refunds.nonRefundableProcessingFee,
        refundableAmount: schema.refunds.refundableAmount,
        currency: schema.refunds.currency,
        status: schema.refunds.status,
        approvedAt: schema.refunds.approvedAt,
        processedAt: schema.refunds.processedAt,
        paystackRefundId: schema.refunds.paystackRefundId,
        reason: schema.refunds.reason,
        adminNotes: schema.refunds.adminNotes,
        createdAt: schema.refunds.createdAt,
        // Booking info
        bookingRef: schema.bookings.referenceCode,
        guestEmail: schema.bookings.guestEmail,
        guestPhone: schema.bookings.guestPhone,
        propertyName: schema.properties.title,
      })
      .from(schema.refunds)
      .innerJoin(schema.bookings, eq(schema.refunds.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .$dynamic();

    if (status) {
      query = query.where(eq(schema.refunds.status, status));
    }

    const items = await query.orderBy(desc(schema.refunds.createdAt)).limit(limit).offset(offset);
    return items;
  }

  /**
   * Admin Confirms and Processes a Booking Refund
   */
  static async processRefund(
    adminId: string,
    params: {
      bookingId: string;
      reason?: string;
      adminNotes?: string;
      paystackRefundId?: string;
    }
  ) {
    const db = getDb();
    const { bookingId, reason, adminNotes, paystackRefundId } = params;

    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId))
        .limit(1);

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      // Check if already refunded
      const [existingRefund] = await tx
        .select()
        .from(schema.refunds)
        .where(and(eq(schema.refunds.bookingId, bookingId), eq(schema.refunds.status, "PROCESSED")))
        .limit(1);

      if (existingRefund) {
        throw new Error(`Booking ${bookingId} has already been refunded`);
      }

      const accommodationSubtotal = booking.accommodationSubtotal || booking.nightlyPrice * booking.numberOfNights;
      const processingFee = booking.paystackFeeAmount || (booking.totalAmount - accommodationSubtotal);

      const result = await LedgerService.recordBookingRefund(tx, {
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid: booking.totalAmount,
        refundableAmount: accommodationSubtotal,
        nonRefundableProcessingFee: processingFee,
        adminId,
        reason,
        adminNotes,
        paystackRefundId,
      });

      return {
        success: true,
        bookingId: booking.id,
        refundedAmount: accommodationSubtotal,
        processingFeeRetained: processingFee,
        refundId: result.refundId,
        journalId: result.journal.id,
      };
    });
  }
}
