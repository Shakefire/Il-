import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

describe("Phone OTP hardening", () => {
  it("auth service no longer accepts hardcoded 123456 bypass", () => {
    const file = path.join(
      process.cwd(),
      "backend/src/modules/auth/auth.service.ts"
    )
    const source = readFileSync(file, "utf8")
    assert.equal(source.includes('trimmedCode === "123456"'), false)
    assert.equal(source.includes("allowDevBypass"), false)
    assert.ok(source.includes("phoneVerificationSentAt"))
    assert.ok(source.includes("phoneVerificationAttempts"))
  })

  it("migration 0005 adds phone OTP cooldown columns and preferences", () => {
    const file = path.join(
      process.cwd(),
      "backend/src/db/migrations/0005_notification_prefs_phone_otp.sql"
    )
    const sql = readFileSync(file, "utf8")
    assert.ok(sql.includes("phone_verification_sent_at"))
    assert.ok(sql.includes("notification_preferences"))
  })
})
