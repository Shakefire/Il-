/**
 * Ilé Central Notification Routing Policy Matrix
 *
 * Implements Section 4 of the Ilé Notification Directive.
 * Formally maps every business event to its allowed and intended communication channels,
 * categorizes notifications, and prevents unapproved, noisy, or cross-substituted dispatches.
 */

export type ChannelRoutingRule = {
  inbox: boolean
  email: boolean | "OTP" | "OPTIONAL"
  sms: boolean | "CONDITIONAL" | "OPTIONAL"
  mobilePush: boolean | "OPTIONAL"
  webPush: boolean | "OPTIONAL"
  category: "security" | "booking" | "payment" | "payout" | "kyc" | "listing" | "review" | "product"
  urgency: "CRITICAL" | "HIGH" | "NORMAL" | "LOW"
}

export const NOTIFICATION_EVENT = {
  // Authentication & Security
  GUEST_REGISTRATION: "GUEST_REGISTRATION",
  HOST_REGISTRATION: "HOST_REGISTRATION",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PHONE_OTP_REQUESTED: "PHONE_OTP_REQUESTED",

  // Booking Lifecycle
  HOST_REQUEST_RECEIVED: "HOST_REQUEST_RECEIVED",
  GUEST_REQUEST_SUBMITTED: "GUEST_REQUEST_SUBMITTED",
  GUEST_HOST_ACCEPTED: "GUEST_HOST_ACCEPTED",
  GUEST_HOST_DECLINED: "GUEST_HOST_DECLINED",
  BOOKING_DEADLINE_REMINDER: "BOOKING_DEADLINE_REMINDER",
  GUEST_HOST_WINDOW_EXPIRED: "GUEST_HOST_WINDOW_EXPIRED",
  GUEST_PAYMENT_WINDOW_EXPIRED: "GUEST_PAYMENT_WINDOW_EXPIRED",
  GUEST_CANCELLED_BEFORE_PAYMENT: "GUEST_CANCELLED_BEFORE_PAYMENT",
  GUEST_CANCELLED_CONFIRMED: "GUEST_CANCELLED_CONFIRMED",

  // Payment & Arrival
  GUEST_PAYMENT_CONFIRMED: "GUEST_PAYMENT_CONFIRMED",
  GUEST_ARRIVAL_GUIDE: "GUEST_ARRIVAL_GUIDE",
  HOST_BOOKING_CONFIRMED: "HOST_BOOKING_CONFIRMED",
  GUEST_PAYMENT_FAILED: "GUEST_PAYMENT_FAILED",
  GUEST_LATE_PAYMENT_RESOLUTION: "GUEST_LATE_PAYMENT_RESOLUTION",
  ADMIN_LATE_PAYMENT_RECON: "ADMIN_LATE_PAYMENT_RECON",

  // Host Onboarding, KYC & Moderation
  HOST_KYC_SUBMITTED: "HOST_KYC_SUBMITTED",
  HOST_KYC_APPROVED: "HOST_KYC_APPROVED",
  HOST_KYC_REJECTED: "HOST_KYC_REJECTED",
  LISTING_PUBLISHED: "LISTING_PUBLISHED",
  LISTING_SUSPENDED: "LISTING_SUSPENDED",

  // Social & Reviews
  HOST_NEW_REVIEW: "HOST_NEW_REVIEW",

  // Finance & Payouts
  BOOKING_REFUND_PROCESSED: "BOOKING_REFUND_PROCESSED",
  HOST_PAYOUT_DISBURSED: "HOST_PAYOUT_DISBURSED",
} as const

export type NotificationEventType =
  (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT]

/**
 * Standard Central Routing Matrix defined in Platform Specification
 */
export const ROUTING_MATRIX: Record<string, ChannelRoutingRule> = {
  [NOTIFICATION_EVENT.GUEST_REGISTRATION]: {
    inbox: true,
    email: "OTP",
    sms: "CONDITIONAL", // Only if phone verification required
    mobilePush: false,
    webPush: false,
    category: "security",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.HOST_REGISTRATION]: {
    inbox: true,
    email: "OTP",
    sms: "CONDITIONAL",
    mobilePush: false,
    webPush: false,
    category: "security",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.PHONE_OTP_REQUESTED]: {
    inbox: false,
    email: false,
    sms: true,
    mobilePush: false,
    webPush: false,
    category: "security",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.PASSWORD_RESET_REQUESTED]: {
    inbox: true,
    email: true,
    sms: false,
    mobilePush: "OPTIONAL",
    webPush: "OPTIONAL",
    category: "security",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.PASSWORD_CHANGED]: {
    inbox: true,
    email: true,
    sms: "CONDITIONAL",
    mobilePush: "OPTIONAL",
    webPush: "OPTIONAL",
    category: "security",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.HOST_REQUEST_RECEIVED]: {
    inbox: true,
    email: true,
    sms: true, // Urgent: 2-minute decision window
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.GUEST_REQUEST_SUBMITTED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_HOST_ACCEPTED]: {
    inbox: true,
    email: true,
    sms: true, // Urgent: 10-minute payment hold
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.GUEST_HOST_DECLINED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.BOOKING_DEADLINE_REMINDER]: {
    inbox: true,
    email: "OPTIONAL",
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "CRITICAL",
  },
  [NOTIFICATION_EVENT.GUEST_HOST_WINDOW_EXPIRED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_PAYMENT_WINDOW_EXPIRED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_PAYMENT_CONFIRMED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "payment",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_ARRIVAL_GUIDE]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.HOST_BOOKING_CONFIRMED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_PAYMENT_FAILED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "payment",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_CANCELLED_BEFORE_PAYMENT]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_CANCELLED_CONFIRMED]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "booking",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.HOST_KYC_SUBMITTED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "kyc",
    urgency: "NORMAL",
  },
  [NOTIFICATION_EVENT.HOST_KYC_APPROVED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "kyc",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.HOST_KYC_REJECTED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "kyc",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.LISTING_PUBLISHED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "listing",
    urgency: "NORMAL",
  },
  [NOTIFICATION_EVENT.LISTING_SUSPENDED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "listing",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.HOST_NEW_REVIEW]: {
    inbox: true,
    email: true,
    sms: false, // Low-urgency, avoid SMS costs
    mobilePush: true,
    webPush: true,
    category: "review",
    urgency: "NORMAL",
  },
  [NOTIFICATION_EVENT.BOOKING_REFUND_PROCESSED]: {
    inbox: true,
    email: true,
    sms: "OPTIONAL",
    mobilePush: true,
    webPush: true,
    category: "payment",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.HOST_PAYOUT_DISBURSED]: {
    inbox: true,
    email: true,
    sms: true, // Financial notification
    mobilePush: true,
    webPush: true,
    category: "payout",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.ADMIN_LATE_PAYMENT_RECON]: {
    inbox: true,
    email: true,
    sms: false,
    mobilePush: false,
    webPush: false,
    category: "payment",
    urgency: "HIGH",
  },
  [NOTIFICATION_EVENT.GUEST_LATE_PAYMENT_RESOLUTION]: {
    inbox: true,
    email: true,
    sms: true,
    mobilePush: true,
    webPush: true,
    category: "payment",
    urgency: "HIGH",
  },
}

/**
 * Fallback routing rule for unlisted/custom notifications.
 */
const DEFAULT_ROUTING_RULE: ChannelRoutingRule = {
  inbox: true,
  email: true,
  sms: false,
  mobilePush: "OPTIONAL",
  webPush: "OPTIONAL",
  category: "product",
  urgency: "NORMAL",
}

/**
 * Resolve routing rule for a given event name.
 */
export function getRoutingRule(eventName: string): ChannelRoutingRule {
  const normalized = eventName.toUpperCase().trim()
  return ROUTING_MATRIX[normalized] || DEFAULT_ROUTING_RULE
}

/**
 * Determine whether a channel is eligible according to the central matrix policy.
 */
export function isChannelEligibleForEvent(
  eventName: string,
  channel: "inbox" | "email" | "sms" | "mobilePush" | "webPush"
): boolean {
  const rule = getRoutingRule(eventName)
  const val = rule[channel]
  if (val === true || val === "OTP" || val === "OPTIONAL" || val === "CONDITIONAL") {
    return true
  }
  return false
}
