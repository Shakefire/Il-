import { and, desc, eq, or } from "drizzle-orm"
import { getDb, schema } from "../../db/client"
import { BOOKING_STATUS } from "../../config/constants"

const STAY_STATUSES = new Set<string>([BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED])

function httpError(statusCode: number, message: string): Error {
  const err: any = new Error(message)
  err.statusCode = statusCode
  return err
}

function storedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function storedTimes(things: unknown): { checkInAfter: string | null; checkOutBefore: string | null } {
  if (!things || typeof things !== "object") {
    return { checkInAfter: null, checkOutBefore: null }
  }
  const record = things as { checkInAfter?: unknown; checkOutBefore?: unknown }
  return {
    checkInAfter: storedText(record.checkInAfter),
    checkOutBefore: storedText(record.checkOutBefore),
  }
}

/**
 * Ordinary stay details for a confirmed booking (guest, host, or admin).
 * Arrival notes and dates only — no digital access pass or gate clearance.
 * Does not invent gate codes, wifi, or coordinates.
 */
export async function getStayDetails(bookingIdOrRef: string, userId: string) {
  if (!userId) throw httpError(401, "Sign in to view stay details.")

  const db = getDb()
  const [actor] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (!actor) throw httpError(401, "Sign in to view stay details.")

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(or(eq(schema.bookings.id, bookingIdOrRef), eq(schema.bookings.referenceCode, bookingIdOrRef)))
    .limit(1)
  if (!booking) throw httpError(404, "Booking not found.")

  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.id, booking.propertyId))
    .limit(1)
  if (!property) throw httpError(404, "Booking not found.")

  const isAdmin = actor.role === "admin"
  const isGuest = booking.guestId === actor.id
  const isHost = property.hostId === actor.id
  if (!isAdmin && !isGuest && !isHost) throw httpError(404, "Booking not found.")

  if (!STAY_STATUSES.has(booking.status)) {
    throw httpError(
      403,
      "Stay details are available only after payment is verified and the stay is confirmed."
    )
  }

  const [payment] = await db
    .select({ id: schema.payments.id, status: schema.payments.status, paidAt: schema.payments.paidAt })
    .from(schema.payments)
    .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "SUCCESS")))
    .orderBy(desc(schema.payments.createdAt))
    .limit(1)
  if (!payment) {
    throw httpError(403, "Verified payment is required before stay details can be shown.")
  }

  const [privateDetails] = await db
    .select()
    .from(schema.propertyPrivateDetails)
    .where(eq(schema.propertyPrivateDetails.propertyId, property.id))
    .limit(1)

  const times = storedTimes(property.thingsToKnow)
  const arrivalNotes = storedText(privateDetails?.checkInInstructions)

  return {
    propertyName: property.title,
    reference: booking.referenceCode,
    bookingId: booking.id,
    status: booking.status,
    paymentVerified: true,
    neighborhood: storedText(property.neighborhood),
    city: storedText(property.city),
    checkIn: {
      date: booking.checkInDate,
      after: times.checkInAfter,
    },
    checkOut: {
      date: booking.checkOutDate,
      before: times.checkOutBefore,
    },
    arrivalNotes,
  }
}
