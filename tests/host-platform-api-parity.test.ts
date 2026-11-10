import assert from "node:assert/strict"
import { describe, it } from "node:test"
import fs from "fs"
import path from "path"

describe("H-P1-3 Fastify host API parity", () => {
  const routesPath = path.join(process.cwd(), "backend/src/modules/hosts/hosts.routes.ts")
  const servicePath = path.join(process.cwd(), "backend/src/modules/hosts/hosts.service.ts")
  const routes = fs.readFileSync(routesPath, "utf8")
  const service = fs.readFileSync(servicePath, "utf8")

  it("registers Fastify unpublish + payout-account + media-order", () => {
    assert.match(routes, /\/properties\/:id\/unpublish/)
    assert.match(routes, /fastify\.get\("\/payout-account"/)
    assert.match(routes, /fastify\.put\("\/payout-account"/)
    assert.match(routes, /\/properties\/:id\/media-order/)
  })

  it("uses canonical hostsService methods (no duplicated bank logic in routes)", () => {
    assert.match(routes, /hostsService\.unpublishProperty/)
    assert.match(routes, /hostsService\.getPayoutAccount/)
    assert.match(routes, /hostsService\.updatePayoutAccount/)
    assert.match(routes, /hostsService\.reorderPropertyMedia/)
    assert.match(service, /async unpublishProperty/)
    assert.match(service, /async getPayoutAccount/)
    assert.match(service, /async updatePayoutAccount/)
    assert.match(service, /async reorderPropertyMedia/)
    assert.match(service, /BankResolutionService\.updateHostPayoutAccount/)
  })

  it("deleteProperty soft-archives and never deletes bookings", () => {
    assert.match(service, /PROPERTY_ARCHIVED/)
    assert.match(service, /hasHistory/)
    assert.doesNotMatch(
      service,
      /await db\.delete\(schema\.bookings\)\.where\(eq\(schema\.bookings\.propertyId/
    )
  })
})
