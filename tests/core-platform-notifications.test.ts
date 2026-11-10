import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildLifecycleIdempotencyKey, LIFECYCLE_EMAIL_EVENT } from "../backend/src/modules/notifications/lifecycle-notify"
import { normalizeNgPhone, sendSms } from "../backend/src/modules/notifications/termii.service"
import { sendFcmPush } from "../backend/src/modules/notifications/fcm.service"
import {
  sendWebPush,
  getWebPushPublicKey,
  resolveWebPushEndpoint,
} from "../backend/src/modules/notifications/web-push.service"

describe("Core platform notifications adapters", () => {
  it("builds stable lifecycle idempotency keys", () => {
    const key = buildLifecycleIdempotencyKey(
      LIFECYCLE_EMAIL_EVENT.GUEST_HOST_ACCEPTED,
      "bkg_123",
      "guest"
    )
    assert.equal(key, "booking:bkg_123:GUEST_HOST_ACCEPTED:guest")
  })

  it("normalizes Nigerian phone numbers for Termii", () => {
    assert.equal(normalizeNgPhone("08031234567"), "2348031234567")
    assert.equal(normalizeNgPhone("+234 803 123 4567"), "2348031234567")
    assert.equal(normalizeNgPhone("8031234567"), "2348031234567")
  })

  it("SMS adapter uses mock mode without TERMII_API_KEY", async () => {
    const prevProvider = process.env.SMS_PROVIDER
    const prevKey = process.env.TERMII_API_KEY
    process.env.SMS_PROVIDER = "console"
    delete process.env.TERMII_API_KEY

    const result = await sendSms({
      to: "08031234567",
      message: "Ilé test OTP 123456",
    })
    assert.equal(result.ok, true)
    assert.equal(result.mock, true)
    assert.ok(result.providerMessageId?.startsWith("sms_mock_"))

    if (prevProvider === undefined) delete process.env.SMS_PROVIDER
    else process.env.SMS_PROVIDER = prevProvider
    if (prevKey === undefined) delete process.env.TERMII_API_KEY
    else process.env.TERMII_API_KEY = prevKey
  })

  it("FCM adapter mocks without Firebase credentials", async () => {
    const prev = process.env.PUSH_PROVIDER
    process.env.PUSH_PROVIDER = "console"
    const result = await sendFcmPush({
      token: "fcm_device_token_example_abcdefgh",
      title: "Host confirmed",
      body: "Complete payment to confirm your stay.",
    })
    assert.equal(result.ok, true)
    assert.equal(result.mock, true)
    if (prev === undefined) delete process.env.PUSH_PROVIDER
    else process.env.PUSH_PROVIDER = prev
  })

  it("Web push adapter mocks without VAPID keys", async () => {
    const prev = process.env.WEB_PUSH_PROVIDER
    process.env.WEB_PUSH_PROVIDER = "console"
    const result = await sendWebPush({
      endpoint: "https://fcm.googleapis.com/fcm/send/example",
      title: "Update",
      body: "Booking update",
    })
    assert.equal(result.ok, true)
    assert.equal(result.mock, true)
    assert.equal(getWebPushPublicKey(), process.env.WEB_PUSH_VAPID_PUBLIC_KEY || null)
    if (prev === undefined) delete process.env.WEB_PUSH_PROVIDER
    else process.env.WEB_PUSH_PROVIDER = prev
  })

  it("resolves web push endpoint from JSON subscription token", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/example-endpoint"
    const token = JSON.stringify({
      endpoint,
      keys: { p256dh: "x", auth: "y" },
    })
    assert.equal(resolveWebPushEndpoint(token), endpoint)
    assert.equal(resolveWebPushEndpoint(endpoint), endpoint)
  })
})
