import { eq, desc, and, sql } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { LedgerService } from "./ledger.service";
import { env } from "../../config/env";
import { BankResolutionService, maskAccountNumber } from "../payments/bank-resolution.service";

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
   * Admin Updates Payout Bank Details for a Host Payout
   * Uses real Paystack NUBAN resolution to ensure destination validity before updating payout snapshot.
   */
  static async updatePayoutBankAccount(
    adminId: string,
    params: {
      payoutId: string;
      bankName?: string;
      bankCode?: string;
      accountNumber: string;
      accountName?: string;
      updateHostDefaultProfile?: boolean;
    }
  ) {
    const db = getDb();
    const { payoutId, updateHostDefaultProfile = true } = params;

    const [payout] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, payoutId)).limit(1);
    if (!payout) {
      throw new Error(`Payout ${payoutId} not found`);
    }

    if (payout.status === "PAID") {
      throw new Error("Cannot change bank details of an already disbursed payout.");
    }

    const effectiveBankCode = params.bankCode || payout.bankCode;
    if (!effectiveBankCode) {
      throw new Error("Bank code is required for Paystack account verification.");
    }

    // 1. Authoritative Paystack resolution
    const resolution = await BankResolutionService.resolveBankAccount(
      params.accountNumber,
      effectiveBankCode,
      `admin_${adminId}`
    );

    if (!resolution.resolved || !resolution.accountName) {
      throw new Error(
        resolution.error || "The bank account could not be verified by Paystack NUBAN inquiry."
      );
    }

    const verifiedBankName = resolution.bankName || params.bankName || payout.bankName || "Verified Bank";
    const verifiedAccountName = resolution.accountName;
    const verifiedAccountNumber = resolution.accountNumber || params.accountNumber.trim();
    const verifiedAt = new Date();

    const previousBank = payout.bankName;
    const previousMasked = maskAccountNumber(payout.accountNumber);

    // 2. Update the payout snapshot with the verified account
    const [updated] = await db
      .update(schema.payouts)
      .set({
        bankName: verifiedBankName,
        bankCode: effectiveBankCode,
        accountNumber: verifiedAccountNumber,
        accountName: verifiedAccountName,
        updatedAt: verifiedAt,
      })
      .where(eq(schema.payouts.id, payoutId))
      .returning();

    // 3. Optionally update host profile as default
    if (updateHostDefaultProfile && payout.hostId) {
      await db
        .update(schema.profiles)
        .set({
          bankName: verifiedBankName,
          bankCode: effectiveBankCode,
          bankAccountNumber: verifiedAccountNumber,
          bankAccountName: verifiedAccountName,
          bankAccountVerifiedAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(schema.profiles.userId, payout.hostId));
    }

    // 4. Audit Log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "ADMIN_UPDATE_PAYOUT_BANK",
      entityType: "PAYOUT",
      entityId: payoutId,
      details: JSON.stringify({
        payoutId,
        hostId: payout.hostId,
        previousBank,
        previousAccountMasked: previousMasked,
        newBank: verifiedBankName,
        newAccountMasked: maskAccountNumber(verifiedAccountNumber),
        resolvedAccountName: verifiedAccountName,
        updateHostDefaultProfile,
        adminId,
      }),
      createdAt: verifiedAt,
    });

    return updated;
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

      // Notify host of manual bank transfer payout via Resend
      import("../notifications/notifications.service").then(async ({ sendEmail, hostPayoutDisbursedEmail }) => {
        const [host] = await getDb()
          .select({ email: schema.users.email, firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(eq(schema.users.id, payout.hostId))
          .limit(1);

        if (host) {
          const masked = payout.accountNumber ? `******${payout.accountNumber.slice(-4)}` : undefined;
          sendEmail(
            hostPayoutDisbursedEmail({
              hostName: `${host.firstName} ${host.lastName}`.trim(),
              hostEmail: host.email,
              amount: payout.amount,
              bankName: payout.bankName || undefined,
              accountNumberMasked: masked,
              transferRef: transferRef || undefined,
              currency: payout.currency || "NGN",
            })
          ).catch((e) => console.warn("[Finance] Failed to send host payout email:", e));
        }
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

      // Real Paystack Refund Integration (Phase 6)
      let resolvedPaystackRefundId = paystackRefundId || null;
      const [payment] = await tx
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.bookingId, bookingId), eq(schema.payments.status, "SUCCESS")))
        .limit(1);

      if (env.PAYSTACK_SECRET_KEY && payment && (payment.gatewayReference || payment.reference)) {
        try {
          const paystackTx = payment.gatewayReference || payment.reference;
          console.log(`[Finance] Executing real Paystack refund for tx: ${paystackTx}, amount: ₦${accommodationSubtotal}`);

          const paystackRes = await fetch("https://api.paystack.co/refund", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              transaction: paystackTx,
              amount: accommodationSubtotal * 100, // in kobo
              currency: "NGN",
              customer_note: reason || "Booking accommodation refund",
              merchant_note: `Ilé booking #${booking.referenceCode} refund processed by admin: ${adminNotes || "N/A"}`,
            }),
          });

          const pData = await paystackRes.json().catch(() => ({}));
          console.log(`[Finance] Paystack refund response:`, pData);
          if (pData?.data?.id) {
            resolvedPaystackRefundId = String(pData.data.id);
          } else if (pData?.message && !pData.status) {
            console.warn(`[Finance] Paystack refund notice: ${pData.message}`);
          }
        } catch (paystackErr: any) {
          console.error(`[Finance] Paystack refund API call error:`, paystackErr.message);
        }
      }

      const result = await LedgerService.recordBookingRefund(tx, {
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid: booking.totalAmount,
        refundableAmount: accommodationSubtotal,
        nonRefundableProcessingFee: processingFee,
        adminId,
        reason,
        adminNotes,
        paystackRefundId: resolvedPaystackRefundId,
      });

      // Release availability blocks so dates return to live calendar inventory
      await tx
        .delete(schema.availabilityBlocks)
        .where(
          and(
            eq(schema.availabilityBlocks.propertyId, booking.propertyId),
            eq(schema.availabilityBlocks.startDate, booking.checkInDate),
            eq(schema.availabilityBlocks.endDate, booking.checkOutDate)
          )
        );

      // Notify guest of confirmed refund via Resend
      import("../notifications/notifications.service").then(async ({ sendEmail, bookingRefundEmail }) => {
        const [property] = await getDb()
          .select({ title: schema.properties.title })
          .from(schema.properties)
          .where(eq(schema.properties.id, booking.propertyId))
          .limit(1);

        sendEmail(
          bookingRefundEmail({
            guestName: `${booking.guestFirstName} ${booking.guestLastName}`.trim(),
            guestEmail: booking.guestEmail,
            propertyTitle: property?.title || "Property",
            referenceCode: booking.referenceCode,
            refundAmount: accommodationSubtotal,
            currency: booking.currency || "NGN",
            status: "PROCESSED",
          })
        ).catch((e) => console.warn("[Finance] Failed to send booking refund email:", e));
      });

      return {
        success: true,
        bookingId: booking.id,
        refundedAmount: accommodationSubtotal,
        processingFeeRetained: processingFee,
        paystackRefundId: resolvedPaystackRefundId,
        refundId: result.refundId,
        journalId: result.journal.id,
      };
    });
  }
}
