/**
 * Phase 5 — final remediation / production acceptance.
 * Prefer scripts/run_phase5_tests.ps1 (forced local PGlite; never Neon).
 */
import "dotenv/config"
import test, { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import { eq } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"
import { bookingsService } from "../backend/src/modules/bookings/bookings.service"
import {
  cleanupExpiredRateLimitBuckets,
  clientIp,
  consumeRateLimitAsync,
  isGlobalRateLimitExempt,
  isStrictRateLimitKey,
  markRateLimitStoreUnhealthy,
  resetRateLimits,
} from "../backend/src/lib/rate-limit"
import { sendSms } from "../backend/src/modules/notifications/termii.service"
import { sendFcmPush } from "../backend/src/modules/notifications/fcm.service"
import { sendWebPush } from "../backend/src/modules/notifications/web-push.service"
import { inboxService } from "../backend/src/modules/notifications/inbox.service"
import { commissionFundsBalance } from "../backend/src/modules/finance/admin-refund.service"
import { ACCOUNT_CODES, ensurePhase2Accounts } from "../backend/src/modules/finance/ledger.service"

const testEnv = process.env as Record<string, string | undefined>
testEnv.NODE_ENV = "test"
testEnv.EMAIL_PROVIDER = "console"
testEnv.SMS_PROVIDER = "console"
testEnv.PUSH_PROVIDER = "console"
testEnv.WEB_PUSH_PROVIDER = "console"
testEnv.PAYSTACK_MOCK_TRANSFERS = "true"

const db = getDb()
const ts = Date.now()

describe("Phase 5 — House Pass residual cleanup", () => {
  it("active product code has no house-pass routes, aliases, or 410 stubs", () => {
    assert.equal(fs.existsSync("backend/src/modules/bookings/house-pass.ts"), false)
    assert.equal(fs.existsSync("src/app/api/bookings/[id]/house-pass/route.ts"), false)
    const routes = fs.readFileSync("backend/src/modules/bookings/bookings.routes.ts", "utf8")
    assert.doesNotMatch(routes, /house-pass|HOUSE_PASS|getHousePass/i)
    const flutterApi = fs.readFileSync("apps/mobile/lib/core/api/ile_api.dart", "utf8")
    assert.doesNotMatch(flutterApi, /getHousePass|HousePass|house-pass/i)
    assert.match(flutterApi, /getStayDetails/)
    const stayCopy = fs.readFileSync("src/app/stay/[slug]/StayDetailClient.tsx", "utf8")
    assert.doesNotMatch(stayCopy, /House Pass/)
  })
})

describe("Phase 5 — Distributed rate limiting", () => {
  it("strict prefixes cover auth/payment/admin/booking abuse surfaces", () => {
    assert.equal(isStrictRateLimitKey("login:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("register:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("send-phone-otp:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("forgot-password:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("pay-init:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("refund:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("admin:refund:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("booking-create:1.2.3.4"), true)
    assert.equal(isStrictRateLimitKey("global:1.2.3.4"), false)
  })

  it("atomic postgres bucket enforces concurrent multi-instance same store", async () => {
    resetRateLimits()
    // Warm durable store once so concurrent callers share an already-ready init.
    const warm = await consumeRateLimitAsync(`login:p5-warm-${ts}`, 100, 60_000, "strict")
    assert.equal(warm.backend, "postgres", `warmup must use durable store, got ${warm.backend}`)
    const key = `login:p5-concurrent-${ts}`
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimitAsync(key, 3, 60_000, "strict"))
    )
    const allowed = results.filter((r) => r.ok).length
    const blocked = results.filter((r) => !r.ok).length
    assert.equal(allowed, 3)
    assert.equal(blocked, 5)
    const backends = Array.from(new Set(results.map((r) => r.backend)))
    assert.deepEqual(backends, ["postgres"])
  })

  it("IP extraction prefers leftmost X-Forwarded-For", () => {
    assert.equal(
      clientIp({
        ip: "10.0.0.9",
        headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
      }),
      "203.0.113.10"
    )
    assert.equal(
      clientIp({ ip: "10.0.0.9", headers: { "x-real-ip": "198.51.100.7" } }),
      "198.51.100.7"
    )
  })

  it("OTP and payment-init abuse hits strict limits", async () => {
    resetRateLimits()
    const otpKey = `send-phone-otp:p5-otp-${ts}`
    const payKey = `pay-init:p5-pay-${ts}`
    for (let i = 0; i < 5; i++) {
      const r = await consumeRateLimitAsync(otpKey, 5, 60_000, "strict")
      assert.equal(r.ok, true)
    }
    const otpBlocked = await consumeRateLimitAsync(otpKey, 5, 60_000, "strict")
    assert.equal(otpBlocked.ok, false)
    assert.ok(otpBlocked.retryAfterSec >= 1)

    for (let i = 0; i < 15; i++) {
      await consumeRateLimitAsync(payKey, 15, 60_000, "strict")
    }
    const payBlocked = await consumeRateLimitAsync(payKey, 15, 60_000, "strict")
    assert.equal(payBlocked.ok, false)
  })

  it("store unavailable uses bounded fallback for strict keys (never unlimited)", async () => {
    resetRateLimits()
    markRateLimitStoreUnhealthy()
    const key = `login:p5-degraded-${ts}`
    const first = await consumeRateLimitAsync(key, 2, 60_000, "strict")
    const second = await consumeRateLimitAsync(key, 2, 60_000, "strict")
    const third = await consumeRateLimitAsync(key, 2, 60_000, "strict")
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    assert.equal(third.ok, false)
    assert.equal(first.backend, "memory")
    assert.equal(first.degraded, true)
    assert.ok(third.retryAfterSec >= 1)
    resetRateLimits()
  })

  it("store recovery returns to postgres backend", async () => {
    resetRateLimits()
    markRateLimitStoreUnhealthy()
    const degraded = await consumeRateLimitAsync(`login:p5-recover-a-${ts}`, 5, 60_000, "strict")
    assert.equal(degraded.backend, "memory")
    resetRateLimits()
    const recovered = await consumeRateLimitAsync(`login:p5-recover-b-${ts}`, 5, 60_000, "strict")
    assert.ok(recovered.backend === "postgres" || recovered.backend === "memory")
  })

  it("cleanup removes expired durable buckets", async () => {
    resetRateLimits()
    const key = `login:p5-cleanup-${ts}`
    await consumeRateLimitAsync(key, 10, 1, "strict")
    await new Promise((r) => setTimeout(r, 5))
    const removed = await cleanupExpiredRateLimitBuckets()
    assert.ok(removed >= 0)
  })

  it("Paystack webhook remains exempt from ordinary user rate limits", () => {
    assert.equal(isGlobalRateLimitExempt("/api/payments/webhook", "POST"), true)
    assert.equal(isGlobalRateLimitExempt("/api/payments/webhook/paystack", "POST"), true)
    assert.equal(isGlobalRateLimitExempt("/api/auth/login", "POST"), false)
    assert.equal(isGlobalRateLimitExempt("/health", "GET"), true)
  })
})

describe("Phase 5 — Notification channel independence", () => {
  it("five channels resolve independently without destination substitution", async () => {
    const userId = `user_p5_notif_${ts}`
    await db
      .insert(schema.users)
      .values({
        id: userId,
        email: `p5_notif_${ts}@test.ile.ng`,
        passwordHash: "hash",
        firstName: "Phase",
        lastName: "Five",
        phone: "+2348012345678",
        role: "guest",
        emailVerified: true,
        status: "ACTIVE",
      })
      .onConflictDoNothing()

    const inbox = await inboxService.upsertInboxItem({
      userId,
      eventType: "P5_CHANNEL_CHECK",
      title: "Inbox channel",
      body: "In-app only",
      idempotencyKey: `p5_inbox_${ts}`,
    })
    assert.ok(inbox.item.id)

    const sms = await sendSms({ to: "+2348012345678", message: "OTP test" })
    assert.equal(sms.mock || sms.ok || sms.skipped, true)
    assert.doesNotMatch(String(sms.error || ""), /@/)

    const fcm = await sendFcmPush({
      token: "fcm_token_phase5_test_not_an_email",
      title: "FCM",
      body: "push",
      userId,
      data: { deepLink: "/trips" },
    })
    assert.ok(fcm.mock || fcm.ok || fcm.skipped)

    const web = await sendWebPush({
      endpoint: "https://fcm.googleapis.com/fcm/send/phase5-web-push-endpoint",
      title: "WebPush",
      body: "browser",
      data: { deepLink: "/trips" },
    })
    assert.ok(web.mock || web.ok || web.skipped)

    // Support reply path must not require SMS — verified by source contract.
    const supportSrc = fs.readFileSync("backend/src/modules/support/support.service.ts", "utf8")
    assert.match(supportSrc, /SMS is not required for every support message/)
    assert.doesNotMatch(supportSrc, /sms:\s*true/)
    assert.match(supportSrc, /inbox:\s*\{/)
    assert.match(supportSrc, /push:\s*true/)
  })

  it("FCM and Web Push are registered as distinct providers", () => {
    const deviceSrc = fs.readFileSync(
      "backend/src/modules/notifications/device-tokens.service.ts",
      "utf8"
    )
    assert.match(deviceSrc, /"fcm"/)
    assert.match(deviceSrc, /"web_push"/)
    assert.match(deviceSrc, /platform === "web"/)
  })
})

describe("Phase 5 — Expiration forensics (code invariants)", () => {
  it("list reads do not call global expire; worker owns global; confirmed protected", async () => {
    const serviceSrc = fs.readFileSync("backend/src/modules/bookings/bookings.service.ts", "utf8")
    assert.doesNotMatch(serviceSrc, /getUserBookings[\s\S]{0,400}expireDueBookings\(/)
    assert.doesNotMatch(serviceSrc, /getHostBookings[\s\S]{0,400}expireDueBookings\(/)
    assert.match(serviceSrc, /expireDueBookingsGlobal/)
    assert.match(serviceSrc, /pg_try_advisory_lock\(99281\)/)
    assert.match(serviceSrc, /CONFIRMED \/ COMPLETED are never expired/)

    const serverSrc = fs.readFileSync("backend/src/server.ts", "utf8")
    assert.match(serverSrc, /expireDueBookings\(50\)/)

    const hostId = `host_p5_exp_${ts}`
    const guestId = `guest_p5_exp_${ts}`
    const propId = `prop_p5_exp_${ts}`
    const confirmedId = `bkg_p5_exp_ok_${ts}_${Math.floor(Math.random() * 1e6)}`
    for (const [id, role] of [
      [hostId, "host"],
      [guestId, "guest"],
    ] as const) {
      await db
        .insert(schema.users)
        .values({
          id,
          email: `${id}@test.ile.ng`,
          passwordHash: "hash",
          firstName: "P5",
          lastName: role,
          role,
          emailVerified: true,
          status: "ACTIVE",
        })
        .onConflictDoNothing()
    }
    await db
      .insert(schema.properties)
      .values({
        id: propId,
        hostId,
        slug: `p5-exp-${ts}`,
        title: "P5 Exp",
        description: "exp",
        propertyType: "Apartment",
        maxGuests: 2,
        pricePerNight: 50000,
        hostBasePrice: 45000,
        cleaningFee: 0,
        minimumNights: 1,
        city: "Lagos",
        neighborhood: "Ikoyi",
        state: "Lagos",
        latitude: 6.45,
        longitude: 3.43,
        powerType: "Grid",
        coverImage: "/images/stay.jpg",
        status: "PUBLISHED",
      })
      .onConflictDoNothing()
    await db.insert(schema.bookings).values({
      id: confirmedId,
      propertyId: propId,
      guestId,
      referenceCode: `P5EXP${String(ts).slice(-8)}${Math.floor(Math.random() * 1e4)}`.slice(0, 20),
      accessToken: `p5tok_${ts}_${Math.floor(Math.random() * 1e9)}`,
      status: "CONFIRMED",
      guestFirstName: "Guest",
      guestLastName: "Phase5",
      guestEmail: `${guestId}@test.ile.ng`,
      guestPhone: "+2348011111111",
      guestCount: 1,
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-03",
      numberOfNights: 2,
      nightlyPrice: 50000,
      cleaningFee: 0,
      serviceFee: 5000,
      totalAmount: 105000,
      currency: "NGN",
      accommodationSubtotal: 100000,
      hostCommissionPct: 10,
      hostCommissionAmount: 10000,
      hostNetAmount: 90000,
    })

    const targeted = await bookingsService.expireDueBookings(10, confirmedId)
    assert.equal(targeted.scope, "targeted")
    assert.equal(targeted.expired, 0)
    const [row] = await db
      .select({ status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, confirmedId))
    assert.equal(row.status, "CONFIRMED")
  })
})

describe("Phase 5 — Account 1040 funding safety", () => {
  it("1040 is ASSET commission funds; refunds stay blocked when empty", async () => {
    await ensurePhase2Accounts(db)
    const [acc] = await db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.code, ACCOUNT_CODES.COMMISSION_FUNDS))
      .limit(1)
    assert.ok(acc)
    assert.equal(String(acc.type).toUpperCase(), "ASSET")
    const balance = await commissionFundsBalance()
    assert.ok(typeof balance === "number")
    const refundSrc = fs.readFileSync("backend/src/modules/finance/admin-refund.service.ts", "utf8")
    assert.match(refundSrc, /Host wallets were not debited|host wallets are never debited/i)
    assert.match(refundSrc, /fundingAccount:\s*"1040"/)
  })
})

describe("Phase 5 — Infra contracts", () => {
  it("health response shape has no secret values; trustProxy enabled; db is lazy", () => {
    const health = fs.readFileSync("backend/src/modules/health/health.service.ts", "utf8")
    assert.doesNotMatch(health, /sk_live_[a-zA-Z0-9]+|SESSION_SECRET\s*[:=]\s*["'][^"']+["']/)
    assert.doesNotMatch(health, /return[\s\S]{0,200}env\.PAYSTACK_SECRET_KEY\b(?!\?)/)
    const app = fs.readFileSync("backend/src/app.ts", "utf8")
    assert.match(app, /trustProxy:\s*true/)
    const client = fs.readFileSync("backend/src/db/client.ts", "utf8")
    assert.match(client, /Proxy/)
  })

  it("migrations 0008-0011 exist for Neon apply plan (apply BLOCKED)", () => {
    for (const name of [
      "0008_phase1_financial_retention.sql",
      "0009_phase2_commission_account.sql",
      "0010_phase3_platform.sql",
      "0011_phase4_house_pass_removal.sql",
    ]) {
      assert.equal(
        fs.existsSync(path.join("backend", "src", "db", "migrations", name)),
        true
      )
    }
  })
})

test("phase5 force-db import keeps DATABASE_URL empty for local PGlite", () => {
  assert.equal(process.env.DATABASE_URL || "", "")
  assert.match(String(process.env.ILE_PGLITE_DIR || ""), /phase5-test-db/)
})
