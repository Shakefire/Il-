import crypto from "crypto"
import { and, desc, eq } from "drizzle-orm"
import { getDb, schema } from "../../db/client"
import { toPlainText } from "../../lib/plain-text"
import { notifyUserEvent } from "../notifications/orchestrator"

export const SUPPORT_CATEGORIES = [
  "BOOKING",
  "PAYMENT",
  "REFUND_REQUEST",
  "LISTING",
  "ACCESS",
  "OTHER",
] as const

export const SUPPORT_STATUSES = ["OPEN", "IN_REVIEW", "WAITING_ON_REQUESTER", "RESOLVED", "CLOSED"] as const

function httpError(statusCode: number, message: string): Error {
  const err: any = new Error(message)
  err.statusCode = statusCode
  return err
}

function notifySupport(params: {
  userId: string
  email?: string | null
  event: string
  title: string
  body: string
  deepLink: string
  entityId: string
  urgent?: boolean
}) {
  const emailPayload =
    params.email && params.email.includes("@")
      ? {
          to: params.email,
          subject: params.title,
          html: `<p>${params.body.replace(/</g, "&lt;")}</p><p><a href="${params.deepLink}">Open Ilé</a></p>`,
          text: `${params.body}\n${params.deepLink}`,
        }
      : undefined

  notifyUserEvent({
    userId: params.userId,
    event: params.event,
    entityType: "support_case",
    entityId: params.entityId,
    category: params.urgent ? "critical" : "support",
    channels: {
      inbox: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        deepLink: params.deepLink,
      },
      email: emailPayload,
      push: true,
      // SMS is not required for every support message — Termii stays for transactional SMS only.
    },
  })
}

export async function createSupportCase(input: {
  requesterId: string
  bookingId?: string | null
  category: string
  subject: string
  message: string
}) {
  const category = input.category?.toUpperCase()
  if (!SUPPORT_CATEGORIES.includes(category as (typeof SUPPORT_CATEGORIES)[number])) {
    throw httpError(400, "Choose a support category.")
  }
  const subject = toPlainText(input.subject, 200)
  const message = toPlainText(input.message, 4000)
  if (!subject || !message) throw httpError(400, "Subject and message are required.")

  const db = getDb()
  const [requester] = await db
    .select({ id: schema.users.id, role: schema.users.role, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, input.requesterId))
    .limit(1)
  if (!requester) throw httpError(401, "Sign in to open a support case.")

  let propertyId: string | null = null
  if (input.bookingId) {
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, input.bookingId))
      .limit(1)
    if (!booking) throw httpError(404, "Booking not found.")
    const [property] = await db
      .select({ hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(eq(schema.properties.id, booking.propertyId))
      .limit(1)
    const ownsBooking = booking.guestId === requester.id || property?.hostId === requester.id
    if (!ownsBooking && requester.role !== "admin") throw httpError(404, "Booking not found.")
    propertyId = booking.propertyId
  }

  const id = `case_${crypto.randomUUID()}`
  const [created] = await db
    .insert(schema.supportCases)
    .values({
      id,
      requesterId: requester.id,
      bookingId: input.bookingId || null,
      propertyId,
      category,
      subject,
      message,
      status: "OPEN",
    })
    .returning()

  notifySupport({
    userId: requester.id,
    email: requester.email,
    event: "SUPPORT_CASE_OPENED",
    title: "Support case opened",
    body: `We received “${subject}”. An Ilé admin will reply in the app.`,
    deepLink: "/support",
    entityId: id,
  })

  const admins = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(5)
  for (const admin of admins) {
    notifySupport({
      userId: admin.id,
      email: admin.email,
      event: "SUPPORT_CASE_ADMIN_ALERT",
      title: "New support case",
      body: `${category}: ${subject}`,
      deepLink: "/admin/support",
      entityId: `${id}:admin:${admin.id}`,
      urgent: true,
    })
  }

  return {
    case: created,
    refundExecuted: false,
  }
}

export async function listMySupportCases(userId: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(schema.supportCases)
    .where(eq(schema.supportCases.requesterId, userId))
    .orderBy(desc(schema.supportCases.createdAt))
  return { cases: rows }
}

export async function getSupportCase(caseId: string, userId: string, role: string) {
  const db = getDb()
  const [row] = await db.select().from(schema.supportCases).where(eq(schema.supportCases.id, caseId)).limit(1)
  if (!row) throw httpError(404, "Support case not found.")
  if (role !== "admin" && row.requesterId !== userId) throw httpError(404, "Support case not found.")
  return { case: row }
}

export async function listSupportCasesForAdmin() {
  const db = getDb()
  const rows = await db.select().from(schema.supportCases).orderBy(desc(schema.supportCases.createdAt)).limit(200)
  return { cases: rows }
}

export async function respondToSupportCase(input: {
  caseId: string
  adminId: string
  status?: string
  response: string
}) {
  const response = toPlainText(input.response, 4000)
  if (!response) throw httpError(400, "A response is required.")
  const status = (input.status || "IN_REVIEW").toUpperCase()
  if (!SUPPORT_STATUSES.includes(status as (typeof SUPPORT_STATUSES)[number])) {
    throw httpError(400, "Unknown support status.")
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(schema.supportCases)
    .where(eq(schema.supportCases.id, input.caseId))
    .limit(1)
  if (!existing) throw httpError(404, "Support case not found.")

  const [updated] = await db
    .update(schema.supportCases)
    .set({
      status,
      adminResponse: response,
      adminId: input.adminId,
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.supportCases.id, input.caseId))
    .returning()

  await db.insert(schema.auditLogs).values({
    id: `audit_${crypto.randomUUID()}`,
    userId: input.adminId,
    action: "SUPPORT_CASE_RESPONDED",
    entityType: "support_case",
    entityId: input.caseId,
    details: JSON.stringify({
      reason: response,
      old: { status: existing.status },
      new: { status },
    }),
  })

  const [requester] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, existing.requesterId))
    .limit(1)

  const urgent = status === "RESOLVED" || existing.category === "PAYMENT" || existing.category === "REFUND_REQUEST"
  notifySupport({
    userId: existing.requesterId,
    email: requester?.email,
    event: "SUPPORT_CASE_REPLY",
    title: "Support replied",
    body: response,
    deepLink: "/support",
    entityId: `${input.caseId}:reply:${updated.updatedAt?.toISOString?.() || Date.now()}`,
    urgent,
  })

  return { case: updated, refundExecuted: false }
}

export async function assertNoRefundSideEffect(bookingId: string) {
  const db = getDb()
  const rows = await db
    .select({ id: schema.refunds.id })
    .from(schema.refunds)
    .where(and(eq(schema.refunds.bookingId, bookingId)))
  return rows.length
}
