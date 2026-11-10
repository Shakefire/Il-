import { eq, desc, and, sql, gte, lte, isNull, isNotNull } from "drizzle-orm";
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
        payoutMode: schema.payouts.payoutMode,
        exceptionCode: schema.payouts.exceptionCode,
        exceptionReason: schema.payouts.exceptionReason,
        transferStatus: schema.payouts.transferStatus,
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

      if (payout.status === "HELD") {
        throw new Error(
          `Payout ${payoutId} is still HELD. Guest check-in + hold period (or admin settlement override) required before disbursement.`
        );
      }

      if (payout.status !== "READY_FOR_PAYOUT") {
        throw new Error(`Payout ${payoutId} cannot be disbursed from status ${payout.status}.`);
      }

      if (payout.exceptionCode === "ADMIN_HOLD") {
        throw new Error(
          `Payout ${payoutId} is on admin hold${payout.exceptionReason ? `: ${payout.exceptionReason}` : ""}. Clear hold before disbursement.`
        );
      }

      if (payout.exceptionCode === "ADMIN_REJECTED") {
        throw new Error(
          `Payout ${payoutId} was rejected by admin${payout.exceptionReason ? `: ${payout.exceptionReason}` : ""}.`
        );
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

      // Notify host of payout via orchestrator (email + inbox + push; non-fatal)
      import("../notifications/notifications.service").then(async ({ hostPayoutDisbursedEmail }) => {
        const { notifyUserEvent } = await import("../notifications/orchestrator");
        const [host] = await getDb()
          .select({
            id: schema.users.id,
            email: schema.users.email,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
          })
          .from(schema.users)
          .where(eq(schema.users.id, payout.hostId))
          .limit(1);

        if (host) {
          const masked = payout.accountNumber ? `******${payout.accountNumber.slice(-4)}` : undefined;
          const emailPayload = hostPayoutDisbursedEmail({
            hostName: `${host.firstName} ${host.lastName}`.trim(),
            hostEmail: host.email,
            amount: payout.amount,
            bankName: payout.bankName || undefined,
            accountNumberMasked: masked,
            transferRef: finalTransferRef || undefined,
            currency: payout.currency || "NGN",
          });
          notifyUserEvent({
            userId: host.id,
            event: "HOST_PAYOUT_DISBURSED",
            entityType: "payout",
            entityId: payout.id,
            category: "payout",
            channels: {
              category: "payout",
              email: emailPayload,
              inbox: {
                userId: host.id,
                title: "Payout sent to your bank",
                body: `Your earnings payout of ${payout.currency || "NGN"} ${payout.amount} was sent.`,
                deepLink: "/host/dashboard",
              },
              push: true,
            },
          });
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

      // Approved Phase 9 rule: refund amount = paid − recorded Paystack fee (admin-only execution).
      const grossPaid = booking.totalAmount || 0;
      const recordedFee =
        typeof booking.paystackFeeAmount === "number" && booking.paystackFeeAmount > 0
          ? booking.paystackFeeAmount
          : 0;
      const refundableAmount = Math.max(0, grossPaid - recordedFee);

      // Real Paystack Refund Integration (Phase 6)
      let resolvedPaystackRefundId = paystackRefundId || null;
      const [payment] = await tx
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.bookingId, bookingId), eq(schema.payments.status, "SUCCESS")))
        .limit(1);

      const skipLivePaystackRefund =
        process.env.PAYSTACK_MOCK_TRANSFERS === "true" || process.env.NODE_ENV === "test";

      if (
        !skipLivePaystackRefund &&
        env.PAYSTACK_SECRET_KEY &&
        payment &&
        (payment.gatewayReference || payment.reference)
      ) {
        const paystackTx = payment.gatewayReference || payment.reference;
        console.log(`[Finance] Executing real Paystack refund for tx: ${paystackTx}, amount: ₦${refundableAmount}`);

        const paystackRes = await fetch("https://api.paystack.co/refund", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: paystackTx,
            amount: refundableAmount * 100, // in kobo
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
        grossPaid,
        refundableAmount,
        nonRefundableProcessingFee: recordedFee,
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
            refundAmount: refundableAmount,
            currency: booking.currency || "NGN",
            status: "PROCESSED",
          })
        ).catch((e) => console.warn("[Finance] Failed to send booking refund email:", e));
      });

      return {
        success: true,
        bookingId: booking.id,
        refundedAmount: refundableAmount,
        processingFeeRetained: recordedFee,
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

      // Execute real Paystack refund if key is present (skip under transfer mock / test)
      const [payment] = await tx
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.bookingId, refund.bookingId), eq(schema.payments.status, "SUCCESS")))
        .limit(1);

      const skipLivePaystackRefund =
        process.env.PAYSTACK_MOCK_TRANSFERS === "true" || process.env.NODE_ENV === "test";

      if (
        !skipLivePaystackRefund &&
        env.PAYSTACK_SECRET_KEY &&
        payment &&
        (payment.gatewayReference || payment.reference)
      ) {
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
      } else if (skipLivePaystackRefund && !resolvedPaystackRefundId) {
        resolvedPaystackRefundId = `mock_refund_${refundId}`;
      }

      // Journal + cancel booking/payouts; update THIS refund row (no duplicate PROCESSED insert).
      const ledgerResult = await LedgerService.recordBookingRefund(tx, {
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid: refund.grossPaid || booking.totalAmount,
        refundableAmount: refund.refundableAmount,
        nonRefundableProcessingFee: refund.nonRefundableProcessingFee,
        adminId,
        reason: refund.reason || undefined,
        adminNotes: refund.adminNotes || undefined,
        paystackRefundId: resolvedPaystackRefundId,
        existingRefundId: refundId,
      });

      const [processed] = await tx
        .select()
        .from(schema.refunds)
        .where(eq(schema.refunds.id, refundId))
        .limit(1);

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: adminId,
        action: "ADMIN_PROCESS_REFUND",
        entityType: "REFUND",
        entityId: refundId,
        details: JSON.stringify({
          refundId,
          bookingId: booking.id,
          refundableAmount: refund.refundableAmount,
          paystackRefundId: resolvedPaystackRefundId,
          journalId: ledgerResult.journal?.id,
        }),
        createdAt: new Date(),
      });

      // Release availability after processed refund
      await tx
        .delete(schema.availabilityBlocks)
        .where(eq(schema.availabilityBlocks.bookingId, booking.id));

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
   * Phase 7 settlement eligibility (single source of truth).
   * Requires: CONFIRMED/COMPLETED, guest check-in (unless adminOverride),
   * calendar date reached, payout hold elapsed, HELD payout, no open refund.
   */
  static async evaluateSettlementEligibility(
    bookingId: string,
    options: { adminOverride?: boolean } = {}
  ): Promise<{
    eligible: boolean;
    reason: string;
    alreadyReleased?: boolean;
    booking?: typeof schema.bookings.$inferSelect;
    payout?: typeof schema.payouts.$inferSelect;
    hostNetAmount?: number;
    accommodationSubtotal?: number;
    commissionAmount?: number;
  }> {
    const db = getDb();
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { eligible: false, reason: "Booking not found" };
    }

    if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
      return { eligible: false, reason: `Booking status ${booking.status} is not settleable`, booking };
    }

    const [openRefund] = await db
      .select({ id: schema.refunds.id, status: schema.refunds.status })
      .from(schema.refunds)
      .where(
        and(
          eq(schema.refunds.bookingId, bookingId),
          sql`${schema.refunds.status} IN ('REQUESTED', 'APPROVED', 'PROCESSED')`
        )
      )
      .limit(1);

    if (openRefund) {
      return {
        eligible: false,
        reason: `Blocked by refund ${openRefund.status}`,
        booking,
      };
    }

    if (!options.adminOverride && !booking.guestCheckInConfirmedAt) {
      return {
        eligible: false,
        reason: "Guest check-in confirmation required",
        booking,
      };
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (booking.checkInDate > todayStr) {
      return {
        eligible: false,
        reason: `Check-in date ${booking.checkInDate} not reached`,
        booking,
      };
    }

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD")))
      .limit(1);

    if (!payout) {
      const [anyPayout] = await db
        .select({ status: schema.payouts.status })
        .from(schema.payouts)
        .where(eq(schema.payouts.bookingId, bookingId))
        .limit(1);
      const alreadyReleased =
        !!anyPayout &&
        (anyPayout.status === "READY_FOR_PAYOUT" ||
          anyPayout.status === "PROCESSING" ||
          anyPayout.status === "PAID");
      return {
        eligible: false,
        reason: anyPayout
          ? `Payout already ${anyPayout.status}`
          : "No HELD payout for booking",
        booking,
        alreadyReleased,
      };
    }

    if (payout.scheduledFor && new Date(payout.scheduledFor).getTime() > Date.now()) {
      return {
        eligible: false,
        reason: `Payout hold until ${payout.scheduledFor.toISOString()}`,
        booking,
        payout,
      };
    }

    const accommodationSubtotal =
      booking.accommodationSubtotal ||
      booking.nightlyPrice * booking.numberOfNights ||
      booking.totalAmount - (booking.serviceFee || 0);

    const commissionAmount =
      booking.hostCommissionAmount && booking.hostCommissionAmount > 0
        ? booking.hostCommissionAmount
        : Math.round(accommodationSubtotal * ((booking.hostCommissionPct || 10) / 100));

    const hostNetAmount =
      booking.hostNetAmount && booking.hostNetAmount > 0
        ? booking.hostNetAmount
        : accommodationSubtotal - commissionAmount;

    // Guard: refuse to post CHECKIN_RECOGNITION when booking snapshot legs don't zero-sum.
    // Leftover imbalanced fixtures / corrupt snapshots skip cleanly instead of throwing mid-job.
    if (hostNetAmount + commissionAmount !== accommodationSubtotal) {
      return {
        eligible: false,
        reason: `Settlement snapshot imbalanced (accommodation ₦${accommodationSubtotal} !== hostNet ₦${hostNetAmount} + commission ₦${commissionAmount}). Fix booking financial snapshot before release.`,
        booking,
        payout,
        hostNetAmount,
        accommodationSubtotal,
        commissionAmount,
      };
    }

    return {
      eligible: true,
      reason: "Eligible for settlement release",
      booking,
      payout,
      hostNetAmount,
      accommodationSubtotal,
      commissionAmount,
    };
  }

  /**
   * Idempotent release HELD → READY_FOR_PAYOUT + CHECKIN_RECOGNITION journal.
   */
  static async tryReleaseSettlementForBooking(
    bookingId: string,
    meta: {
      triggeredBy: "GUEST_CHECK_IN" | "CALENDAR_JOB" | "ADMIN_OVERRIDE";
      actorId?: string | null;
      adminOverride?: boolean;
      overrideReason?: string | null;
    }
  ): Promise<{ released: boolean; reason: string; journalId?: string; alreadyReleased?: boolean }> {
    const evaluation = await this.evaluateSettlementEligibility(bookingId, {
      adminOverride: meta.adminOverride || meta.triggeredBy === "ADMIN_OVERRIDE",
    });

    if (!evaluation.eligible) {
      return {
        released: false,
        reason: evaluation.reason,
        alreadyReleased: !!evaluation.alreadyReleased,
      };
    }

    const db = getDb();
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(schema.payouts)
        .where(
          and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD"))
        )
        .for("update")
        .limit(1);

      if (!locked) {
        return {
          released: false,
          reason: "Payout no longer HELD (already released or cancelled)",
          alreadyReleased: true,
        };
      }

      const result = await LedgerService.recognizeCheckInSettlement(tx, {
        bookingId,
        accommodationSubtotal: evaluation.accommodationSubtotal!,
        hostNetAmount: evaluation.hostNetAmount!,
        hostCommissionAmount: evaluation.commissionAmount!,
        createdById: meta.actorId || null,
      });

      // If journal already existed, recognizeCheckInSettlement returns early —
      // still move HELD → READY_FOR_PAYOUT once (idempotent conditional update).
      if (result.alreadyRecorded) {
        await tx
          .update(schema.payouts)
          .set({ status: "READY_FOR_PAYOUT", updatedAt: new Date() })
          .where(and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD")));
        await tx
          .update(schema.hostEarnings)
          .set({ status: "READY" })
          .where(
            and(eq(schema.hostEarnings.bookingId, bookingId), eq(schema.hostEarnings.status, "PENDING"))
          );
      }

      if (meta.adminOverride || meta.triggeredBy === "ADMIN_OVERRIDE") {
        await tx
          .update(schema.bookings)
          .set({
            settlementOverrideReason: meta.overrideReason || "Admin settlement override",
            settlementOverrideBy: meta.actorId || null,
            settlementOverrideAt: new Date(),
            // Ensure check-in gate is satisfied for downstream reads without inventing guest action
            guestCheckInConfirmedAt: evaluation.booking?.guestCheckInConfirmedAt || new Date(),
            guestCheckInConfirmedBy:
              evaluation.booking?.guestCheckInConfirmedBy || meta.actorId || "admin_override",
            updatedAt: new Date(),
          })
          .where(eq(schema.bookings.id, bookingId));
      }

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: meta.actorId || null,
        action:
          meta.triggeredBy === "ADMIN_OVERRIDE"
            ? "SETTLEMENT_ADMIN_OVERRIDE"
            : "SETTLEMENT_RELEASED",
        entityType: "booking",
        entityId: bookingId,
        details: JSON.stringify({
          at: new Date().toISOString(),
          triggeredBy: meta.triggeredBy,
          payoutId: locked.id,
          amount: locked.amount,
          overrideReason: meta.overrideReason || null,
          alreadyRecorded: result.alreadyRecorded,
          journalId: result.journal?.id || result.journalId,
        }),
      });

      return {
        released: true,
        reason: result.alreadyRecorded
          ? "Settlement journal already existed; payout moved if still HELD"
          : "Settlement released to READY_FOR_PAYOUT",
        journalId: result.journal?.id || result.journalId,
        alreadyReleased: result.alreadyRecorded,
      };
    });
  }

  /**
   * Admin override — skips guest check-in only. Still blocks refunds and posts ledger once.
   */
  static async adminOverrideSettlement(
    adminId: string,
    params: { bookingId: string; reason: string }
  ) {
    const reason = (params.reason || "").trim();
    if (reason.length < 8) {
      throw new Error("Override reason is required (min 8 characters).");
    }

    const result = await this.tryReleaseSettlementForBooking(params.bookingId, {
      triggeredBy: "ADMIN_OVERRIDE",
      actorId: adminId,
      adminOverride: true,
      overrideReason: reason,
    });

    if (!result.released && !result.alreadyReleased) {
      throw new Error(result.reason);
    }

    return {
      success: true,
      ...result,
      bookingId: params.bookingId,
      adminId,
      reason,
    };
  }

  /**
   * Calendar/cron job: only releases when guest check-in + hold + calendar are met.
   */
  static async processDueSettlements() {
    const db = getDb();
    const todayStr = new Date().toISOString().split("T")[0];

    const candidates = await db
      .select({
        bookingId: schema.payouts.bookingId,
        amount: schema.payouts.amount,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .where(
        and(
          eq(schema.payouts.status, "HELD"),
          sql`${schema.bookings.status} IN ('CONFIRMED', 'COMPLETED')`,
          sql`${schema.bookings.checkInDate} <= ${todayStr}`,
          isNotNull(schema.bookings.guestCheckInConfirmedAt)
        )
      );

    const processedBookingIds: string[] = [];
    const skipped: Array<{ bookingId: string; reason: string }> = [];
    let totalSettledAmount = 0;

    for (const item of candidates) {
      try {
        const result = await this.tryReleaseSettlementForBooking(item.bookingId, {
          triggeredBy: "CALENDAR_JOB",
          actorId: null,
        });
        if (result.released) {
          processedBookingIds.push(item.bookingId);
          totalSettledAmount += item.amount;
        } else {
          skipped.push({ bookingId: item.bookingId, reason: result.reason });
        }
      } catch (err: any) {
        console.error(
          `[Finance] Failed to process settlement for booking ${item.bookingId}:`,
          err.message
        );
        skipped.push({ bookingId: item.bookingId, reason: err.message });
      }
    }

    return {
      processedCount: processedBookingIds.length,
      bookingIds: processedBookingIds,
      skipped,
      totalSettledAmount,
      runAt: new Date().toISOString(),
    };
  }

  /**
   * Read current platform host payout mode (defaults MANUAL).
   */
  static async getHostPayoutMode(): Promise<"AUTOMATIC" | "MANUAL"> {
    const db = getDb();
    try {
      const [settings] = await db
        .select({ hostPayoutMode: schema.platformSettings.hostPayoutMode })
        .from(schema.platformSettings)
        .where(eq(schema.platformSettings.id, "default"))
        .limit(1);
      return settings?.hostPayoutMode === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
    } catch {
      return "MANUAL";
    }
  }

  /**
   * After backend-verified guest payment:
   * - MANUAL: leave HELD payout for check-in settlement (no auto drain).
   * - AUTOMATIC: release payable without check-in, then transfer if bank verified.
   * Idempotent. Never invents success when bank/balance/transfer is missing.
   */
  static async handlePostPaymentPayout(bookingId: string): Promise<{
    mode: "AUTOMATIC" | "MANUAL" | "UNKNOWN";
    attempted: boolean;
    payoutId?: string;
    released?: boolean;
    transferStatus?: string;
    exceptionCode?: string | null;
    reason: string;
  }> {
    const db = getDb();
    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId))
      .orderBy(desc(schema.payouts.createdAt))
      .limit(1);

    if (!payout) {
      return {
        mode: "UNKNOWN",
        attempted: false,
        reason: "No payout row for booking after payment",
      };
    }

    const mode = payout.payoutMode === "AUTOMATIC" ? "AUTOMATIC" : "MANUAL";
    if (mode !== "AUTOMATIC") {
      return {
        mode: "MANUAL",
        attempted: false,
        payoutId: payout.id,
        reason:
          "MANUAL mode — payable remains pending until check-in settlement / admin queue",
      };
    }

    if (
      payout.status === "PAID" ||
      payout.status === "PROCESSING" ||
      payout.status === "CANCELLED"
    ) {
      return {
        mode: "AUTOMATIC",
        attempted: false,
        payoutId: payout.id,
        transferStatus: payout.transferStatus,
        exceptionCode: payout.exceptionCode,
        reason: `Payout already ${payout.status} — idempotent skip`,
      };
    }

    const release = await this.releaseForAutomaticPayout(bookingId);
    if (!release.released && !release.alreadyReleased) {
      return {
        mode: "AUTOMATIC",
        attempted: true,
        payoutId: payout.id,
        released: false,
        reason: release.reason,
        exceptionCode: "RELEASE_FAILED",
      };
    }

    const transfer = await this.attemptAutomaticHostTransfer(payout.id);
    return {
      mode: "AUTOMATIC",
      attempted: true,
      payoutId: payout.id,
      released: true,
      transferStatus: transfer.transferStatus,
      exceptionCode: transfer.exceptionCode,
      reason: transfer.reason,
    };
  }

  /**
   * AUTOMATIC path: post CHECKIN_RECOGNITION + move HELD→READY without guest check-in.
   * Keeps ledger balanced so HOST_PAYOUT_DISBURSED can debit 2020.
   * Does not initiate transfer (see attemptAutomaticHostTransfer).
   */
  static async releaseForAutomaticPayout(bookingId: string): Promise<{
    released: boolean;
    alreadyReleased?: boolean;
    reason: string;
    journalId?: string;
  }> {
    const db = getDb();
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return { released: false, reason: "Booking not found" };
    }

    if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
      return {
        released: false,
        reason: `Booking status ${booking.status} is not settleable for automatic payout`,
      };
    }

    const [openRefund] = await db
      .select({ id: schema.refunds.id, status: schema.refunds.status })
      .from(schema.refunds)
      .where(
        and(
          eq(schema.refunds.bookingId, bookingId),
          sql`${schema.refunds.status} IN ('REQUESTED', 'APPROVED', 'PROCESSED')`
        )
      )
      .limit(1);

    if (openRefund) {
      return {
        released: false,
        reason: `Blocked by refund ${openRefund.status}`,
      };
    }

    const [payout] = await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.bookingId, bookingId))
      .orderBy(desc(schema.payouts.createdAt))
      .limit(1);

    if (!payout) {
      return { released: false, reason: "No payout for booking" };
    }

    if (payout.payoutMode !== "AUTOMATIC") {
      return {
        released: false,
        reason: "Payout is not stamped AUTOMATIC — refusing check-in bypass",
      };
    }

    if (
      payout.status === "READY_FOR_PAYOUT" ||
      payout.status === "PROCESSING" ||
      payout.status === "PAID"
    ) {
      return {
        released: false,
        alreadyReleased: true,
        reason: `Payout already ${payout.status}`,
      };
    }

    if (payout.status !== "HELD") {
      return {
        released: false,
        reason: `Cannot auto-release from status ${payout.status}`,
      };
    }

    const accommodationSubtotal =
      booking.accommodationSubtotal ||
      booking.nightlyPrice * booking.numberOfNights ||
      booking.totalAmount - (booking.serviceFee || 0);

    const commissionAmount =
      booking.hostCommissionAmount && booking.hostCommissionAmount > 0
        ? booking.hostCommissionAmount
        : Math.round(accommodationSubtotal * ((booking.hostCommissionPct || 10) / 100));

    const hostNetAmount =
      booking.hostNetAmount && booking.hostNetAmount > 0
        ? booking.hostNetAmount
        : accommodationSubtotal - commissionAmount;

    if (hostNetAmount + commissionAmount !== accommodationSubtotal) {
      return {
        released: false,
        reason: `Settlement snapshot imbalanced (accommodation ₦${accommodationSubtotal} !== hostNet ₦${hostNetAmount} + commission ₦${commissionAmount})`,
      };
    }

    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(schema.payouts)
        .where(
          and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD"))
        )
        .for("update")
        .limit(1);

      if (!locked) {
        return {
          released: false,
          alreadyReleased: true,
          reason: "Payout no longer HELD",
        };
      }

      const result = await LedgerService.recognizeCheckInSettlement(tx, {
        bookingId,
        accommodationSubtotal,
        hostNetAmount,
        hostCommissionAmount: commissionAmount,
        createdById: null,
      });

      if (result.alreadyRecorded) {
        await tx
          .update(schema.payouts)
          .set({ status: "READY_FOR_PAYOUT", updatedAt: new Date() })
          .where(
            and(eq(schema.payouts.bookingId, bookingId), eq(schema.payouts.status, "HELD"))
          );
        await tx
          .update(schema.hostEarnings)
          .set({ status: "READY" })
          .where(
            and(
              eq(schema.hostEarnings.bookingId, bookingId),
              eq(schema.hostEarnings.status, "PENDING")
            )
          );
      }

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: null,
        action: "AUTOMATIC_PAYOUT_RELEASED",
        entityType: "booking",
        entityId: bookingId,
        details: JSON.stringify({
          at: new Date().toISOString(),
          payoutId: locked.id,
          amount: locked.amount,
          checkInBypassed: true,
          reason: "PO AUTOMATIC mode — verified payment releases payable without check-in gate",
          journalId: result.journal?.id || result.journalId,
        }),
      });

      return {
        released: true,
        reason: result.alreadyRecorded
          ? "Settlement journal already existed; payout moved if still HELD"
          : "AUTOMATIC settlement released to READY_FOR_PAYOUT (check-in not required)",
        journalId: result.journal?.id || result.journalId,
      };
    });
  }

  /**
   * Initiate host Paystack transfer for an AUTOMATIC READY payout.
   * No bank → exception (not fake success). Uncertain → leave PROCESSING for reconcile.
   * Insufficient balance → exception, restore READY. Never auto-retries uncertain transfers.
   */
  static async attemptAutomaticHostTransfer(payoutId: string): Promise<{
    success: boolean;
    transferStatus: string;
    exceptionCode?: string | null;
    reason: string;
    transferRef?: string;
  }> {
    const db = getDb();

    return await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .for("update")
        .limit(1);

      if (!payout) {
        return {
          success: false,
          transferStatus: "UNINITIATED",
          exceptionCode: "PAYOUT_NOT_FOUND",
          reason: "Payout not found",
        };
      }

      if (payout.payoutMode !== "AUTOMATIC") {
        return {
          success: false,
          transferStatus: payout.transferStatus,
          reason: "Not an AUTOMATIC payout — refusing auto transfer",
        };
      }

      if (payout.status === "PAID" || payout.status === "PROCESSING") {
        return {
          success: true,
          transferStatus: payout.transferStatus,
          exceptionCode: payout.exceptionCode,
          reason: `Idempotent skip — already ${payout.status}`,
          transferRef: payout.paystackTransferRef || undefined,
        };
      }

      if (payout.status !== "READY_FOR_PAYOUT") {
        return {
          success: false,
          transferStatus: payout.transferStatus,
          reason: `Cannot auto-transfer from status ${payout.status}`,
        };
      }

      if (
        payout.transferStatus === "PENDING" ||
        payout.transferStatus === "SUCCESS"
      ) {
        return {
          success: true,
          transferStatus: payout.transferStatus,
          reason: "Idempotent skip — transfer already initiated",
          transferRef: payout.paystackTransferRef || undefined,
        };
      }

      if (payout.exceptionCode === "ADMIN_HOLD" || payout.exceptionCode === "ADMIN_REJECTED") {
        return {
          success: false,
          transferStatus: payout.transferStatus,
          exceptionCode: payout.exceptionCode,
          reason: payout.exceptionReason || payout.exceptionCode,
        };
      }

      const [profile] = await tx
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, payout.hostId))
        .limit(1);

      const hasVerifiedBank = !!(
        (payout.accountNumber && payout.bankCode) ||
        (profile?.bankAccountNumber &&
          profile?.bankCode &&
          profile?.bankAccountVerifiedAt)
      );

      if (!hasVerifiedBank) {
        await tx
          .update(schema.payouts)
          .set({
            exceptionCode: "NO_VERIFIED_BANK",
            exceptionReason:
              "AUTOMATIC payout blocked: host has no Paystack-verified Nigerian bank account. Payable remains ready for admin/host remediation — not marked paid.",
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, payout.id));

        await tx.insert(schema.auditLogs).values({
          id: `audit_${crypto.randomUUID()}`,
          userId: null,
          action: "AUTOMATIC_PAYOUT_EXCEPTION",
          entityType: "payout",
          entityId: payout.id,
          details: JSON.stringify({
            code: "NO_VERIFIED_BANK",
            bookingId: payout.bookingId,
            amount: payout.amount,
          }),
        });

        return {
          success: false,
          transferStatus: "UNINITIATED",
          exceptionCode: "NO_VERIFIED_BANK",
          reason: "No verified bank — exception recorded for admin",
        };
      }

      // Sync bank snapshot from profile when payout row incomplete
      if ((!payout.accountNumber || !payout.bankCode) && profile) {
        await tx
          .update(schema.payouts)
          .set({
            bankCode: profile.bankCode,
            bankName: profile.bankName,
            accountNumber: profile.bankAccountNumber,
            accountName: profile.bankAccountName,
            paystackRecipientCode:
              payout.paystackRecipientCode || profile.paystackRecipientCode || null,
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, payout.id));
      }

      let recipientCode =
        payout.paystackRecipientCode || profile?.paystackRecipientCode || null;
      const accountNumber = payout.accountNumber || profile?.bankAccountNumber!;
      const bankCode = payout.bankCode || profile?.bankCode!;
      const accountName =
        payout.accountName || profile?.bankAccountName || "Host";

      if (!recipientCode) {
        const recRes = await PaystackTransferService.createTransferRecipient({
          name: accountName,
          accountNumber,
          bankCode,
          description: `Ilé Automatic Host Payout - ${payout.hostId}`,
        });
        if (!recRes.success || !recRes.recipientCode) {
          await tx
            .update(schema.payouts)
            .set({
              exceptionCode: "RECIPIENT_FAILED",
              exceptionReason: recRes.error || "Paystack recipient registration failed",
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, payout.id));
          return {
            success: false,
            transferStatus: "UNINITIATED",
            exceptionCode: "RECIPIENT_FAILED",
            reason: recRes.error || "Recipient registration failed",
          };
        }
        recipientCode = recRes.recipientCode;
        await tx
          .update(schema.profiles)
          .set({ paystackRecipientCode: recipientCode })
          .where(eq(schema.profiles.userId, payout.hostId));
      }

      const transferRef = `ILE_AUTO_${payout.id.replace(/[^a-zA-Z0-9]/g, "").slice(-16)}_${Date.now()}`;
      const transferRes = await PaystackTransferService.initiateTransfer({
        amountNaira: payout.amount,
        recipientCode,
        reference: transferRef,
        reason: `Ilé automatic host payout for booking #${payout.bookingId}`,
      });

      if (!transferRes.success || transferRes.status === "failed" || transferRes.status === "otp_required") {
        const insufficient =
          /insufficient|balance/i.test(transferRes.error || "") ||
          transferRes.error === "INSUFFICIENT_BALANCE";
        await tx
          .update(schema.payouts)
          .set({
            status: "READY_FOR_PAYOUT",
            transferStatus: "FAILED",
            transferFailureReason: transferRes.error || "Transfer initiation failed",
            exceptionCode: insufficient ? "INSUFFICIENT_BALANCE" : "TRANSFER_FAILED",
            exceptionReason: transferRes.error || "Transfer initiation failed",
            paystackTransferRef: transferRef,
            paystackRecipientCode: recipientCode,
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, payout.id));

        await tx.insert(schema.auditLogs).values({
          id: `audit_${crypto.randomUUID()}`,
          userId: null,
          action: "AUTOMATIC_PAYOUT_EXCEPTION",
          entityType: "payout",
          entityId: payout.id,
          details: JSON.stringify({
            code: insufficient ? "INSUFFICIENT_BALANCE" : "TRANSFER_FAILED",
            error: transferRes.error,
            transferRef,
          }),
        });

        return {
          success: false,
          transferStatus: "FAILED",
          exceptionCode: insufficient ? "INSUFFICIENT_BALANCE" : "TRANSFER_FAILED",
          reason: transferRes.error || "Transfer initiation failed",
          transferRef,
        };
      }

      if (transferRes.status === "pending") {
        // Uncertain / in-flight — PROCESSING for webhook reconcile; do NOT auto-retry.
        await tx
          .update(schema.payouts)
          .set({
            status: "PROCESSING",
            transferStatus: "PENDING",
            paystackTransferRef: transferRef,
            paystackTransferCode: transferRes.transferCode || null,
            paystackRecipientCode: recipientCode,
            exceptionCode: null,
            exceptionReason: null,
            notes: "AUTOMATIC transfer initiated — awaiting Paystack reconcile webhook",
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, payout.id));

        await tx.insert(schema.auditLogs).values({
          id: `audit_${crypto.randomUUID()}`,
          userId: null,
          action: "AUTOMATIC_PAYOUT_TRANSFER_PENDING",
          entityType: "payout",
          entityId: payout.id,
          details: JSON.stringify({ transferRef, amount: payout.amount }),
        });

        return {
          success: true,
          transferStatus: "PENDING",
          reason: "Transfer pending — reconcile via webhook, no auto-retry",
          transferRef,
        };
      }

      // Immediate success (mock / rare sync success)
      await LedgerService.recordHostPayout(tx, {
        payoutId: payout.id,
        bookingId: payout.bookingId,
        hostId: payout.hostId,
        amount: payout.amount,
        adminId: null,
        transferRef,
        notes: "AUTOMATIC host payout (immediate success)",
      });

      await tx
        .update(schema.payouts)
        .set({
          transferStatus: "SUCCESS",
          paystackTransferRef: transferRef,
          paystackTransferCode: transferRes.transferCode || null,
          paystackRecipientCode: recipientCode,
          exceptionCode: null,
          exceptionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.payouts.id, payout.id));

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: null,
        action: "AUTOMATIC_PAYOUT_TRANSFER_SUCCESS",
        entityType: "payout",
        entityId: payout.id,
        details: JSON.stringify({ transferRef, amount: payout.amount }),
      });

      return {
        success: true,
        transferStatus: "SUCCESS",
        reason: "AUTOMATIC transfer completed",
        transferRef,
      };
    });
  }

  /**
   * MANUAL queue: approve payout for disbursement (sets approvedAt).
   */
  static async approvePayout(adminId: string, payoutId: string, notes?: string) {
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .for("update")
        .limit(1);

      if (!payout) throw new Error(`Payout ${payoutId} not found`);
      if (payout.status !== "READY_FOR_PAYOUT" && payout.status !== "HELD") {
        throw new Error(`Cannot approve payout in status ${payout.status}`);
      }
      if (payout.exceptionCode === "ADMIN_REJECTED") {
        throw new Error("Payout was rejected — clear rejection before approve is not supported; create ops ticket.");
      }

      const [updated] = await tx
        .update(schema.payouts)
        .set({
          approvedAt: new Date(),
          approvedBy: adminId,
          exceptionCode: null,
          exceptionReason: null,
          notes: notes || payout.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.payouts.id, payoutId))
        .returning();

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: adminId,
        action: "PAYOUT_APPROVED",
        entityType: "payout",
        entityId: payoutId,
        details: JSON.stringify({ notes: notes || null, status: payout.status }),
      });

      return { success: true, payout: updated };
    });
  }

  /**
   * MANUAL queue: hold payout with reason (blocks disburse until cleared via approve).
   */
  static async holdPayout(adminId: string, payoutId: string, reason: string) {
    const trimmed = (reason || "").trim();
    if (trimmed.length < 5) {
      throw new Error("Hold reason is required (min 5 characters).");
    }
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .for("update")
        .limit(1);

      if (!payout) throw new Error(`Payout ${payoutId} not found`);
      if (payout.status === "PAID" || payout.status === "PROCESSING" || payout.status === "CANCELLED") {
        throw new Error(`Cannot hold payout in status ${payout.status}`);
      }

      const [updated] = await tx
        .update(schema.payouts)
        .set({
          exceptionCode: "ADMIN_HOLD",
          exceptionReason: trimmed,
          approvedAt: null,
          approvedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.payouts.id, payoutId))
        .returning();

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: adminId,
        action: "PAYOUT_HELD",
        entityType: "payout",
        entityId: payoutId,
        details: JSON.stringify({ reason: trimmed }),
      });

      return { success: true, payout: updated };
    });
  }

  /**
   * MANUAL queue: reject payout with reason. Blocks transfer; does not reverse ledger
   * recognition journals (admin finance must reconcile separately if needed).
   */
  static async rejectPayout(adminId: string, payoutId: string, reason: string) {
    const trimmed = (reason || "").trim();
    if (trimmed.length < 5) {
      throw new Error("Reject reason is required (min 5 characters).");
    }
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [payout] = await tx
        .select()
        .from(schema.payouts)
        .where(eq(schema.payouts.id, payoutId))
        .for("update")
        .limit(1);

      if (!payout) throw new Error(`Payout ${payoutId} not found`);
      if (payout.status === "PAID" || payout.status === "PROCESSING") {
        throw new Error(`Cannot reject in-flight/paid payout (${payout.status})`);
      }
      if (payout.transferStatus === "PENDING" || payout.transferStatus === "SUCCESS") {
        throw new Error("Cannot reject payout with initiated transfer — reconcile instead.");
      }

      const [updated] = await tx
        .update(schema.payouts)
        .set({
          exceptionCode: "ADMIN_REJECTED",
          exceptionReason: trimmed,
          notes: `Rejected: ${trimmed}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.payouts.id, payoutId))
        .returning();

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: adminId,
        action: "PAYOUT_REJECTED",
        entityType: "payout",
        entityId: payoutId,
        details: JSON.stringify({ reason: trimmed, statusPreserved: payout.status }),
      });

      return { success: true, payout: updated };
    });
  }

  /**
   * Host wallet projection — no separate balance table.
   */
  static async getHostWallet(hostId: string) {
    const db = getDb();
    const [totals] = await db
      .select({
        pending: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'HELD' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        available: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'READY_FOR_PAYOUT' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        processing: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PROCESSING' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        paid: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PAID' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
      })
      .from(schema.payouts)
      .where(eq(schema.payouts.hostId, hostId));

    const history = await db
      .select({
        id: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        amount: schema.payouts.amount,
        currency: schema.payouts.currency,
        status: schema.payouts.status,
        payoutMode: schema.payouts.payoutMode,
        exceptionCode: schema.payouts.exceptionCode,
        exceptionReason: schema.payouts.exceptionReason,
        transferStatus: schema.payouts.transferStatus,
        bankName: schema.payouts.bankName,
        accountNumber: schema.payouts.accountNumber,
        accountName: schema.payouts.accountName,
        scheduledFor: schema.payouts.scheduledFor,
        disbursedAt: schema.payouts.disbursedAt,
        paystackTransferRef: schema.payouts.paystackTransferRef,
        createdAt: schema.payouts.createdAt,
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        checkInDate: schema.bookings.checkInDate,
        guestCheckInConfirmedAt: schema.bookings.guestCheckInConfirmedAt,
        hostCommissionAmount: schema.bookings.hostCommissionAmount,
        hostNetAmount: schema.bookings.hostNetAmount,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .where(eq(schema.payouts.hostId, hostId))
      .orderBy(desc(schema.payouts.createdAt))
      .limit(100);

    const platformMode = await this.getHostPayoutMode();

    const [profile] = await db
      .select({
        bankName: schema.profiles.bankName,
        bankCode: schema.profiles.bankCode,
        bankAccountNumber: schema.profiles.bankAccountNumber,
        bankAccountName: schema.profiles.bankAccountName,
        bankAccountVerifiedAt: schema.profiles.bankAccountVerifiedAt,
        paystackRecipientCode: schema.profiles.paystackRecipientCode,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, hostId))
      .limit(1);

    const hasVerifiedBank = !!(
      profile?.bankAccountNumber &&
      profile?.bankCode &&
      profile?.bankAccountVerifiedAt
    );

    return {
      balances: {
        pending: totals?.pending || 0,
        available: totals?.available || 0,
        processing: totals?.processing || 0,
        paid: totals?.paid || 0,
        currency: "NGN",
      },
      payoutMode: platformMode,
      labels: {
        pending:
          platformMode === "AUTOMATIC"
            ? "Pending payable (awaiting automatic release or bank fix)"
            : "Pending (held until guest check-in + hold period — manual settlement)",
        available: "Available / payable (ready for withdrawal or automatic transfer)",
        processing: "Processing (transfer in flight — not retriable from the app)",
        paid: "Paid to your verified bank (success)",
        commission:
          "Ilé commission was snapshotted on each booking — not recalculated later",
        automatic:
          "Automatic mode pays host net after verified guest payment when bank is verified",
        manual:
          "Manual mode keeps earnings pending until check-in settlement and admin disbursement",
      },
      bank: hasVerifiedBank
        ? {
            verified: true,
            bankName: profile!.bankName,
            bankCode: profile!.bankCode,
            accountName: profile!.bankAccountName,
            accountNumberMasked: maskAccountNumber(profile!.bankAccountNumber),
            verifiedAt: profile!.bankAccountVerifiedAt,
          }
        : { verified: false, account: null },
      /** Approved interim (PO): Ilé absorbs Paystack transfer fees — ₦0 deducted from host. */
      feePolicy: {
        withdrawalFeeNaira: 0,
        ileAbsorbsTransferFee: true,
        note:
          "Approved interim: host withdrawal fee deducted = ₦0 (Ilé absorbs Paystack transfer fees). Ledger 5020 unused until PO revises fee policy.",
      },
      history: history.map((row) => {
        const modeLabel = row.payoutMode === "AUTOMATIC" ? "Auto" : "Manual";
        let displayStatus =
          row.status === "HELD"
            ? `Pending (${modeLabel})`
            : row.status === "READY_FOR_PAYOUT"
              ? row.exceptionCode === "NO_VERIFIED_BANK"
                ? "Payable — bank required"
                : row.exceptionCode === "ADMIN_HOLD"
                  ? "On hold"
                  : row.exceptionCode === "ADMIN_REJECTED"
                    ? "Rejected"
                    : `Available (${modeLabel})`
              : row.status === "PROCESSING"
                ? "Processing"
                : row.status === "PAID"
                  ? "Paid — success"
                  : row.status === "FAILED"
                    ? "Failed — admin reconcile"
                    : row.status;
        return {
          ...row,
          accountNumberMasked: maskAccountNumber(row.accountNumber),
          accountNumber: undefined,
          displayStatus,
          commissionAmount: row.hostCommissionAmount || 0,
          payableAmount: row.hostNetAmount || row.amount,
        };
      }),
    };
  }

  /**
   * Host withdrawal: atomically reserve READY_FOR_PAYOUT rows → PROCESSING → Paystack.
   * Concurrent-safe via FOR UPDATE. Idempotent transfer refs per batch.
   */
  static async requestHostWithdrawal(
    hostId: string,
    params: { amountNaira?: number; payoutIds?: string[] } = {}
  ) {
    const db = getDb();
    const wallet = await this.getHostWallet(hostId);

    if (!wallet.bank.verified) {
      throw Object.assign(
        new Error("Add and verify a bank account before withdrawing."),
        { statusCode: 400, code: "BANK_REQUIRED" }
      );
    }

    const available = wallet.balances.available;
    if (available <= 0) {
      throw Object.assign(new Error("No available earnings to withdraw."), {
        statusCode: 400,
        code: "NO_AVAILABLE_BALANCE",
      });
    }

    const requested =
      params.amountNaira !== undefined && params.amountNaira !== null
        ? Math.floor(Number(params.amountNaira))
        : available;

    if (!Number.isFinite(requested) || requested <= 0) {
      throw Object.assign(new Error("Withdrawal amount must be a positive integer (naira)."), {
        statusCode: 400,
      });
    }

    if (requested > available) {
      throw Object.assign(
        new Error(`Requested ₦${requested.toLocaleString()} exceeds available ₦${available.toLocaleString()}.`),
        { statusCode: 400, code: "INSUFFICIENT_AVAILABLE" }
      );
    }

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, hostId))
      .limit(1);

    if (!profile?.bankAccountNumber || !profile.bankCode || !profile.bankAccountVerifiedAt) {
      throw Object.assign(new Error("Verified bank account required."), {
        statusCode: 400,
        code: "BANK_REQUIRED",
      });
    }

    return await db.transaction(async (tx) => {
      let candidatesQuery = tx
        .select()
        .from(schema.payouts)
        .where(
          and(
            eq(schema.payouts.hostId, hostId),
            eq(schema.payouts.status, "READY_FOR_PAYOUT")
          )
        )
        .orderBy(schema.payouts.createdAt)
        .for("update");

      const lockedRows = await candidatesQuery;
      const selected: typeof lockedRows = [];
      let running = 0;

      for (const row of lockedRows) {
        if (params.payoutIds && params.payoutIds.length > 0 && !params.payoutIds.includes(row.id)) {
          continue;
        }
        if (running + row.amount > requested) {
          // Prefer exact fill from whole payout rows — no partial split (no new tables)
          continue;
        }
        selected.push(row);
        running += row.amount;
        if (running >= requested) break;
      }

      if (selected.length === 0 || running <= 0) {
        throw Object.assign(
          new Error(
            "Could not reserve payout rows for that amount. Withdraw exact available booking totals (no partial payout splits)."
          ),
          { statusCode: 409, code: "RESERVE_FAILED" }
        );
      }

      const batchId = `wd_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const transferRef = `ILE_WD_${batchId}`;

      // Ensure recipient
      let recipientCode = profile.paystackRecipientCode;
      if (!recipientCode) {
        const recRes = await PaystackTransferService.createTransferRecipient({
          name: profile.bankAccountName || "Host",
          accountNumber: profile.bankAccountNumber!,
          bankCode: profile.bankCode!,
          description: `Ilé Host Withdrawal - ${hostId}`,
        });
        if (!recRes.success || !recRes.recipientCode) {
          throw new Error(recRes.error || "Failed to register Paystack transfer recipient.");
        }
        recipientCode = recRes.recipientCode;
        await tx
          .update(schema.profiles)
          .set({ paystackRecipientCode: recipientCode })
          .where(eq(schema.profiles.userId, hostId));
      }

      const reservedIds: string[] = [];
      for (const row of selected) {
        const [updated] = await tx
          .update(schema.payouts)
          .set({
            status: "PROCESSING",
            transferStatus: "PENDING",
            paystackTransferRef: `${transferRef}_${row.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`,
            paystackRecipientCode: recipientCode,
            bankCode: profile.bankCode,
            bankName: profile.bankName,
            accountNumber: profile.bankAccountNumber,
            accountName: profile.bankAccountName,
            notes: `Host withdrawal batch ${batchId}`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(schema.payouts.id, row.id), eq(schema.payouts.status, "READY_FOR_PAYOUT"))
          )
          .returning();

        if (!updated) {
          throw Object.assign(
            new Error("Concurrent withdrawal reserved these funds. Retry shortly."),
            { statusCode: 409, code: "CONCURRENT_WITHDRAWAL" }
          );
        }
        reservedIds.push(row.id);
      }

      await tx.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId: hostId,
        action: "HOST_WITHDRAWAL_REQUESTED",
        entityType: "payout_batch",
        entityId: batchId,
        details: JSON.stringify({
          at: new Date().toISOString(),
          amount: running,
          payoutIds: reservedIds,
          transferRef,
        }),
      });

      // Initiate one transfer per reserved payout (maps 1:1 to existing payout rows — no batch table)
      const transferResults: Array<{
        payoutId: string;
        status: string;
        transferRef: string;
        error?: string;
      }> = [];

      for (const row of selected) {
        const rowRef = `${transferRef}_${row.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
        const transferRes = await PaystackTransferService.initiateTransfer({
          amountNaira: row.amount,
          recipientCode: recipientCode!,
          reference: rowRef,
          reason: `Ilé host withdrawal for booking ${row.bookingId}`,
        });

        if (!transferRes.success || transferRes.status === "failed" || transferRes.status === "otp_required") {
          // Verified initiation failure → restore READY_FOR_PAYOUT
          await tx
            .update(schema.payouts)
            .set({
              status: "READY_FOR_PAYOUT",
              transferStatus: "FAILED",
              transferFailureReason: transferRes.error || "Transfer initiation failed",
              paystackTransferRef: rowRef,
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, row.id));

          transferResults.push({
            payoutId: row.id,
            status: "FAILED_RESTORED",
            transferRef: rowRef,
            error: transferRes.error,
          });
          continue;
        }

        if (transferRes.status === "pending") {
          await tx
            .update(schema.payouts)
            .set({
              status: "PROCESSING",
              transferStatus: "PENDING",
              paystackTransferCode: transferRes.transferCode || null,
              paystackTransferRef: rowRef,
              updatedAt: new Date(),
            })
            .where(eq(schema.payouts.id, row.id));

          transferResults.push({
            payoutId: row.id,
            status: "PROCESSING",
            transferRef: rowRef,
          });
          continue;
        }

        // Immediate success path
        await LedgerService.recordHostPayout(tx, {
          payoutId: row.id,
          bookingId: row.bookingId,
          hostId,
          amount: row.amount,
          adminId: null,
          transferRef: rowRef,
          notes: `Host withdrawal batch ${batchId}`,
        });

        await tx
          .update(schema.payouts)
          .set({
            transferStatus: "SUCCESS",
            paystackTransferCode: transferRes.transferCode || null,
            paystackTransferRef: rowRef,
            updatedAt: new Date(),
          })
          .where(eq(schema.payouts.id, row.id));

        transferResults.push({
          payoutId: row.id,
          status: "PAID",
          transferRef: rowRef,
        });
      }

      const paidAmount = transferResults
        .filter((r) => r.status === "PAID")
        .reduce((sum, r) => {
          const match = selected.find((s) => s.id === r.payoutId);
          return sum + (match?.amount || 0);
        }, 0);
      const processingAmount = transferResults
        .filter((r) => r.status === "PROCESSING")
        .reduce((sum, r) => {
          const match = selected.find((s) => s.id === r.payoutId);
          return sum + (match?.amount || 0);
        }, 0);
      const restoredAmount = transferResults
        .filter((r) => r.status === "FAILED_RESTORED")
        .reduce((sum, r) => {
          const match = selected.find((s) => s.id === r.payoutId);
          return sum + (match?.amount || 0);
        }, 0);

      return {
        success: true,
        batchId,
        requestedAmount: requested,
        reservedAmount: running,
        paidAmount,
        processingAmount,
        restoredAmount,
        transferResults,
        feePolicyNote: wallet.feePolicy.note,
        message:
          processingAmount > 0
            ? "Withdrawal submitted. Funds stay in Processing until Paystack confirms."
            : paidAmount > 0
              ? "Withdrawal completed."
              : "Withdrawal could not be initiated; available balance restored.",
      };
    });
  }

  /**
   * Admin plain-language finance overview for Phase 7 dashboard.
   */
  static async getAdminFinanceOpsOverview(filters: {
    status?: string;
    hostId?: string;
    bookingId?: string;
    transferRef?: string;
    limit?: number;
  } = {}) {
    const db = getDb();
    const limit = filters.limit || 100;

    const [counts] = await db
      .select({
        pendingHeld: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'HELD' THEN 1 END)::int`,
        eligible: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'READY_FOR_PAYOUT' THEN 1 END)::int`,
        processing: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'PROCESSING' THEN 1 END)::int`,
        paid: sql<number>`COUNT(CASE WHEN ${schema.payouts.status} = 'PAID' THEN 1 END)::int`,
        failedOrStuck: sql<number>`COUNT(CASE WHEN ${schema.payouts.transferStatus} = 'FAILED' OR ${schema.payouts.status} IN ('FAILED','REVERSED') THEN 1 END)::int`,
        pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'HELD' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        eligibleAmount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'READY_FOR_PAYOUT' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        processingAmount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PROCESSING' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
        paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${schema.payouts.status} = 'PAID' THEN ${schema.payouts.amount} ELSE 0 END), 0)::int`,
      })
      .from(schema.payouts);

    const [refundOpen] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        amount: sql<number>`COALESCE(SUM(${schema.refunds.refundableAmount}), 0)::int`,
      })
      .from(schema.refunds)
      .where(sql`${schema.refunds.status} IN ('REQUESTED', 'APPROVED')`);

    const [latePay] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.refunds)
      .where(
        and(
          eq(schema.refunds.status, "REQUESTED"),
          sql`${schema.refunds.reason} ILIKE '%LATE_PAYMENT%'`
        )
      );

    const checkInExceptions = await db
      .select({
        bookingId: schema.bookings.id,
        bookingRef: schema.bookings.referenceCode,
        checkInDate: schema.bookings.checkInDate,
        status: schema.bookings.status,
        guestCheckInConfirmedAt: schema.bookings.guestCheckInConfirmedAt,
        payoutStatus: schema.payouts.status,
        payoutAmount: schema.payouts.amount,
        hostId: schema.payouts.hostId,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .where(
        and(
          eq(schema.payouts.status, "HELD"),
          sql`${schema.bookings.checkInDate} <= ${new Date().toISOString().split("T")[0]}`,
          isNull(schema.bookings.guestCheckInConfirmedAt),
          sql`${schema.bookings.status} IN ('CONFIRMED', 'COMPLETED')`
        )
      )
      .limit(limit);

    const conditions = [];
    if (filters.status && filters.status !== "ALL") {
      conditions.push(eq(schema.payouts.status, filters.status));
    }
    if (filters.hostId) conditions.push(eq(schema.payouts.hostId, filters.hostId));
    if (filters.bookingId) conditions.push(eq(schema.payouts.bookingId, filters.bookingId));
    if (filters.transferRef) {
      conditions.push(
        sql`${schema.payouts.paystackTransferRef} ILIKE ${"%" + filters.transferRef + "%"}`
      );
    }

    let payoutQuery = db
      .select({
        id: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        hostId: schema.payouts.hostId,
        amount: schema.payouts.amount,
        status: schema.payouts.status,
        transferStatus: schema.payouts.transferStatus,
        transferFailureReason: schema.payouts.transferFailureReason,
        paystackTransferRef: schema.payouts.paystackTransferRef,
        scheduledFor: schema.payouts.scheduledFor,
        disbursedAt: schema.payouts.disbursedAt,
        createdAt: schema.payouts.createdAt,
        bookingRef: schema.bookings.referenceCode,
        checkInDate: schema.bookings.checkInDate,
        guestCheckInConfirmedAt: schema.bookings.guestCheckInConfirmedAt,
        hostName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
        propertyName: schema.properties.title,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.users, eq(schema.payouts.hostId, schema.users.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .$dynamic();

    if (conditions.length > 0) {
      payoutQuery = payoutQuery.where(and(...conditions));
    }

    const payouts = await payoutQuery.orderBy(desc(schema.payouts.createdAt)).limit(limit);

    return {
      plainLanguage: {
        pendingHostEarnings: {
          count: counts?.pendingHeld || 0,
          amount: counts?.pendingAmount || 0,
          meaning: "Still held — waiting for guest check-in and/or hold period",
        },
        eligibleToWithdraw: {
          count: counts?.eligible || 0,
          amount: counts?.eligibleAmount || 0,
          meaning: "Ready for host withdrawal or admin disburse",
        },
        processingWithdrawals: {
          count: counts?.processing || 0,
          amount: counts?.processingAmount || 0,
          meaning: "Paystack transfer in flight — do not retry blindly",
        },
        paidToHosts: {
          count: counts?.paid || 0,
          amount: counts?.paidAmount || 0,
          meaning: "Successfully paid to host bank",
        },
        failedOrNeedsRecon: {
          count: counts?.failedOrStuck || 0,
          meaning: "Failed/reversed transfers needing review",
        },
        refundsNeedingReview: {
          count: refundOpen?.count || 0,
          amount: refundOpen?.amount || 0,
        },
        latePaymentRecon: { count: latePay?.count || 0 },
        checkInExceptions: {
          count: checkInExceptions.length,
          meaning: "Past check-in date but guest has not confirmed arrival",
        },
      },
      checkInExceptions,
      payouts,
      generatedAt: new Date().toISOString(),
    };
  }
}
