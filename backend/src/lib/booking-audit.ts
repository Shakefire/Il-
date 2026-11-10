import crypto from "crypto"
import { getDb, schema } from "../db/client"

export type BookingAuditAction =
  | "BOOKING_REQUEST_CREATED"
  | "HOST_ACCEPTED"
  | "HOST_DECLINED"
  | "HOST_WINDOW_EXPIRED"
  | "PAYMENT_WINDOW_EXPIRED"
  | "GUEST_CANCELLED_BEFORE_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "LATE_PAYMENT_RECON_REQUESTED"
  | "REFUND_REQUESTED"
  | "GUEST_CHECK_IN_CONFIRMED"
  | "SETTLEMENT_RELEASED"
  | "SETTLEMENT_ADMIN_OVERRIDE"
  | "HOST_WITHDRAWAL_REQUESTED"

/**
 * Append-only audit via existing audit_logs. Failures are swallowed so
 * lifecycle mutations are never rolled back by audit write issues.
 */
export const recordBookingAudit = async (params: {
  action: BookingAuditAction
  bookingId: string
  userId?: string | null
  details?: Record<string, unknown>
  ipAddress?: string | null
}): Promise<void> => {
  try {
    const db = getDb()
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: params.userId || null,
      action: params.action,
      entityType: "booking",
      entityId: params.bookingId,
      details: JSON.stringify({
        at: new Date().toISOString(),
        ...(params.details || {}),
      }),
      ipAddress: params.ipAddress || null,
    })
  } catch (err) {
    console.warn("[Audit] Failed to record booking audit:", params.action, err)
  }
}
