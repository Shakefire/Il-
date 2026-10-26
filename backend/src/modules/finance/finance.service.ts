import { eq, desc, and, sql, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";
import { LedgerService } from "./ledger.service";
import { env } from "../../config/env";
import { BankResolutionService, maskAccountNumber } from "../payments/bank-resolution.service";
import { PaystackTransferService } from "../payments/paystack-transfer.service";

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

    // 2. Register as Paystack Transfer Recipient for automated host payouts
    let paystackRecipientCode: string | null = null;
    try {
      const rec = await PaystackTransferService.createTransferRecipient({
        name: verifiedAccountName,
        accountNumber: verifiedAccountNumber,
        bankCode: effectiveBankCode,
        description: `Host Payout - ${verifiedAccountName}`,
      });
      if (rec.success && rec.recipientCode) {
        paystackRecipientCode = rec.recipientCode;
      }
    } catch (recErr: any) {
      console.warn(`[Finance] Transfer recipient creation warning: ${recErr.message}`);
    }

    // 3. Update the payout snapshot with the verified account
    const [updated] = await db
      .update(schema.payouts)
      .set({
        bankName: verifiedBankName,
        bankCode: effectiveBankCode,
        accountNumber: verifiedAccountNumber,
        accountName: verifiedAccountName,
        paystackRecipientCode: paystackRecipientCode || undefined,
        updatedAt: verifiedAt,
      })
      .where(eq(schema.payouts.id, payoutId))
      .returning();

    // 4. Optionally update host profile as default
    if (updateHostDefaultProfile && payout.hostId) {
      await db
        .update(schema.profiles)
        .set({
          bankName: verifiedBankName,
          bankCode: effectiveBankCode,
          bankAccountNumber: verifiedAccountNumber,
          bankAccountName: verifiedAccountName,
          bankAccountVerifiedAt: verifiedAt,
          paystackRecipientCode: paystackRecipientCode || undefined,
          updatedAt: verifiedAt,
        })
        .where(eq(schema.profiles.userId, payout.hostId));
    }

    // 5. Audit Log
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
        paystackRecipientCode,
        updateHostDefaultProfile,
        adminId,
      }),
      createdAt: verifiedAt,
    });

    return updated;
  }

  /**
   * Admin Authorizes and Disburses a Host Payout
   * Supports automated Paystack Transfers with concurrency locking (FOR UPDATE)
   * or manual bank wire recording with transferRef.
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
      // 1. Acquire row lock to prevent concurrent double-disbursement
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .for("update")
        .limit(1);

      if (!payout) {
        throw new Error(`Payout ${payoutId} not found`);
      }

      if (payout.status === "PAID") {
        throw new Error(`Payout ${payoutId} has already been marked as PAID`);
      }

      if (payout.status === "PROCESSING") {
        throw new Error(`Payout ${payoutId} is currently being processed by payment gateway`);
      }

      if (!payout.accountNumber || !payout.bankCode) {
        throw new Error(`Payout ${payoutId} cannot be disbursed: destination bank account is missing or incomplete.`);
      }

      // 2. Resolve or create Paystack Recipient Code
      let recipientCode = payout.paystackRecipientCode;
      if (!recipientCode) {
        const [hostProfile] = await tx
          .select({
            paystackRecipientCode: schema.profiles.paystackRecipientCode,
            bankAccountName: schema.profiles.bankAccountName,
          })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, payout.hostId))
          .limit(1);

        if (hostProfile?.paystackRecipientCode) {
          recipientCode = hostProfile.paystackRecipientCode;
        } else {
          const recRes = await PaystackTransferService.createTransferRecipient({
            name: payout.accountName || hostProfile?.bankAccountName || "Host",
            accountNumber: payout.accountNumber,
            bankCode: payout.bankCode,
            description: `Host Payout - ${payout.accountName || payout.hostId}`,
          });

          if (!recRes.success || !recRes.recipientCode) {
            throw new Error(`Paystack recipient registration failed: ${recRes.error || "Unable to register recipient"}`);
          }
          recipientCode = recRes.recipientCode;

          await tx
            .update(schema.profiles)
            .set({ paystackRecipientCode: recipientCode })
            .where(eq(schema.profiles.userId, payout.hostId));
        }

        await tx
          .update(schema.payouts)
          .set({ paystackRecipientCode: recipientCode })
          .where(eq(schema.payouts.id, payout.id));
      }

      // 3. Automated Paystack Transfer vs Manual Wire Reference
      let finalTransferRef = transferRef;
      let transferCode: string | undefined = undefined;

      if (!finalTransferRef) {
        // Execute automated Paystack transfer
        finalTransferRef = `ILE_TRF_${payout.id.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}`;
        const transferRes = await PaystackTransferService.initiateTransfer({
          amountNaira: payout.amount,
          recipientCode,
          reference: finalTransferRef,
          reason: notes || `Ilé Verified Stay Host Payout for booking #${payout.bookingId}`,
        });

        if (!transferRes.success || transferRes.status === "failed") {
          await tx
            .update(schema.payouts)
            .set({
              transferStatus: "FAILED",
              transferFailureReason: transferRes.error || "Paystack transfer initiation failed",
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));

          throw new Error(transferRes.error || "Paystack transfer initiation was rejected.");
        }

        if (transferRes.status === "otp_required") {
          await tx
            .update(schema.payouts)
            .set({
              transferStatus: "FAILED",
              transferFailureReason: transferRes.error,
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));

          throw new Error(transferRes.error);
        }

        transferCode = transferRes.transferCode;

        if (transferRes.status === "pending") {
          // Transfer is queued on Paystack. Mark payout as PROCESSING.
          // The general ledger will be debited when transfer.success webhook arrives.
          await tx
            .update(schema.payouts)
            .set({
              status: "PROCESSING",
              transferStatus: "PENDING",
              paystackTransferRef: finalTransferRef,
              paystackTransferCode: transferCode || null,
              paystackRecipientCode: recipientCode,
              approvedBy: adminId,
              approvedAt: new Date(),
              notes: notes || null,
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));

          return {
            success: true,
            status: "PROCESSING",
            payoutId: payout.id,
            amount: payout.amount,
            transferRef: finalTransferRef,
            transferCode,
            message: "Automated Paystack transfer initiated and is pending settlement.",
          };
        }
      }

      // 4. Record Host Payout in Double-Entry General Ledger
      const result = await LedgerService.recordHostPayout(tx, {
        payoutId: payout.id,
        bookingId: payout.bookingId,
        hostId: payout.hostId,
        amount: payout.amount,
        adminId,
        transferRef: finalTransferRef,
        receiptUrl,
        notes,
      });

      // Update transfer status
      await tx
        .update(schema.payouts)
        .set({
          transferStatus: "SUCCESS",
          paystackTransferCode: transferCode || null,
          paystackTransferRef: finalTransferRef,
          paystackRecipientCode: recipientCode,
        })
        .where(eq(schema.payouts.id, payout.id));

      // Notify host of payout via Resend
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
              transferRef: finalTransferRef || undefined,
              currency: payout.currency || "NGN",
            })
          ).catch((e) => console.warn("[Finance] Failed to send host payout email:", e));
        }
      });

      return {
        success: true,
        payoutId: payout.id,
        amount: payout.amount,
        transferRef: finalTransferRef,
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

        if (!paystackRes.ok || !pData.status) {
          const errMsg = pData?.message || "Paystack refund request was declined.";
          console.error(`[Finance] Paystack refund failed: ${errMsg}`);
          throw new Error(`Paystack refund rejected by gateway: ${errMsg}. Ledger transaction aborted.`);
        }

        if (pData?.data?.id) {
          resolvedPaystackRefundId = String(pData.data.id);
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

  // ─────────────────────────────────────────────────────────────
  // REFUND APPROVAL WORKFLOW (REQUESTED → APPROVED/REJECTED → PROCESSED)
  // ─────────────────────────────────────────────────────────────

  /**
   * Admin approves a REQUESTED refund (does NOT yet call Paystack).
   */
  static async approveRefund(adminId: string, refundId: string) {
    const db = getDb();

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, refundId))
      .limit(1);

    if (!refund) throw new Error(`Refund ${refundId} not found`);
    if (refund.status !== "REQUESTED") {
      throw new Error(`Refund ${refundId} is in status ${refund.status} and cannot be approved`);
    }

    const [updated] = await db
      .update(schema.refunds)
      .set({ status: "APPROVED", approvedAt: new Date(), approvedBy: adminId, updatedAt: new Date() })
      .where(eq(schema.refunds.id, refundId))
      .returning();

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "ADMIN_APPROVE_REFUND",
      entityType: "REFUND",
      entityId: refundId,
      details: JSON.stringify({ refundId, bookingId: refund.bookingId, refundableAmount: refund.refundableAmount }),
      createdAt: new Date(),
    });

    return updated;
  }

  /**
   * Admin rejects a REQUESTED refund.
   */
  static async rejectRefund(adminId: string, refundId: string, adminNotes?: string) {
    const db = getDb();

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, refundId))
      .limit(1);

    if (!refund) throw new Error(`Refund ${refundId} not found`);
    if (refund.status !== "REQUESTED") {
      throw new Error(`Refund ${refundId} is in status ${refund.status} and cannot be rejected`);
    }

    const [updated] = await db
      .update(schema.refunds)
      .set({ status: "REJECTED", adminNotes: adminNotes || null, updatedAt: new Date() })
      .where(eq(schema.refunds.id, refundId))
      .returning();

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "ADMIN_REJECT_REFUND",
      entityType: "REFUND",
      entityId: refundId,
      details: JSON.stringify({ refundId, bookingId: refund.bookingId, adminNotes }),
      createdAt: new Date(),
    });

    return updated;
  }

  /**
   * Admin finalizes an APPROVED refund: calls Paystack, posts journal entry, sets PROCESSED.
   */
  static async processApprovedRefund(
    adminId: string,
    refundId: string,
    params: { paystackRefundId?: string } = {}
  ) {
    const db = getDb();

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, refundId))
      .limit(1);

    if (!refund) throw new Error(`Refund ${refundId} not found`);
    if (refund.status !== "APPROVED") {
      throw new Error(`Refund ${refundId} must be APPROVED before processing (current: ${refund.status})`);
    }

    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.id, refund.bookingId))
        .limit(1);

      if (!booking) throw new Error(`Booking ${refund.bookingId} not found`);

      let resolvedPaystackRefundId = params.paystackRefundId || null;

      // Execute real Paystack refund if key is present
      const [payment] = await tx
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.bookingId, refund.bookingId), eq(schema.payments.status, "SUCCESS")))
        .limit(1);

      if (env.PAYSTACK_SECRET_KEY && payment && (payment.gatewayReference || payment.reference)) {
        const paystackTx = payment.gatewayReference || payment.reference;
        const paystackRes = await fetch("https://api.paystack.co/refund", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: paystackTx,
            amount: refund.refundableAmount * 100,
            currency: "NGN",
            customer_note: "Booking accommodation refund",
            merchant_note: `Ilé booking #${booking.referenceCode} refund by admin`,
          }),
        });

        const pData = await paystackRes.json().catch(() => ({}));
        if (!paystackRes.ok || !pData.status) {
          throw new Error(`Paystack refund rejected: ${pData?.message || "Unknown error"}`);
        }
        if (pData?.data?.id) resolvedPaystackRefundId = String(pData.data.id);
      }

      // Post journal entry
      await LedgerService.recordBookingRefund(tx, {
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid: booking.totalAmount,
        refundableAmount: refund.refundableAmount,
        nonRefundableProcessingFee: refund.nonRefundableProcessingFee,
        adminId,
        reason: refund.reason || undefined,
        adminNotes: refund.adminNotes || undefined,
        paystackRefundId: resolvedPaystackRefundId,
      });

      // Mark refund PROCESSED
      const [processed] = await tx
        .update(schema.refunds)
        .set({
          status: "PROCESSED",
          processedAt: new Date(),
          paystackRefundId: resolvedPaystackRefundId || undefined,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId))
        .returning();

      // Cancel payout & host earnings
      await tx
        .update(schema.payouts)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(schema.payouts.bookingId, booking.id));

      await tx
        .update(schema.hostEarnings)
        .set({ status: "CANCELLED" })
        .where(eq(schema.hostEarnings.bookingId, booking.id));

      await tx
        .update(schema.bookings)
        .set({ status: "CANCELLED", cancelledAt: new Date(), cancellationReason: refund.reason, updatedAt: new Date() })
        .where(eq(schema.bookings.id, booking.id));

      await db.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: adminId,
        action: "ADMIN_PROCESS_REFUND",
        entityType: "REFUND",
        entityId: refundId,
        details: JSON.stringify({ refundId, bookingId: booking.id, refundableAmount: refund.refundableAmount, paystackRefundId: resolvedPaystackRefundId }),
        createdAt: new Date(),
      });

      return { success: true, refundId, processed, paystackRefundId: resolvedPaystackRefundId };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // FINANCIAL REPORTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Collections Report — all successful payment inflows
   */
  static async getCollectionsReport(params: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const db = getDb();
    const { from, to, limit = 200, offset = 0 } = params;

    const conditions = [eq(schema.payments.status, "SUCCESS")];
    if (from) conditions.push(gte(schema.payments.paidAt, new Date(from)));
    if (to) conditions.push(lte(schema.payments.paidAt, new Date(to)));

    const rows = await db
      .select({
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        guestEmail: schema.payments.reference, // fallback; override below
        amount: schema.payments.amount,
        paystackFeeAmount: schema.bookings.paystackFeeAmount,
        paidAt: schema.payments.paidAt,
        currency: schema.payments.currency,
        guestEmailActual: schema.bookings.guestEmail,
        accommodationSubtotal: schema.bookings.accommodationSubtotal,
      })
      .from(schema.payments)
      .innerJoin(schema.bookings, eq(schema.payments.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .where(and(...conditions))
      .orderBy(desc(schema.payments.paidAt))
      .limit(limit)
      .offset(offset);

    const mapped = rows.map((r) => ({
      bookingRef: r.bookingRef,
      propertyName: r.propertyName,
      guestEmail: r.guestEmailActual,
      amount: r.amount,
      paystackFeeAmount: r.paystackFeeAmount || 0,
      netAmount: r.amount - (r.paystackFeeAmount || 0),
      paidAt: r.paidAt,
      currency: r.currency,
    }));

    const totals = {
      totalGross: mapped.reduce((s, r) => s + r.amount, 0),
      totalFees: mapped.reduce((s, r) => s + r.paystackFeeAmount, 0),
      totalNet: mapped.reduce((s, r) => s + r.netAmount, 0),
      count: mapped.length,
    };

    return { rows: mapped, totals };
  }

  /**
   * Payouts Report — host payout disbursement history
   */
  static async getPayoutsReport(params: {
    from?: string;
    to?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const db = getDb();
    const { from, to, status, limit = 200, offset = 0 } = params;

    const conditions: any[] = [];
    if (status) conditions.push(eq(schema.payouts.status, status));
    if (from) conditions.push(gte(schema.payouts.createdAt, new Date(from)));
    if (to) conditions.push(lte(schema.payouts.createdAt, new Date(to)));

    const query = db
      .select({
        payoutId: schema.payouts.id,
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        hostName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
        hostEmail: schema.users.email,
        amount: schema.payouts.amount,
        status: schema.payouts.status,
        disbursedAt: schema.payouts.disbursedAt,
        paystackTransferRef: schema.payouts.paystackTransferRef,
        transferStatus: schema.payouts.transferStatus,
        currency: schema.payouts.currency,
        createdAt: schema.payouts.createdAt,
      })
      .from(schema.payouts)
      .innerJoin(schema.users, eq(schema.payouts.hostId, schema.users.id))
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .$dynamic();

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(schema.payouts.createdAt))
      .limit(limit)
      .offset(offset);

    const totals = {
      totalDisbursed: rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0),
      totalPending: rows.filter((r) => r.status !== "PAID" && r.status !== "CANCELLED").reduce((s, r) => s + r.amount, 0),
      count: rows.length,
    };

    return { rows, totals };
  }

  /**
   * Refunds Report — refund transaction history
   */
  static async getRefundsReport(params: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const db = getDb();
    const { from, to, limit = 200, offset = 0 } = params;

    const conditions: any[] = [];
    if (from) conditions.push(gte(schema.refunds.createdAt, new Date(from)));
    if (to) conditions.push(lte(schema.refunds.createdAt, new Date(to)));

    const query = db
      .select({
        refundId: schema.refunds.id,
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        guestEmail: schema.bookings.guestEmail,
        grossPaid: schema.refunds.grossPaid,
        nonRefundableProcessingFee: schema.refunds.nonRefundableProcessingFee,
        refundableAmount: schema.refunds.refundableAmount,
        status: schema.refunds.status,
        processedAt: schema.refunds.processedAt,
        paystackRefundId: schema.refunds.paystackRefundId,
        reason: schema.refunds.reason,
        currency: schema.refunds.currency,
        createdAt: schema.refunds.createdAt,
      })
      .from(schema.refunds)
      .innerJoin(schema.bookings, eq(schema.refunds.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .$dynamic();

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(schema.refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const processed = rows.filter((r) => r.status === "PROCESSED");
    const totals = {
      totalRefunded: processed.reduce((s, r) => s + r.refundableAmount, 0),
      totalFeeRetained: processed.reduce((s, r) => s + r.nonRefundableProcessingFee, 0),
      count: rows.length,
      processedCount: processed.length,
    };

    return { rows, totals };
  }

  /**
   * Settlements Report — booking check-in revenue recognition by payout
   */
  static async getSettlementsReport(params: { limit?: number; offset?: number } = {}) {
    const db = getDb();
    const { limit = 200, offset = 0 } = params;

    const rows = await db
      .select({
        payoutId: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        hostName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
        hostEmail: schema.users.email,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        totalAmount: schema.bookings.totalAmount,
        accommodationSubtotal: schema.bookings.accommodationSubtotal,
        hostCommissionAmount: schema.bookings.hostCommissionAmount,
        hostNetAmount: schema.bookings.hostNetAmount,
        payoutStatus: schema.payouts.status,
        disbursedAt: schema.payouts.disbursedAt,
      })
      .from(schema.payouts)
      .innerJoin(schema.users, eq(schema.payouts.hostId, schema.users.id))
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .orderBy(desc(schema.payouts.createdAt))
      .limit(limit)
      .offset(offset);

    return { settlements: rows };
  }

  /**
   * Audit Log — append-only log of sensitive financial actions
   */
  static async getFinancialAuditLog(params: {
    limit?: number;
    offset?: number;
    entityType?: string;
    action?: string;
  } = {}) {
    const db = getDb();
    const { limit = 100, offset = 0, entityType, action } = params;

    const conditions: any[] = [];
    if (entityType) conditions.push(eq(schema.auditLogs.entityType, entityType));
    if (action) conditions.push(eq(schema.auditLogs.action, action));

    const query = db
      .select({
        id: schema.auditLogs.id,
        userId: schema.auditLogs.userId,
        userName: sql<string>`COALESCE(CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName}), 'System')`,
        action: schema.auditLogs.action,
        entityType: schema.auditLogs.entityType,
        entityId: schema.auditLogs.entityId,
        details: schema.auditLogs.details,
        ipAddress: schema.auditLogs.ipAddress,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
      .$dynamic();

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs: rows.map((r) => ({
        ...r,
        details: (() => { try { return JSON.parse(r.details || "{}"); } catch { return {}; } })(),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RECONCILIATION STUB (basic local counts; real Paystack API reconciliation
  // requires live credentials — use as framework to extend)
  // ─────────────────────────────────────────────────────────────

  static async getReconciliationSummary() {
    const db = getDb();

    const [paymentCounts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        success: sql<number>`COUNT(CASE WHEN ${schema.payments.status} = 'SUCCESS' THEN 1 END)::int`,
        pending: sql<number>`COUNT(CASE WHEN ${schema.payments.status} = 'INITIALIZED' THEN 1 END)::int`,
        failed: sql<number>`COUNT(CASE WHEN ${schema.payments.status} NOT IN ('SUCCESS', 'INITIALIZED') THEN 1 END)::int`,
        totalGross: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payments.status} = 'SUCCESS' THEN ${schema.payments.amount} ELSE 0 END), 0)::int`,
      })
      .from(schema.payments);

    const [payoutCounts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        paid: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'PAID' THEN 1 END)::int`,
        processing: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'PROCESSING' THEN 1 END)::int`,
        pending: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} IN ('HELD', 'READY_FOR_PAYOUT') THEN 1 END)::int`,
        totalDisbursed: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PAID' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
      })
      .from(schema.payouts);

    const [refundCounts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        processed: sql<number>`COUNT(CASE WHEN ${schema.refunds.status} = 'PROCESSED' THEN 1 END)::int`,
        totalRefunded: sql<number>`COALESCE(SUM(CASE WHEN ${schema.refunds.status} = 'PROCESSED' THEN ${schema.refunds.refundableAmount} ELSE 0 END), 0)::int`,
      })
      .from(schema.refunds);

    const [webhookCounts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        processed: sql<number>`COUNT(CASE WHEN ${schema.webhookEvents.status} = 'PROCESSED' THEN 1 END)::int`,
        failed: sql<number>`COUNT(CASE WHEN ${schema.webhookEvents.status} = 'FAILED' THEN 1 END)::int`,
        pending: sql<number>`COUNT(CASE WHEN ${schema.webhookEvents.status} = 'PENDING' THEN 1 END)::int`,
      })
      .from(schema.webhookEvents);

    const trialBalance = await LedgerService.getTrialBalance();

    return {
      payments: paymentCounts,
      payouts: payoutCounts,
      refunds: refundCounts,
      webhooks: webhookCounts,
      ledger: {
        isBalanced: trialBalance.totals.isBalanced,
        totalDebits: trialBalance.totals.debits,
        totalCredits: trialBalance.totals.credits,
        imbalance: trialBalance.totals.imbalance,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Automate Check-In Settlement & Revenue Recognition
   * Scans confirmed bookings where check-in date is today or past,
   * releases advance escrow deposit liability, recognizes host payable & commission,
   * and moves payout queue status from HELD to READY_FOR_PAYOUT.
   */
  static async processDueSettlements() {
    const db = getDb();
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Find confirmed bookings with HELD payouts where check-in date <= today
    const duePayouts = await db
      .select({
        payoutId: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        hostId: schema.payouts.hostId,
        payoutStatus: schema.payouts.status,
        checkInDate: schema.bookings.checkInDate,
        totalAmount: schema.bookings.totalAmount,
        accommodationSubtotal: schema.bookings.accommodationSubtotal,
        nightlyPrice: schema.bookings.nightlyPrice,
        numberOfNights: schema.bookings.numberOfNights,
        serviceFee: schema.bookings.serviceFee,
        hostCommissionPct: schema.bookings.hostCommissionPct,
        hostCommissionAmount: schema.bookings.hostCommissionAmount,
        hostNetAmount: schema.bookings.hostNetAmount,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .where(
        and(
          eq(schema.payouts.status, "HELD"),
          eq(schema.bookings.status, "CONFIRMED"),
          sql`${schema.bookings.checkInDate} <= ${todayStr}`
        )
      );

    const processedBookingIds: string[] = [];
    let totalSettledAmount = 0;

    for (const item of duePayouts) {
      try {
        await db.transaction(async (tx) => {
          const accommodationSubtotal =
            item.accommodationSubtotal ||
            (item.nightlyPrice * item.numberOfNights) ||
            (item.totalAmount - (item.serviceFee || 0));

          const commissionRate = (item.hostCommissionPct || 10) / 100;
          const commissionAmount =
            item.hostCommissionAmount && item.hostCommissionAmount > 0
              ? item.hostCommissionAmount
              : Math.round(accommodationSubtotal * commissionRate);

          const netAmount = accommodationSubtotal - commissionAmount;

          await LedgerService.recognizeCheckInSettlement(tx, {
            bookingId: item.bookingId,
            accommodationSubtotal,
            hostNetAmount: netAmount,
            hostCommissionAmount: commissionAmount,
            createdById: null,
          });

          processedBookingIds.push(item.bookingId);
          totalSettledAmount += netAmount;
        });
      } catch (err: any) {
        console.error(`[Finance] Failed to process settlement for booking ${item.bookingId}:`, err.message);
      }
    }

    return {
      processedCount: processedBookingIds.length,
      bookingIds: processedBookingIds,
      totalSettledAmount,
      runAt: new Date().toISOString(),
    };
  }
}
