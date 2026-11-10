import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { join } from "node:path"

const root = process.cwd()

describe("Flutter host API parity", () => {
  it("registers Fastify GET /api/banks for mobile bank picker", () => {
    const app = readFileSync(join(root, "backend/src/app.ts"), "utf8")
    assert.match(app, /fastify\.get\("\/api\/banks"/)
    const payments = readFileSync(
      join(root, "backend/src/modules/payments/payments.routes.ts"),
      "utf8"
    )
    assert.match(payments, /fastify\.get\("\/banks"/)
    assert.match(payments, /BankResolutionService\.getNigerianBanks/)
  })

  it("exposes guestCheckInConfirmedAt on host bookings enrichment", () => {
    const service = readFileSync(
      join(root, "backend/src/modules/hosts/hosts.service.ts"),
      "utf8"
    )
    assert.match(service, /guestCheckInConfirmedAt:\s*schema\.bookings\.guestCheckInConfirmedAt/)
    assert.match(service, /guestCheckInConfirmed:\s*!!b\.guestCheckInConfirmedAt/)
  })

  it("keeps unpublish, payout-account, media-order, relist on Fastify hosts routes", () => {
    const routes = readFileSync(
      join(root, "backend/src/modules/hosts/hosts.routes.ts"),
      "utf8"
    )
    assert.match(routes, /\/properties\/:id\/unpublish/)
    assert.match(routes, /\/payout-account/)
    assert.match(routes, /\/media-order/)
    assert.match(routes, /\/properties\/:id\/relist/)
    assert.match(routes, /\/onboarding\/submit/)
  })
})
