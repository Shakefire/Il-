import type { EmailPayload } from "./notifications.service"
import { notifyLifecycleEvent } from "./orchestrator"

export const LIFECYCLE_EMAIL_EVENT = {
  GUEST_REQUEST_SUBMITTED: "GUEST_REQUEST_SUBMITTED",
  HOST_REQUEST_RECEIVED: "HOST_REQUEST_RECEIVED",
  GUEST_HOST_ACCEPTED: "GUEST_HOST_ACCEPTED",
  GUEST_HOST_DECLINED: "GUEST_HOST_DECLINED",
  GUEST_HOST_WINDOW_EXPIRED: "GUEST_HOST_WINDOW_EXPIRED",
  GUEST_PAYMENT_WINDOW_EXPIRED: "GUEST_PAYMENT_WINDOW_EXPIRED",
  GUEST_CANCELLED_BEFORE_PAYMENT: "GUEST_CANCELLED_BEFORE_PAYMENT",
  GUEST_PAYMENT_CONFIRMED: "GUEST_PAYMENT_CONFIRMED",
  GUEST_ARRIVAL_GUIDE: "GUEST_ARRIVAL_GUIDE",
  HOST_BOOKING_CONFIRMED: "HOST_BOOKING_CONFIRMED",
  GUEST_LATE_PAYMENT_RESOLUTION: "GUEST_LATE_PAYMENT_RESOLUTION",
  ADMIN_LATE_PAYMENT_RECON: "ADMIN_LATE_PAYMENT_RECON",
  HOST_ARRIVAL_REMINDER: "HOST_ARRIVAL_REMINDER",
} as const

export type LifecycleEmailEvent =
  (typeof LIFECYCLE_EMAIL_EVENT)[keyof typeof LIFECYCLE_EMAIL_EVENT]

export const buildLifecycleIdempotencyKey = (
  event: LifecycleEmailEvent | string,
  bookingId: string,
  recipientRole: string
): string => `booking:${bookingId}:${event}:${recipientRole}`

export type LifecycleNotifyExtras = {
  userId?: string | null
  phone?: string | null
  inboxTitle?: string
  inboxBody?: string
  deepLink?: string | null
  smsMessage?: string
}

/**
 * Fire-and-forget lifecycle notification (email + optional inbox/SMS/push).
 * Never throws to callers — booking mutations must not roll back.
 */
export const dispatchLifecycleEmail = (
  bookingId: string,
  event: LifecycleEmailEvent,
  recipientRole: string,
  payload: EmailPayload,
  extras?: LifecycleNotifyExtras
): void => {
  const inboxTitle =
    extras?.inboxTitle ||
    payload.subject ||
    String(event).replace(/_/g, " ")
  const inboxBody =
    extras?.inboxBody ||
    payload.text?.slice(0, 280) ||
    "You have a new update on your Ilé booking."

  notifyLifecycleEvent({
    bookingId,
    event,
    recipientRole,
    channels: {
      email: {
        ...payload,
        eventType: event,
        entityType: "booking",
        entityId: bookingId,
        idempotencyKey:
          payload.idempotencyKey ||
          `${buildLifecycleIdempotencyKey(event, bookingId, recipientRole)}:email`,
      },
      inbox: extras?.userId
        ? {
            userId: extras.userId,
            title: inboxTitle,
            body: inboxBody,
            deepLink: extras.deepLink || `/bookings/${bookingId}`,
          }
        : undefined,
      sms:
        extras?.phone && extras?.smsMessage
          ? { to: extras.phone, message: extras.smsMessage }
          : undefined,
      push: true,
    },
  })
}
