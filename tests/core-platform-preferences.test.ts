import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  CRITICAL_NOTIFICATION_CATEGORIES,
  isCriticalCategory,
} from "../backend/src/modules/notifications/preferences.service"

describe("Notification preferences rules", () => {
  it("locks critical security categories", () => {
    for (const category of CRITICAL_NOTIFICATION_CATEGORIES) {
      assert.equal(isCriticalCategory(category), true)
    }
    assert.equal(isCriticalCategory("booking"), false)
    assert.equal(isCriticalCategory("marketing"), false)
  })
})
