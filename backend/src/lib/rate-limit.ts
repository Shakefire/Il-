/**
 * Shared fixed-window rate limit backed by Postgres/PGlite.
 * Critical auth/payment/admin buckets never fail-open unlimited when the
 * durable store is unavailable — they use a bounded in-memory fallback, or
 * a temporary retryable reject if that fallback cannot be applied.
 * Paystack webhooks stay exempt from ordinary user limits.
 */

import { sql } from "drizzle-orm"
import { getDb } from "../db/client"

type Bucket = { count: number; resetAt: number }

export type RateLimitMode = "strict" | "standard"

export type RateLimitDecision = {
  ok: boolean
  retryAfterSec: number
  backend: "postgres" | "memory" | "reject"
  degraded?: boolean
}

const memoryBuckets = new Map<string, Bucket>()
let tableReady: Promise<boolean> | null = null
let storeHealthy = true
let lastStoreErrorAt = 0
const STORE_RETRY_MS = 15_000
const MEMORY_MAX_KEYS = 20_000

/** Prefixes that must not fail-open unlimited on store outage. */
const STRICT_PREFIXES = [
  "login:",
  "register:",
  "register-owner:",
  "verify-email:",
  "resend-email-otp:",
  "send-phone-otp:",
  "verify-phone:",
  "password-reset:",
  "forgot-password:",
  "reset-password:",
  "pay-init:",
  "refund:",
  "admin:",
  "booking-create:",
] as const

export function isStrictRateLimitKey(key: string): boolean {
  return STRICT_PREFIXES.some((prefix) => key.startsWith(prefix))
}

async function ensureRateLimitTable(): Promise<boolean> {
  if (tableReady) {
    const ready = await tableReady
    if (ready && storeHealthy) return true
    if (!storeHealthy && Date.now() - lastStoreErrorAt < STORE_RETRY_MS) {
      return false
    }
    tableReady = null
  }
  // Assign synchronously so concurrent callers share one init promise.
  let resolveReady!: (value: boolean) => void
  tableReady = new Promise<boolean>((resolve) => {
    resolveReady = resolve
  })
  try {
    const db = getDb()
    try {
      await db.execute(sql`SELECT 1 FROM rate_limit_buckets LIMIT 1`)
    } catch {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS rate_limit_buckets (
          bucket_key VARCHAR(200) PRIMARY KEY,
          hit_count INT NOT NULL DEFAULT 0,
          reset_at TIMESTAMPTZ NOT NULL
        )
      `)
    }
    storeHealthy = true
    resolveReady(true)
    return true
  } catch (err) {
    storeHealthy = false
    lastStoreErrorAt = Date.now()
    const message = err instanceof Error ? err.message : "unknown"
    console.warn("[rate-limit] durable store unavailable; using bounded fallback", {
      reason: message.slice(0, 160),
    })
    resolveReady(false)
    return false
  }
}

function pruneMemoryBuckets(now: number): void {
  if (memoryBuckets.size < MEMORY_MAX_KEYS) return
  Array.from(memoryBuckets.entries()).forEach(([key, bucket]) => {
    if (bucket.resetAt <= now) memoryBuckets.delete(key)
  })
  if (memoryBuckets.size < MEMORY_MAX_KEYS) return
  const overflow = memoryBuckets.size - Math.floor(MEMORY_MAX_KEYS * 0.8)
  const keys = Array.from(memoryBuckets.keys())
  for (let i = 0; i < overflow && i < keys.length; i += 1) {
    memoryBuckets.delete(keys[i])
  }
}

function consumeMemory(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  pruneMemoryBuckets(now)
  const existing = memoryBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }
  existing.count += 1
  return { ok: true, retryAfterSec: 0 }
}

function resolveMode(key: string, mode?: RateLimitMode): RateLimitMode {
  if (mode) return mode
  return isStrictRateLimitKey(key) ? "strict" : "standard"
}

/**
 * Consume one request from a shared rate-limit bucket.
 * Postgres path is atomic (INSERT … ON CONFLICT … RETURNING).
 * Strict mode: never allow unlimited traffic when the store is down.
 */
export async function consumeRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
  mode?: RateLimitMode
): Promise<RateLimitDecision> {
  const effectiveMode = resolveMode(key, mode)
  const ready = await ensureRateLimitTable()

  // Only gate on ensure() result — do not re-read storeHealthy here or a
  // sibling INSERT failure can push later callers onto per-process memory.
  if (!ready) {
    try {
      const decision = consumeMemory(key, limit, windowMs)
      if (effectiveMode === "strict") {
        console.warn("[rate-limit] strict bucket on bounded memory fallback", {
          keyPrefix: key.split(":")[0],
        })
      }
      return { ...decision, backend: "memory", degraded: true }
    } catch {
      if (effectiveMode === "strict") {
        console.warn("[rate-limit] strict reject — store and memory unavailable")
        return { ok: false, retryAfterSec: 30, backend: "reject", degraded: true }
      }
      return { ok: true, retryAfterSec: 0, backend: "memory", degraded: true }
    }
  }

  try {
    const db = getDb()
    const now = new Date()
    const resetAt = new Date(now.getTime() + windowMs)
    const result: any = await db.execute(sql`
      INSERT INTO rate_limit_buckets (bucket_key, hit_count, reset_at)
      VALUES (${key}, 1, ${resetAt.toISOString()})
      ON CONFLICT (bucket_key) DO UPDATE
      SET
        hit_count = CASE
          WHEN rate_limit_buckets.reset_at <= ${now.toISOString()}::timestamptz THEN 1
          ELSE rate_limit_buckets.hit_count + 1
        END,
        reset_at = CASE
          WHEN rate_limit_buckets.reset_at <= ${now.toISOString()}::timestamptz THEN ${resetAt.toISOString()}::timestamptz
          ELSE rate_limit_buckets.reset_at
        END
      RETURNING hit_count, reset_at
    `)
    const rows = result?.rows || result
    const row = Array.isArray(rows) ? rows[0] : null
    const hitCount = Number(row?.hit_count || 1)
    const rowReset = row?.reset_at ? new Date(row.reset_at).getTime() : now.getTime() + windowMs
    if (hitCount > limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((rowReset - Date.now()) / 1000)),
        backend: "postgres",
      }
    }
    return { ok: true, retryAfterSec: 0, backend: "postgres" }
  } catch (err) {
    // Do not flip the global store flag on a single statement failure —
    // concurrent PGlite/Postgres callers must keep sharing the durable path.
    const message = err instanceof Error ? err.message : "unknown"
    console.warn("[rate-limit] durable consume failed; bounded fallback", {
      reason: message.slice(0, 160),
    })
    try {
      const decision = consumeMemory(key, limit, windowMs)
      return { ...decision, backend: "memory", degraded: true }
    } catch {
      if (effectiveMode === "strict") {
        return { ok: false, retryAfterSec: 30, backend: "reject", degraded: true }
      }
      return { ok: true, retryAfterSec: 0, backend: "memory", degraded: true }
    }
  }
}

/**
 * Sync helper for non-critical paths. Prefer consumeRateLimitAsync in routes.
 * Uses bounded memory only; does not fail-open beyond the configured limit.
 */
export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  return consumeMemory(key, limit, windowMs)
}

export function isGlobalRateLimitExempt(url: string, method: string): boolean {
  if (method === "OPTIONS") return true
  const path = url.split("?")[0]
  if (path === "/health" || path.startsWith("/api/health")) return true
  if (path === "/api/payments/webhook" || path.startsWith("/api/payments/webhook/")) {
    return true
  }
  return false
}

export function clientIp(request: { ip?: string; headers: any }): string {
  const forwarded = request.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0].trim()
  }
  const realIp = request.headers["x-real-ip"]
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim()
  return request.ip || "unknown"
}

/** Delete expired durable buckets (maintenance / tests). */
export async function cleanupExpiredRateLimitBuckets(): Promise<number> {
  const ready = await ensureRateLimitTable()
  if (!ready || !storeHealthy) return 0
  try {
    const db = getDb()
    const result: any = await db.execute(sql`
      DELETE FROM rate_limit_buckets
      WHERE reset_at <= NOW()
      RETURNING bucket_key
    `)
    const rows = result?.rows || result
    return Array.isArray(rows) ? rows.length : 0
  } catch {
    return 0
  }
}

/** Simulate durable store outage (tests). */
export function markRateLimitStoreUnhealthy(): void {
  storeHealthy = false
  lastStoreErrorAt = Date.now()
  tableReady = Promise.resolve(false)
}

/** Test helper */
export function resetRateLimits(): void {
  memoryBuckets.clear()
  storeHealthy = true
  lastStoreErrorAt = 0
  tableReady = null
}
