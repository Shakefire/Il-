import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  NOTIFICATION_EVENT,
  getRoutingRule,
  isChannelEligibleForEvent,
} from "../backend/src/modules/notifications/routing-matrix"
import {
  validateAndNormalizePhone,
  validateDeviceToken,
  validateEmail,
  validateUserId,
} from "../backend/src/modules/notifications/recipient-validator"

const LIFECYCLE = [
  NOTIFICATION_EVENT.GUEST_REQUEST_SUBMITTED,
  NOTIFICATION_EVENT.HOST_REQUEST_RECEIVED,
  NOTIFICATION_EVENT.GUEST_HOST_ACCEPTED,
  NOTIFICATION_EVENT.GUEST_HOST_DECLINED,
  NOTIFICATION_EVENT.GUEST_HOST_WINDOW_EXPIRED,
  NOTIFICATION_EVENT.GUEST_PAYMENT_WINDOW_EXPIRED,
  NOTIFICATION_EVENT.GUEST_PAYMENT_CONFIRMED,
  NOTIFICATION_EVENT.GUEST_PAYMENT_FAILED,
  NOTIFICATION_EVENT.GUEST_LATE_PAYMENT_RESOLUTION,
  NOTIFICATION_EVENT.ADMIN_LATE_PAYMENT_RECON,
  NOTIFICATION_EVENT.GUEST_ARRIVAL_GUIDE,
  NOTIFICATION_EVENT.HOST_BOOKING_CONFIRMED,
] as const

describe("Phase 1 notification routing", () => {
  it("keeps all five channels addressable and does not substitute recipient types", () => {
    for (const eventName of LIFECYCLE) {
      const rule = getRoutingRule(eventName)
      assert.equal(typeof rule.inbox, "boolean")
      assert.ok(rule.email !== false, `${eventName} email`)
      assert.equal(isChannelEligibleForEvent(eventName, "inbox"), rule.inbox === true)
    }

    const confirmed = getRoutingRule(NOTIFICATION_EVENT.GUEST_PAYMENT_CONFIRMED)
    assert.equal(confirmed.inbox, true)
    assert.equal(confirmed.email, true)
    assert.ok(confirmed.sms !== false)
    assert.equal(confirmed.mobilePush, true)
    assert.equal(confirmed.webPush, true)

    assert.equal(validateEmail("guest@test.ile.ng").valid, true)
    assert.equal(validateEmail("+2348012345678").valid, false)

    const phone = validateAndNormalizePhone("08031234567")
    assert.equal(phone.valid, true)
    assert.equal(phone.value, "+2348031234567")
    assert.equal(validateAndNormalizePhone("guest@test.ile.ng").valid, false)
    assert.equal(validateAndNormalizePhone("123456").valid, false)

    assert.equal(validateUserId("user_guest_1").valid, true)
    assert.equal(validateUserId("guest@test.ile.ng").valid, false)
    assert.equal(validateUserId("+2348031234567").valid, false)

    assert.equal(validateDeviceToken("fcm-device-token-value", "fcm").valid, true)
    assert.equal(validateDeviceToken("guest@test.ile.ng", "fcm").valid, false)
    assert.equal(
      validateDeviceToken("https://push.example/subscription", "web_push").valid,
      true
    )
    assert.equal(validateDeviceToken("not-a-subscription", "web_push").valid, false)
  })
})
