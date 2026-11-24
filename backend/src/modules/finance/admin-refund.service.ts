import crypto from "crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { ACCOUNT_CODES, ensurePhase2Accounts, LedgerService } from "./ledger.service";
import { executePaystackRefund } from "./paystack-refund.service";

const OPEN_REFUND_STATUSES = ["PENDING", "RECONCILIATION_REQUIRED"] as const;
const CONSUMING_REFUND_STATUSES = ["SUCCESSFUL", "PROCESSED", "PENDING", "RECONCILIATION_REQUIRED"] as const;

export class FinanceControlError extends Error {
  statusCode: number;
  code: string;
  shortfall?: number;
  commissionAvailable?: number;
  refundable?: number;

  constructor(
    message: string,
    code: string,
    statusCode = 400,
    extra: { shortfall?: number; commissionAvailable?: number; refundable?: number } = {}
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.shortfall = extra.shortfall;
    this.commissionAvailable = extra.commissionAvailable;
    this.refundable = extra.refundable;
  }
}

export interface ExecuteAdminRefundInput {
  adminId: string;
  bookingId: string;
  amountNaira?: number;
  reason?: string | null;
  existingRefundId?: string | null;
  idempotencyKey: string;
}

async function assertAdmin(tx: any, adminId: string): Promise<void> {
  const [user] = await tx
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, adminId))
    .limit(1);
  if (!user || String(user.role || "").toLowerCase() !== "admin") {
    throw new FinanceControlError(
      "Only an authorized admin can initiate, approve, or execute a refund.",
      "ADMIN_REQUIRED",
      403
    );
  }
}

async function commissionAvailable(tx: any): Promise<number> {
  const [account] = await tx
    .select({ id: schema.ledgerAccounts.id })
    .from(schema.ledgerAccounts)
    .where(eq(schema.ledgerAccounts.code, ACCOUNT_CODES.COMMISSION_FUNDS))
    .limit(1)
    .for("update");
  if (!account) return 0;
  const [sums] = await tx
    .select({
      debit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'DEBIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
      credit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'CREDIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
    })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.accountId, account.id));
  return Number(sums?.debit || 0) - Number(sums?.credit || 0);
}

async function accountNet(tx: any, code: string): Promise<number> {
  const [account] = await tx
    .select({ id: schema.ledgerAccounts.id, type: schema.ledgerAccounts.type })
    .from(schema.ledgerAccounts)
    .where(eq(schema.ledgerAccounts.code, code))
    .limit(1);
  if (!account) return 0;
  const [sums] = await tx
    .select({
      debit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'DEBIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
      credit: sql<number>`COALESCE(SUM(CASE WHEN ${schema.ledgerEntries.entryType} = 'CREDIT' THEN ${schema.ledgerEntries.amount} ELSE 0 END), 0)::int`,
    })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.accountId, account.id));
  const debit = Number(sums?.debit || 0);
  const credit = Number(sums?.credit || 0);
  if (account.type === "ASSET" || account.type === "EXPENSE") return debit - credit;
  return credit - debit;
}

/**
 * Admin-only refund. Funds are reserved on account 1040, then Paystack is called,
 * and success is posted only after a verified provider result.
 * Host payable, host earnings, and payout rows are not debited.
 * Booking status is not changed.
 */
export async function executeAdminRefund(input: ExecuteAdminRefundInput) {
  const db = getDb();
  const reason = (input.reason || "").trim();
  if (reason.length < 5) {
    throw new FinanceControlError("A refund reason of at least 5 characters is required.", "REASON_REQUIRED");
  }

  return await db.transaction(async (tx) => {
    await assertAdmin(tx, input.adminId);
    await ensurePhase2Accounts(tx);

    if (!input.existingRefundId) {
      const marker = `idempotency:${input.idempotencyKey}`;
      const providerKey = `mock_refund_${input.idempotencyKey}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80);
      const [byKey] = await tx
        .select()
        .from(schema.refunds)
        .where(
          or(
            sql`position(${marker} in coalesce(${schema.refunds.adminNotes}, '')) > 0`,
            eq(schema.refunds.paystackRefundId, providerKey)
          )
        )
        .limit(1);
      if (byKey) {
        return {
          success: byKey.status === "SUCCESSFUL" || byKey.status === "PROCESSED",
          idempotent: true,
          refundId: byKey.id,
          status: byKey.status,
          refundedAmount: byKey.refundableAmount,
          paystackRefundId: byKey.paystackRefundId,
          bookingStatus: null,
          fundingAccount: "1040",
        };
      }
    }

    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, input.bookingId))
      .for("update")
      .limit(1);
    if (!booking) {
      throw new FinanceControlError(`Booking ${input.bookingId} not found.`, "BOOKING_NOT_FOUND", 404);
    }
    // Cancelled/expired bookings may still hold a verified late/duplicate payment.
    // Refund against that payment is allowed; the booking status is never changed.

    let refund = null as typeof schema.refunds.$inferSelect | null;
    if (input.existingRefundId) {
      const [locked] = await tx
        .select()
        .from(schema.refunds)
        .where(eq(schema.refunds.id, input.existingRefundId))
        .for("update")
        .limit(1);
      if (!locked || locked.bookingId !== booking.id) {
        throw new FinanceControlError("Refund request was not found for this booking.", "REFUND_NOT_FOUND", 404);
      }
      if (locked.status === "SUCCESSFUL" || locked.status === "PROCESSED") {
        return {
          success: true,
          idempotent: true,
          refundId: locked.id,
          status: locked.status,
          refundedAmount: locked.refundableAmount,
          paystackRefundId: locked.paystackRefundId,
          bookingStatus: booking.status,
        };
      }
      if (locked.status === "REJECTED" || locked.status === "FAILED" || locked.status === "REVERSED") {
        throw new FinanceControlError(
          `Refund ${locked.id} is ${locked.status} and cannot be executed.`,
          "REFUND_NOT_EXECUTABLE",
          409
        );
      }
      if ((OPEN_REFUND_STATUSES as readonly string[]).includes(locked.status)) {
        throw new FinanceControlError(
          "This refund is already reserved or needs reconciliation. It was not sent to Paystack again.",
          "RECONCILIATION_REQUIRED",
          409
        );
      }
      if (locked.status !== "APPROVED") {
        throw new FinanceControlError(
          `Refund ${locked.id} must be approved by an admin before execution (current: ${locked.status}).`,
          "REFUND_NOT_EXECUTABLE",
          409
        );
      }
      refund = locked;
    }

    const payments = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "SUCCESS")));
    const verified = payments.filter((payment) => payment.currency === "NGN" && payment.amount > 0);
    if (verified.length === 0) {
      throw new FinanceControlError(
        "A verified successful Paystack payment is required before a refund can be executed.",
        "NO_VERIFIED_PAYMENT",
        409
      );
    }
    const grossPaid = verified.reduce((sum, payment) => sum + payment.amount, 0);
    const paymentReference = verified[0].gatewayReference || verified[0].reference;

    const prior = await tx
      .select({
        id: schema.refunds.id,
        status: schema.refunds.status,
        amount: schema.refunds.refundableAmount,
      })
      .from(schema.refunds)
      .where(eq(schema.refunds.bookingId, booking.id));
    const consumed = prior
      .filter((row) => row.id !== refund?.id && (CONSUMING_REFUND_STATUSES as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + (row.amount || 0), 0);
    const refundable = Math.max(0, grossPaid - consumed);
    const requested =
      input.amountNaira !== undefined && input.amountNaira !== null
        ? Math.floor(Number(input.amountNaira))
        : Math.min(refund?.refundableAmount || refundable, refundable);

    if (!Number.isInteger(requested) || requested <= 0) {
      throw new FinanceControlError("Refund amount must be a positive whole naira amount.", "INVALID_AMOUNT");
    }
    if (requested > refundable) {
      throw new FinanceControlError(
        `Refund of ₦${requested.toLocaleString()} exceeds refundable ₦${refundable.toLocaleString()} after verified payments and prior refunds.`,
        "EXCEEDS_REFUNDABLE",
        409,
        { refundable }
      );
    }

    const available = await commissionAvailable(tx);
    if (available < requested) {
      const shortfall = requested - available;
      if (refund) {
        await tx
          .update(schema.refunds)
          .set({
            adminNotes: `Blocked: commission account 1040 available ₦${available}, shortfall ₦${shortfall}. Host wallets were not debited.`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, refund.id));
      }
      throw new FinanceControlError(
        `Commission account 1040 has ₦${available.toLocaleString()} available. This refund needs ₦${requested.toLocaleString()} (shortfall ₦${shortfall.toLocaleString()}). Execution was blocked. No other account was used and host wallets were not debited.`,
        "INSUFFICIENT_COMMISSION",
        409,
        { shortfall, commissionAvailable: available, refundable }
      );
    }

    const hostPayableBefore = await accountNet(tx, ACCOUNT_CODES.HOST_PAYABLE);
    const refundId = refund?.id || `ref_${crypto.randomUUID()}`;
    const now = new Date();
    if (!refund) {
      await tx.insert(schema.refunds).values({
        id: refundId,
        bookingId: booking.id,
        guestId: booking.guestId,
        grossPaid,
        nonRefundableProcessingFee: 0,
        refundableAmount: requested,
        currency: "NGN",
        status: "PENDING",
        approvedBy: input.adminId,
        approvedAt: now,
        reason,
        adminNotes: `payment:${paymentReference}; fundedBy:1040; idempotency:${input.idempotencyKey}`,
      });
    } else {
      await tx
        .update(schema.refunds)
        .set({
          status: "PENDING",
          grossPaid,
          refundableAmount: requested,
          approvedBy: input.adminId,
          approvedAt: refund.approvedAt || now,
          reason,
          adminNotes: `payment:${paymentReference}; fundedBy:1040; idempotency:${input.idempotencyKey}`,
          updatedAt: now,
        })
        .where(eq(schema.refunds.id, refundId));
    }

    await LedgerService.postJournalEntry(tx, {
      reference: refundId,
      eventType: "ADMIN_REFUND_RESERVED",
      narration: `Reserved ₦${requested.toLocaleString()} from commission account 1040 for refund ${refundId} on booking ${booking.referenceCode}. Host payable was not touched.`,
      createdById: input.adminId,
      entries: [
        { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS_RESERVED, entryType: "DEBIT", amount: requested },
        { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "CREDIT", amount: requested },
      ],
    });

    let outcome;
    try {
      outcome = await executePaystackRefund({
        transactionReference: paymentReference,
        amountNaira: requested,
        currency: "NGN",
        idempotencyKey: input.idempotencyKey,
        customerNote: reason,
        merchantNote: `Ilé booking ${booking.referenceCode} admin refund ${refundId}`,
      });
    } catch {
      outcome = { verified: false as const, status: "unknown" as const, providerReference: undefined };
    }

    const hostPayableAfterReserve = await accountNet(tx, ACCOUNT_CODES.HOST_PAYABLE);
    if (hostPayableAfterReserve !== hostPayableBefore) {
      throw new FinanceControlError(
        "Refund reservation changed host payable. The transaction was aborted.",
        "HOST_PAYABLE_TOUCHED",
        500
      );
    }

    if (outcome.verified && outcome.status === "success") {
      await LedgerService.postJournalEntry(tx, {
        reference: refundId,
        eventType: "ADMIN_REFUND_SETTLED",
        narration: `Settled admin refund ${refundId} from reserved commission funds after verified Paystack result ${outcome.providerReference || "n/a"}.`,
        createdById: input.adminId,
        entries: [
          { accountCode: ACCOUNT_CODES.REFUND_FROM_COMMISSION, entryType: "DEBIT", amount: requested },
          { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS_RESERVED, entryType: "CREDIT", amount: requested },
        ],
      });
      await tx
        .update(schema.refunds)
        .set({
          status: "SUCCESSFUL",
          processedAt: new Date(),
          paystackRefundId: outcome.providerReference || null,
          adminNotes: `payment:${paymentReference}; fundedBy:1040; provider:success; hostPayableUnchanged:true; idempotency:${input.idempotencyKey}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
    } else if (outcome.verified && (outcome.status === "failed" || outcome.status === "reversed")) {
      await LedgerService.postJournalEntry(tx, {
        reference: refundId,
        eventType: "ADMIN_REFUND_RESERVATION_RELEASED",
        narration: `Released commission reservation for refund ${refundId} after provider ${outcome.status}.`,
        createdById: input.adminId,
        entries: [
          { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS, entryType: "DEBIT", amount: requested },
          { accountCode: ACCOUNT_CODES.COMMISSION_FUNDS_RESERVED, entryType: "CREDIT", amount: requested },
        ],
      });
      await tx
        .update(schema.refunds)
        .set({
          status: outcome.status === "reversed" ? "REVERSED" : "FAILED",
          paystackRefundId: outcome.providerReference || null,
          adminNotes: `payment:${paymentReference}; fundedBy:1040; provider:${outcome.status}; idempotency:${input.idempotencyKey}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
    } else {
      await tx
        .update(schema.refunds)
        .set({
          status: "RECONCILIATION_REQUIRED",
          paystackRefundId: outcome.providerReference || null,
          adminNotes: `payment:${paymentReference}; fundedBy:1040; provider:${outcome.status}; reservation held; idempotency:${input.idempotencyKey}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
    }

    await tx.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: input.adminId,
      action: "ADMIN_REFUND_EXECUTED",
      entityType: "refund",
      entityId: refundId,
      details: JSON.stringify({
        bookingId: booking.id,
        bookingRef: booking.referenceCode,
        paymentReference,
        amount: requested,
        currency: "NGN",
        providerStatus: outcome.status,
        verified: outcome.verified,
        paystackRefundId: outcome.providerReference || null,
        fundingAccount: "1040",
        hostPayableBefore,
        hostPayableAfter: hostPayableAfterReserve,
        bookingStatusUnchanged: booking.status,
      }),
      createdAt: new Date(),
    });

    const [saved] = await tx.select().from(schema.refunds).where(eq(schema.refunds.id, refundId)).limit(1);
    return {
      success: saved?.status === "SUCCESSFUL",
      idempotent: false,
      refundId,
      status: saved?.status,
      refundedAmount: requested,
      paystackRefundId: saved?.paystackRefundId || null,
      bookingStatus: booking.status,
      commissionAvailableBefore: available,
      fundingAccount: "1040",
      hostPayableUnchanged: hostPayableBefore === hostPayableAfterReserve,
    };
  });
}

/** Backend role check. Route session checks are not a substitute. */
export async function assertFinanceAdmin(userId: string): Promise<void> {
  const db = getDb();
  const [user] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user || String(user.role || "").toLowerCase() !== "admin") {
    throw new FinanceControlError(
      "Only an authorized admin can initiate, approve, or execute a refund.",
      "ADMIN_REQUIRED",
      403
    );
  }
}

const REFUND_CONSUMING = ["SUCCESSFUL", "PROCESSED", "PENDING", "RECONCILIATION_REQUIRED"] as const;

/**
 * Read-only refund context for the admin screen.
 * Does not reserve funds, call Paystack, or change the booking.
 */
export async function getAdminRefundPreview(bookingId: string) {
  const db = getDb();
  return await db.transaction(async (tx) => {
    await ensurePhase2Accounts(tx);
    const [booking] = await tx
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);
    if (!booking) {
      throw new FinanceControlError(`Booking ${bookingId} not found.`, "BOOKING_NOT_FOUND", 404);
    }
    const payments = await tx
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "SUCCESS")));
    const verified = payments.filter((payment) => payment.currency === "NGN" && payment.amount > 0);
    const originalPayment = verified.reduce((sum, payment) => sum + payment.amount, 0);
    const prior = await tx.select().from(schema.refunds).where(eq(schema.refunds.bookingId, booking.id));
    const consumed = prior
      .filter((row) => (REFUND_CONSUMING as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + (row.refundableAmount || 0), 0);
    const refundable = Math.max(0, originalPayment - consumed);
    const available = await commissionAvailable(tx);
    let blockReason: string | null = null;
    if (verified.length === 0) {
      blockReason = "A verified successful Paystack payment is required.";
    } else if (refundable <= 0) {
      blockReason = "Nothing remains refundable on this payment.";
    } else if (available < refundable && available <= 0) {
      blockReason =
        "Commission account 1040 has no available funds. Live refund execution stays blocked until commission cash is funded. Host wallets are never debited.";
    }
    const isLatePaymentRecon = prior.some(
      (row) =>
        String(row.reason || "").includes("LATE_PAYMENT") ||
        String(row.reason || "").includes("PAYMENT_ASSOCIATION")
    )
    return {
      bookingId: booking.id,
      bookingReference: booking.referenceCode,
      bookingStatus: booking.status,
      originalPayment,
      paymentReferences: verified.map((payment) => payment.gatewayReference || payment.reference),
      priorRefunds: prior.map((row) => ({
        id: row.id,
        status: row.status,
        amount: row.refundableAmount,
        reason: row.reason,
      })),
      consumed,
      refundable,
      commissionAvailable: available,
      fundingAccount: "1040" as const,
      latePaymentReconciliation: isLatePaymentRecon,
      bookingNeverRevived: true,
      executable: blockReason === null,
      blockReason,
    };
  });
}

export async function hostPayableBalance(): Promise<number> {
  const db = getDb();
  return await db.transaction(async (tx) => accountNet(tx, ACCOUNT_CODES.HOST_PAYABLE));
}

export async function commissionFundsBalance(): Promise<number> {
  const db = getDb();
  return await db.transaction(async (tx) => {
    await ensurePhase2Accounts(tx);
    return commissionAvailable(tx);
  });
}

/** Maps a refund failure to an HTTP body that includes the commission shortfall. */
export function financeControlHttp(err: unknown): {
  status: number;
  body: {
    error: string;
    code?: string;
    shortfall?: number;
    commissionAvailable?: number;
    refundable?: number;
  };
} {
  if (err instanceof FinanceControlError) {
    return {
      status: err.statusCode,
      body: {
        error: err.message,
        code: err.code,
        shortfall: err.shortfall,
        commissionAvailable: err.commissionAvailable,
        refundable: err.refundable,
      },
    };
  }
  const fallback = err as { message?: string; statusCode?: number; code?: string };
  return {
    status: fallback.statusCode || 400,
    body: {
      error: fallback.message || "Refund failed",
      code: fallback.code,
    },
  };
}
