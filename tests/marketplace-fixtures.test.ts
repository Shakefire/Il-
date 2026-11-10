import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isMarketplaceFixtureHostEmail,
  MARKETPLACE_FIXTURE_EMAIL_DOMAIN,
} from "../backend/src/lib/marketplace-fixtures"

describe("marketplace fixture host filter", () => {
  it("recognizes @test.ile.ng automation hosts", () => {
    assert.equal(
      isMarketplaceFixtureHostEmail(`host_p9_123${MARKETPLACE_FIXTURE_EMAIL_DOMAIN}`),
      true
    )
    assert.equal(isMarketplaceFixtureHostEmail("host@ile.test"), true)
  })

  it("keeps real host emails on the marketplace", () => {
    assert.equal(isMarketplaceFixtureHostEmail("ada@ilestays.ng"), false)
    assert.equal(isMarketplaceFixtureHostEmail("host@example.com"), false)
    assert.equal(isMarketplaceFixtureHostEmail(null), false)
  })
})
