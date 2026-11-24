/**
 * Production mock-mode safety.
 * - PAYSTACK_MOCK_TRANSFERS / MOCK_DEV paths must not be allowed in production.
 * - Empty marketplace/API surfaces must not resurrect static demo PROPERTIES.
 * - Fixture host filter remains in force for public listings.
 *
 * NODE_ENV is set before dynamic imports so ESM hoist cannot load env as production.
 */

import { describe, it, before } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "..")

const read = (rel: string): string =>
  fs.readFileSync(path.join(root, rel), "utf8")

describe("production mock-mode safety", () => {
  let canUsePaystackDevMocks: () => boolean
  let isPaystackMockTransfersEnabled: () => boolean
  let paystackNotConfiguredError: () => string
  let isMarketplaceFixtureHostEmail: (email: string | null | undefined) => boolean
  let MARKETPLACE_FIXTURE_EMAIL_DOMAIN: string
  let PROPERTIES: Array<{ slug: string }>

  before(async () => {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = "test"
    process.env.PAYSTACK_MOCK_TRANSFERS = "true"
    const mocks = await import("../backend/src/lib/payment-mocks")
    const fixtures = await import("../backend/src/lib/marketplace-fixtures")
    const props = await import("../src/data/properties")
    canUsePaystackDevMocks = mocks.canUsePaystackDevMocks
    isPaystackMockTransfersEnabled = mocks.isPaystackMockTransfersEnabled
    paystackNotConfiguredError = mocks.paystackNotConfiguredError
    isMarketplaceFixtureHostEmail = fixtures.isMarketplaceFixtureHostEmail
    MARKETPLACE_FIXTURE_EMAIL_DOMAIN = fixtures.MARKETPLACE_FIXTURE_EMAIL_DOMAIN
    PROPERTIES = props.PROPERTIES
  })

  it("exposes a fail-closed error for unconfigured Paystack", () => {
    assert.match(paystackNotConfiguredError(), /PAYSTACK_SECRET_KEY/)
  })

  it("allows payment mocks under NODE_ENV=test", () => {
    assert.equal(process.env.NODE_ENV, "test")
    assert.equal(canUsePaystackDevMocks(), true)
    assert.equal(isPaystackMockTransfersEnabled(), true)
  })

  it("env validation forces PAYSTACK_MOCK_TRANSFERS off in production (source contract)", () => {
    const envSrc = read("backend/src/config/env.ts")
    assert.match(envSrc, /PAYSTACK_MOCK_TRANSFERS was set under NODE_ENV=production/)
    assert.match(envSrc, /forcing OFF/)
    assert.match(envSrc, /fail closed \(no MOCK_DEV\)/)
  })

  it("payment init/verify fail closed when mocks are disallowed (source contract)", () => {
    const payments = read("backend/src/modules/payments/payments.service.ts")
    assert.match(payments, /canUsePaystackDevMocks/)
    assert.match(payments, /paystackNotConfiguredError/)
    assert.ok(
      payments.includes('gatewayProvider: "MOCK_DEV"'),
      "dev mock path may remain for non-prod"
    )
    assert.match(payments, /if \(!canUsePaystackDevMocks\(\)\)/)
  })

  it("transfer service never mocks when canUsePaystackDevMocks is false", () => {
    const transfers = read("backend/src/modules/payments/paystack-transfer.service.ts")
    assert.match(transfers, /canUsePaystackDevMocks/)
    assert.match(transfers, /paystackNotConfiguredError/)
    assert.ok(!transfers.includes('process.env.PAYSTACK_MOCK_TRANSFERS === "true"'))
  })

  it("keeps marketplace fixture hosts out of public catalog filters", () => {
    assert.equal(
      isMarketplaceFixtureHostEmail(`host_p9_1${MARKETPLACE_FIXTURE_EMAIL_DOMAIN}`),
      true
    )
    const propsSql = read("backend/src/modules/properties/properties.service.ts")
    const searchSql = read("backend/src/modules/search/search.service.ts")
    assert.match(propsSql, /excludeMarketplaceFixtureHosts/)
    assert.match(searchSql, /excludeMarketplaceFixtureHosts/)
  })

  it("empty API / marketplace pages do not import static PROPERTIES demo catalog", () => {
    const demoSlugs = PROPERTIES.slice(0, 5).map((p) => p.slug)
    assert.ok(demoSlugs.length > 0)

    const forbiddenImporters = [
      "src/app/search/page.tsx",
      "src/app/page.tsx",
      "src/app/stay",
      "src/app/api/properties",
      "src/app/api/search",
    ]

    for (const rel of forbiddenImporters) {
      const full = path.join(root, rel)
      if (!fs.existsSync(full)) continue
      const walk = (p: string): string[] => {
        const st = fs.statSync(p)
        if (st.isFile()) return [p]
        return fs.readdirSync(p).flatMap((name) => walk(path.join(p, name)))
      }
      for (const file of walk(full)) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
        const src = fs.readFileSync(file, "utf8")
        assert.ok(
          !src.includes("import { PROPERTIES") && !src.includes("import {PROPERTIES"),
          `${path.relative(root, file)} must not import PROPERTIES demo catalog`
        )
        if (file.replace(/\\/g, "/").endsWith("src/app/page.tsx")) {
          assert.match(src, /DESTINATIONS/)
        }
      }
    }

    const seed = read("backend/src/db/seed.ts")
    assert.match(seed, /PROPERTIES/)
  })

  it("health test-email debug route is production-gated", () => {
    const health = read("backend/src/modules/health/health.routes.ts")
    assert.match(health, /NODE_ENV === "production"/)
    assert.match(health, /Not found/)
  })
})
