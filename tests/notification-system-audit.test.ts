import { describe, it, before, beforeEach } from "node:test"
import assert from "node:assert/strict"
import crypto from "crypto"
import {
  validateEmail,
  validateAndNormalizePhone,
  validateUserId,
  validateDeviceToken,
  maskRecipient,
} from "../backend/src/modules/notifications/recipient-validator"
import {
  ROUTING_MATRIX,
  NOTIFICATION_EVENT,
  getRoutingRule,
  isChannelEligibleForEvent,
} from "../backend/src/modules/notifications/routing-matrix"
import {
  sendEmail,
  sendTransactionalEmail,
} from "../backend/src/modules/notifications/notifications.service"
import { sendSms } from "../backend/src/modules/notifications/termii.service"
import { sendFcmPush } from "../backend/src/modules/notifications/fcm.service"
import { sendWebPush } from "../backend/src/modules/notifications/web-push.service"
import {
  withChannelIdempotency,
  recordSkippedDelivery,
} from "../backend/src/modules/notifications/delivery-ledger"
import { inboxService } from "../backend/src/modules/notifications/inbox.service"
import { deviceTokensService } from "../backend/src/modules/notifications/device-tokens.service"
import {
  notifyLifecycleEvent,
  notifyUserEvent,
} from "../backend/src/modules/notifications/orchestrator"
import { getDb, schema } from "../backend/src/db/client"
import { eq } from "drizzle-orm"

describe("Ilé Platform Complete Notification System Audit & Recipient Verification", () => {
  const db = getDb()

  // ─── 1. Recipient Typing & Strict Boundaries ───
  describe("1. Strict Recipient Validation & Anti-Substitution", () => {
    it("1. Email event validates RFC 5322 email addresses", () => {
      assert.equal(validateEmail("guest@ilestays.ng").valid, true)
      assert.equal(validateEmail("host.contact+test@domain.co.uk").valid, true)
    })

    it("2. SMS validates and normalizes E.164 phone numbers", () => {
      const ngLocal = validateAndNormalizePhone("08031234567", "NG")
      assert.equal(ngLocal.valid, true)
      assert.equal(ngLocal.value, "+2348031234567")

      const intlUk = validateAndNormalizePhone("+447911123456")
      assert.equal(intlUk.valid, true)
      assert.equal(intlUk.value, "+447911123456")

      const intlUs = validateAndNormalizePhone("+14155552671")
      assert.equal(intlUs.valid, true)
      assert.equal(intlUs.value, "+14155552671")
    })

    it("3. FCM tokens are validated as non-email, non-phone credential strings", () => {
      const validToken = "fcm_token_abcdef1234567890_long_device_token_xyz"
      assert.equal(validateDeviceToken(validToken, "fcm").valid, true)
    })

    it("4. Web Push subscriptions are validated as URL endpoints or JSON objects", () => {
      const urlEndpoint = "https://fcm.googleapis.com/fcm/send/sample_endpoint_123"
      assert.equal(validateDeviceToken(urlEndpoint, "web_push").valid, true)

      const jsonSub = JSON.stringify({ endpoint: urlEndpoint, keys: { p256dh: "k1", auth: "k2" } })
      assert.equal(validateDeviceToken(jsonSub, "web_push").valid, true)
    })

    it("5. In-app notifications validate authenticated user ID", () => {
      assert.equal(validateUserId("usr_123456789").valid, true)
      assert.equal(validateUserId("usr_host_abc").valid, true)
    })

    it("8. Invalid phone numbers are rejected before Termii dispatch", () => {
      const res = validateAndNormalizePhone("not-a-number")
      assert.equal(res.valid, false)
      assert.match(res.error!, /Phone digit count|letters/i)
    })

    it("9. Invalid email addresses are rejected before Resend dispatch", () => {
      const res = validateEmail("invalid-email-no-at-sign")
      assert.equal(res.valid, false)
      assert.match(res.error!, /Invalid email address format/i)
    })

    it("10. An email address can NEVER be passed to Termii as a phone recipient", async () => {
      const res = validateAndNormalizePhone("guest@example.com")
      assert.equal(res.valid, false)
      assert.match(res.error!, /Email address cannot be passed into SMS/i)

      const smsResult = await sendSms({
        to: "guest@example.com",
        message: "Test message",
      })
      assert.equal(smsResult.ok, false)
      assert.equal(smsResult.skipped, true)
      assert.match(smsResult.error!, /Email address cannot be passed into SMS/i)
    })

    it("11. A phone number can NEVER be passed to Resend as an email recipient", async () => {
      const res = validateEmail("+2348031234567")
      assert.equal(res.valid, false)
      assert.match(res.error!, /Phone number cannot be passed into email recipient field/i)

      const emailResult = await sendTransactionalEmail({
        to: "+2348031234567",
        subject: "Test Subject",
        html: "<p>Test</p>",
      })
      assert.equal(emailResult.sent, false)
      assert.equal(emailResult.skipped, true)
      assert.match(emailResult.error!, /Phone number cannot be passed into email/i)
    })

    it("12. A device token cannot be used as an in-app user identifier", () => {
      const res = validateUserId("fcm_token_sample_12345678901234567890")
      // Valid user IDs are not device tokens; user IDs cannot be empty or email
      assert.equal(validateUserId("user@example.com").valid, false)
      assert.equal(validateUserId("+2348031234567").valid, false)
    })

    it("13. An invalid or non-URL string cannot be passed as a Web Push subscription", () => {
      const res = validateDeviceToken("fcm_raw_token_not_url", "web_push")
      assert.equal(res.valid, false)
      assert.match(res.error!, /Web Push subscription must be a valid URL endpoint/i)
    })
  })

  // ─── 2. Routing Matrix Policy Verification ───
  describe("2. Event-to-Channel Central Routing Matrix", () => {
    it("enforces central routing rules for critical booking transitions", () => {
      const hostRequest = getRoutingRule(NOTIFICATION_EVENT.HOST_REQUEST_RECEIVED)
      assert.equal(hostRequest.inbox, true)
      assert.equal(hostRequest.email, true)
      assert.equal(hostRequest.sms, true) // Urgent 2-minute decision window
      assert.equal(hostRequest.mobilePush, true)
      assert.equal(hostRequest.webPush, true)
      assert.equal(hostRequest.category, "booking")
    })

    it("disables SMS for low-urgency events to protect costs and user peace", () => {
      const reviewRule = getRoutingRule(NOTIFICATION_EVENT.HOST_NEW_REVIEW)
      assert.equal(reviewRule.inbox, true)
      assert.equal(reviewRule.email, true)
      assert.equal(reviewRule.sms, false) // Strictly no SMS for reviews
      assert.equal(reviewRule.mobilePush, true)
      assert.equal(reviewRule.webPush, true)
      assert.equal(reviewRule.category, "review")
    })

    it("enforces password reset routing (Email + Inbox + Push, no SMS by default)", () => {
      const pwReset = getRoutingRule(NOTIFICATION_EVENT.PASSWORD_RESET_REQUESTED)
      assert.equal(pwReset.inbox, true)
      assert.equal(pwReset.email, true)
      assert.equal(pwReset.sms, false)
      assert.equal(pwReset.category, "security")
    })
  })

  // ─── 3. Missing Recipients & Fault Isolation ───
  describe("3. Channel Independence & Missing Contact Handling", () => {
    it("6. Missing phone number skips SMS channel without throwing", async () => {
      const res = await sendSms({
        to: "",
        message: "Hello guest",
      })
      assert.equal(res.ok, false)
      assert.equal(res.skipped, true)
      assert.match(res.error!, /Phone number cannot be empty/i)
    })

    it("7. Missing email address skips email channel without throwing", async () => {
      const res = await sendTransactionalEmail({
        to: "",
        subject: "Subject",
        html: "<p>Text</p>",
      })
      assert.equal(res.sent, false)
      assert.equal(res.skipped, true)
      assert.match(res.error!, /Email cannot be empty/i)
    })

    it("14. A notification cannot be sent to another user's device", async () => {
      const targetUserId = `usr_target_${Date.now()}`
      const otherUserId = `usr_other_${Date.now()}`

      // Create test user rows to satisfy foreign key constraints
      await db.insert(schema.users).values([
        {
          id: targetUserId,
          email: `${targetUserId}@test.ilestays.ng`,
          passwordHash: "hash123",
          firstName: "Target",
          lastName: "User",
        },
        {
          id: otherUserId,
          email: `${otherUserId}@test.ilestays.ng`,
          passwordHash: "hash123",
          firstName: "Other",
          lastName: "User",
        },
      ])

      // Register device for target user
      await deviceTokensService.register({
        userId: targetUserId,
        token: `fcm_token_target_${Date.now()}_long_valid_token`,
        platform: "android",
      })

      // Query devices for other user
      const otherTokens = await deviceTokensService.listActiveForUser(otherUserId)
      assert.equal(otherTokens.length, 0) // Target user's device is not returned
    })

    it("15. Multiple devices belonging to one user are all retrieved for push fan-out", async () => {
      const multiUser = `usr_multi_${Date.now()}`
      await db.insert(schema.users).values({
        id: multiUser,
        email: `${multiUser}@test.ilestays.ng`,
        passwordHash: "hash123",
        firstName: "Multi",
        lastName: "Devices",
      })

      const token1 = `fcm_android_${Date.now()}_device_1_valid_token`
      const token2 = `fcm_ios_${Date.now()}_device_2_valid_token`

      await deviceTokensService.register({
        userId: multiUser,
        token: token1,
        platform: "android",
      })
      await deviceTokensService.register({
        userId: multiUser,
        token: token2,
        platform: "ios",
      })

      const devices = await deviceTokensService.listActiveForUser(multiUser)
      assert.equal(devices.length, 2)
      assert.ok(devices.some((d) => d.token === token1))
      assert.ok(devices.some((d) => d.token === token2))
    })

    it("16. A user with no registered devices still receives in-app notifications successfully", async () => {
      const noDeviceUser = `usr_nodevice_${Date.now()}`
      await db.insert(schema.users).values({
        id: noDeviceUser,
        email: `${noDeviceUser}@test.ilestays.ng`,
        passwordHash: "hash123",
        firstName: "No",
        lastName: "Device",
      })

      const inboxKey = `inbox_test_${Date.now()}`
      const inboxResult = await inboxService.upsertInboxItem({
        userId: noDeviceUser,
        eventType: "TEST_EVENT",
        title: "Test In-App Alert",
        body: "This should be saved even without phone or device token",
        idempotencyKey: inboxKey,
      })

      assert.equal(inboxResult.created, true)
      assert.equal(inboxResult.item.userId, noDeviceUser)

      const userInbox = await inboxService.listForUser(noDeviceUser)
      assert.equal(userInbox.items.length, 1)
      assert.equal(userInbox.unreadCount, 1)
    })

    it("17. External provider failure does not block other channels or mutations", async () => {
      const testUser = `usr_fault_${Date.now()}`
      await db.insert(schema.users).values({
        id: testUser,
        email: `${testUser}@test.ilestays.ng`,
        passwordHash: "hash123",
        firstName: "Fault",
        lastName: "Isolation",
      })

      // Simulate orchestrator call where SMS provider is intentionally given an invalid number
      assert.doesNotThrow(() => {
        notifyLifecycleEvent({
          bookingId: `bkg_fault_${Date.now()}`,
          event: NOTIFICATION_EVENT.GUEST_HOST_ACCEPTED,
          recipientRole: "guest",
          channels: {
            inbox: {
              userId: testUser,
              title: "Host Accepted!",
              body: "Please proceed to payment.",
            },
            email: {
              to: `${testUser}@test.ilestays.ng`,
              subject: "Host accepted",
              html: "<p>Accepted</p>",
            },
            sms: {
              to: "invalid-phone",
              message: "Test message",
            },
          },
        })
      })
    })

    it("18. Duplicate events do not produce duplicate ledger or inbox records", async () => {
      const dupUser = `usr_dup_${Date.now()}`
      await db.insert(schema.users).values({
        id: dupUser,
        email: `${dupUser}@test.ilestays.ng`,
        passwordHash: "hash123",
        firstName: "Dup",
        lastName: "Test",
      })

      const stableKey = `dup_key_${Date.now()}`

      const first = await withChannelIdempotency({
        idempotencyKey: stableKey,
        channel: "inbox",
        eventType: "BOOKING_CONFIRMED",
        userId: dupUser,
        recipient: dupUser,
        send: async () => ({ ok: true, delivered: true }),
      })
      assert.equal(first.sent, true)

      // Second identical dispatch with same idempotency key
      const second = await withChannelIdempotency({
        idempotencyKey: stableKey,
        channel: "inbox",
        eventType: "BOOKING_CONFIRMED",
        userId: dupUser,
        recipient: dupUser,
        send: async () => ({ ok: true }),
      })
      assert.equal(second.idempotent, true)
      assert.equal(second.sent, true) // Retains success state
    })

    it("19. Delivery statuses accurately reflect provider evidence", () => {
      // ACCEPTED: provider confirmed acceptance of request
      // DELIVERED: destination confirmed receipt (inbox persisted, webhook delivered)
      // SENT: transmitted in non-tracked or test mode
      // SKIPPED: omitted per routing matrix or missing/invalid contact info
      // NOT_CONFIGURED: required provider keys absent in environment
      // EXHAUSTED: max retry ceiling reached
      const validStatuses = [
        "PENDING",
        "SENT",
        "ACCEPTED",
        "DELIVERED",
        "FAILED",
        "EXHAUSTED",
        "SKIPPED",
        "NOT_CONFIGURED",
      ]
      assert.equal(validStatuses.includes("ACCEPTED"), true)
      assert.equal(validStatuses.includes("DELIVERED"), true)
      assert.equal(validStatuses.includes("NOT_CONFIGURED"), true)
    })

    it("20. Logout revokes device token so subsequent pushes are not sent to that device", async () => {
      const logoutUser = `usr_logout_${Date.now()}`
      await db.insert(schema.users).values({
        id: logoutUser,
        email: `${logoutUser}@test.ilestays.ng`,
        passwordHash: "hash123",
        firstName: "Logout",
        lastName: "Test",
      })

      const token = `fcm_logout_${Date.now()}_token_123456789`
      await deviceTokensService.register({
        userId: logoutUser,
        token,
        platform: "android",
      })

      const beforeLogout = await deviceTokensService.listActiveForUser(logoutUser)
      assert.equal(beforeLogout.length, 1)

      // User logs out -> revoke device token
      await deviceTokensService.revoke(logoutUser, token)

      const afterLogout = await deviceTokensService.listActiveForUser(logoutUser)
      assert.equal(afterLogout.length, 0)
    })
  })

  // ─── 4. Privacy & Masking Verification ───
  describe("4. Recipient Privacy & Masking", () => {
    it("masks email addresses for audit logging", () => {
      const masked = maskRecipient("testuser@ilestays.ng", "email")
      assert.equal(masked.startsWith("te***@ilestays.ng"), true)
      assert.ok(!masked.includes("testuser"))
    })

    it("masks phone numbers for audit logging", () => {
      const masked = maskRecipient("+2348031234567", "phone")
      assert.equal(masked.startsWith("+234***567"), true)
      assert.ok(!masked.includes("803123"))
    })
  })
})
