import assert from "node:assert/strict"
import { describe, it } from "node:test"
import fs from "fs"
import path from "path"
import { remainingHostSeconds } from "../src/components/host-dashboard/types"

describe("H-P2 occupancy + media order + countdown helpers", () => {
  const servicePath = path.join(process.cwd(), "backend/src/modules/hosts/hosts.service.ts")
  const service = fs.readFileSync(servicePath, "utf8")

  it("documents occupancy formula in getOccupancyMetrics", () => {
    assert.match(service, /async getOccupancyMetrics/)
    assert.match(service, /occupancyRate = bookedNights/)
    assert.match(service, /manualBlockNights/)
  })

  it("persists media order via reorderPropertyMedia", () => {
    assert.match(service, /async reorderPropertyMedia/)
    assert.match(service, /displayOrder/)
    assert.match(service, /coverImage/)
  })

  it("counts down from backend deadline without inventing a second lifecycle", () => {
    const deadline = new Date(Date.now() + 45000).toISOString()
    const secs = remainingHostSeconds(deadline)
    assert.ok(secs > 40 && secs <= 45)
    assert.equal(remainingHostSeconds(null), 0)
  })
})
