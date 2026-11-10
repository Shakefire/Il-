import crypto from "crypto"
import { and, eq } from "drizzle-orm"
import { getDb } from "../../db/client"
import * as schema from "../../db/schema"

/** Categories that must always deliver (security / account integrity). */
export const CRITICAL_NOTIFICATION_CATEGORIES = [
  "security",
  "auth",
  "password_reset",
  "email_otp",
  "phone_otp",
] as const

export type NotificationCategory =
  | (typeof CRITICAL_NOTIFICATION_CATEGORIES)[number]
  | "booking"
  | "payment"
  | "payout"
  | "marketing"
  | "product"

export type ChannelFlags = {
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  inboxEnabled: boolean
}

const DEFAULT_FLAGS: ChannelFlags = {
  emailEnabled: true,
  smsEnabled: true,
  pushEnabled: true,
  inboxEnabled: true,
}

export const isCriticalCategory = (category: string): boolean =>
  (CRITICAL_NOTIFICATION_CATEGORIES as readonly string[]).includes(category)

export const preferencesService = {
  async listForUser(userId: string) {
    const db = getDb()
    const rows = await db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId))

    const byCategory: Record<string, ChannelFlags & { category: string; locked: boolean }> = {}
    for (const row of rows) {
      byCategory[row.category] = {
        category: row.category,
        emailEnabled: row.emailEnabled,
        smsEnabled: row.smsEnabled,
        pushEnabled: row.pushEnabled,
        inboxEnabled: row.inboxEnabled,
        locked: isCriticalCategory(row.category),
      }
    }

    // Surface locked defaults even when no row exists yet.
    for (const category of CRITICAL_NOTIFICATION_CATEGORIES) {
      if (!byCategory[category]) {
        byCategory[category] = {
          category,
          ...DEFAULT_FLAGS,
          locked: true,
        }
      } else {
        byCategory[category] = {
          ...byCategory[category],
          ...DEFAULT_FLAGS,
          locked: true,
        }
      }
    }

    return Object.values(byCategory)
  },

  async upsertPreference(
    userId: string,
    category: string,
    patch: Partial<ChannelFlags>
  ) {
    if (isCriticalCategory(category)) {
      throw new Error(
        "Critical security notifications cannot be disabled."
      )
    }

    const db = getDb()
    const [existing] = await db
      .select()
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.userId, userId),
          eq(schema.notificationPreferences.category, category)
        )
      )
      .limit(1)

    const next: ChannelFlags = {
      emailEnabled: patch.emailEnabled ?? existing?.emailEnabled ?? true,
      smsEnabled: patch.smsEnabled ?? existing?.smsEnabled ?? true,
      pushEnabled: patch.pushEnabled ?? existing?.pushEnabled ?? true,
      inboxEnabled: patch.inboxEnabled ?? existing?.inboxEnabled ?? true,
    }

    if (existing) {
      const [updated] = await db
        .update(schema.notificationPreferences)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(schema.notificationPreferences.id, existing.id))
        .returning()
      return { ...updated, locked: false }
    }

    const [inserted] = await db
      .insert(schema.notificationPreferences)
      .values({
        id: `npref_${crypto.randomUUID()}`,
        userId,
        category,
        ...next,
      })
      .returning()
    return { ...inserted, locked: false }
  },

  /**
   * Returns whether a channel is allowed for this user/category.
   * Critical categories always allow all channels.
   */
  async isChannelEnabled(
    userId: string | null | undefined,
    category: string,
    channel: keyof ChannelFlags
  ): Promise<boolean> {
    if (!userId) return true
    if (isCriticalCategory(category)) return true

    const db = getDb()
    const [row] = await db
      .select()
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.userId, userId),
          eq(schema.notificationPreferences.category, category)
        )
      )
      .limit(1)

    if (!row) return true
    return Boolean(row[channel])
  },
}
