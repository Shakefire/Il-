import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { LoginSchema, RegisterSchema } from "../backend/src/modules/auth/auth.service"

describe("Core platform auth schemas", () => {
  it("rejects short passwords on register", () => {
    const parsed = RegisterSchema.safeParse({
      firstName: "Ada",
      lastName: "Okafor",
      email: "ada@example.com",
      password: "short",
    })
    assert.equal(parsed.success, false)
  })

  it("accepts valid guest registration payload", () => {
    const parsed = RegisterSchema.safeParse({
      firstName: "Ada",
      lastName: "Okafor",
      email: "ada@example.com",
      password: "Password1",
      phone: "08031234567",
    })
    assert.equal(parsed.success, true)
  })

  it("requires email + password on login", () => {
    const bad = LoginSchema.safeParse({ email: "not-an-email", password: "" })
    assert.equal(bad.success, false)
    const ok = LoginSchema.safeParse({
      email: "ada@example.com",
      password: "Password1",
    })
    assert.equal(ok.success, true)
  })
})
