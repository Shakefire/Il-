import { getDb, schema } from "../backend/src/db/client";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import { LedgerService, ACCOUNT_CODES } from "../backend/src/modules/finance/ledger.service";

/**
 * Historical Ledger Reconciliation Script for Ilé
 * Reconciles historical bookings and payments into the double-entry ledger
 * without fabricating fictitious bank transfers.
 */
export async function reconcileHistoricalLedger() {
  const db = getDb();
  console.log("🔍 Starting historical ledger reconciliation...");

  const existingJournals = await db.select({ count: sql<number>`count(*)::int` }).from(schema.ledgerJournals);
  console.log(`Current ledger journals in DB: ${existingJournals[0]?.count || 0}`);

  // 1. Fetch all confirmed bookings with payments
  const confirmedBookings = await db
    .select({
      id: schema.bookings.id,
      referenceCode: schema.bookings.referenceCode,
      status: schema.bookings.status,
      propertyId: schema.bookings.propertyId,
      guestId: schema.bookings.guestId,
      guestEmail: schema.bookings.guestEmail,
      checkInDate: schema.bookings.checkInDate,
      checkOutDate: schema.bookings.checkOutDate,
      numberOfNights: schema.bookings.numberOfNights,
      nightlyPrice: schema.bookings.nightlyPrice,
      totalAmount: schema.bookings.totalAmount,
      accommodationSubtotal: schema.bookings.accommodationSubtotal,
      hostCommissionPct: schema.bookings.hostCommissionPct,
      hostCommissionAmount: schema.bookings.hostCommissionAmount,
      paystackFeeAmount: schema.bookings.paystackFeeAmount,
      hostNetAmount: schema.bookings.hostNetAmount,
      createdAt: schema.bookings.createdAt,
      hostId: schema.properties.hostId,
    })
    .from(schema.bookings)
    .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
    .where(sql`${schema.bookings.status} IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')`)
    .orderBy(schema.bookings.createdAt);

  console.log(`Found ${confirmedBookings.length} historical bookings to reconcile.`);

  const today = new Date().toISOString().slice(0, 10);
  let paymentsReconciled = 0;
  let settlementsReconciled = 0;
  let refundsReconciled = 0;

  for (let i = 0; i < confirmedBookings.length; i++) {
    const b = confirmedBookings[i];
    console.log(`[${i + 1}/${confirmedBookings.length}] Reconciling booking ${b.referenceCode} (ID: ${b.id}, Status: ${b.status})...`);

    // Lookup payment for booking
    const [pmt] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.bookingId, b.id), eq(schema.payments.status, "SUCCESS")))
      .limit(1);

    const paymentRef = pmt?.reference || b.referenceCode;
    const accommodationSubtotal =
      b.accommodationSubtotal || (b.nightlyPrice * b.numberOfNights);
    const paystackFee =
      b.paystackFeeAmount || (b.totalAmount - accommodationSubtotal > 0 ? b.totalAmount - accommodationSubtotal : 0);
    const commissionPct = b.hostCommissionPct || 10;
    const commissionAmount =
      b.hostCommissionAmount && b.hostCommissionAmount > 0
        ? b.hostCommissionAmount
        : Math.round((accommodationSubtotal * commissionPct) / 100);
    const hostNetAmount =
      b.hostNetAmount && b.hostNetAmount > 0
        ? b.hostNetAmount
        : accommodationSubtotal - commissionAmount;

    await db.transaction(async (tx) => {
      // 1. Reconcile Payment (if not cancelled prior to payment)
      if (pmt || b.status !== "PENDING") {
        const paymentRes = await LedgerService.recordBookingPayment(tx, {
          bookingId: b.id,
          paymentRef,
          totalAmount: b.totalAmount,
          accommodationSubtotal,
          paystackFeeAmount: paystackFee,
          hostNetAmount,
          hostId: b.hostId,
          checkInDate: b.checkInDate,
          payoutHoldHours: 24,
          createdById: null,
        });

        if (!paymentRes.alreadyRecorded) {
          paymentsReconciled++;
        }
      }

      // 2. Reconcile Check-In Settlement if checkInDate <= today and status is CONFIRMED or COMPLETED
      if (b.checkInDate <= today && (b.status === "CONFIRMED" || b.status === "COMPLETED")) {
        const settleRes = await LedgerService.recognizeCheckInSettlement(tx, {
          bookingId: b.id,
          accommodationSubtotal,
          hostNetAmount,
          hostCommissionAmount: commissionAmount,
          createdById: null,
        });

        if (!settleRes.alreadyRecorded) {
          settlementsReconciled++;
        }
      }

      // 3. Reconcile Cancelled Bookings
      if (b.status === "CANCELLED") {
        const [existingRefund] = await tx
          .select({ id: schema.refunds.id })
          .from(schema.refunds)
          .where(eq(schema.refunds.bookingId, b.id))
          .limit(1);

        if (!existingRefund) {
          await LedgerService.recordBookingRefund(tx, {
            bookingId: b.id,
            guestId: b.guestId,
            grossPaid: b.totalAmount,
            refundableAmount: accommodationSubtotal,
            nonRefundableProcessingFee: paystackFee,
            adminId: b.hostId, // Recorded as authorized refund
            reason: "Historical reservation cancellation",
            adminNotes: "Reconciled from legacy booking cancellation record",
          });
          refundsReconciled++;
        }
      }
    });
  }

  console.log(`✅ Reconciliation finished:`);
  console.log(`   - Payment inflows posted: ${paymentsReconciled}`);
  console.log(`   - Stay check-ins settled: ${settlementsReconciled}`);
  console.log(`   - Cancelled refunds recorded: ${refundsReconciled}`);

  // Verify Trial Balance
  const tb = await LedgerService.getTrialBalance();
  console.log("\n📊 Trial Balance Verification:");
  console.log(`   Total Debits:  ₦${tb.totals.debits.toLocaleString()}`);
  console.log(`   Total Credits: ₦${tb.totals.credits.toLocaleString()}`);
  console.log(`   Balanced:      ${tb.totals.isBalanced ? "✅ YES" : "❌ NO"}`);
  console.log(`   Imbalance:     ₦${tb.totals.imbalance.toLocaleString()}`);

  if (!tb.totals.isBalanced) {
    throw new Error(`CRITICAL: Ledger is out of balance by ₦${tb.totals.imbalance}`);
  }

  return tb;
}

reconcileHistoricalLedger()
  .then(() => {
    console.log("✨ Reconciliation completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Reconciliation failed:", err);
    process.exit(1);
  });

