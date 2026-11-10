import crypto from "crypto"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { getDb, schema } from "../../db/client"

export type InboxCreateInput = {
  userId: string
  eventType: string
  title: string
  body: string
  entityType?: string
  entityId?: string | null
  deepLink?: string | null
  idempotencyKey: string
}

export const inboxService = {
  async upsertInboxItem(input: InboxCreateInput) {
    const db = getDb()
    try {
      const [existing] = await db
        .select()
        .from(schema.notificationInbox)
        .where(eq(schema.notificationInbox.idempotencyKey, input.idempotencyKey))
        .limit(1)
      if (existing) return { item: existing, created: false }

      const [inserted] = await db
        .insert(schema.notificationInbox)
        .values({
          id: `ninbox_${crypto.randomUUID()}`,
          userId: input.userId,
          eventType: input.eventType,
          title: input.title,
          body: input.body,
          entityType: input.entityType || "booking",
          entityId: input.entityId || null,
          deepLink: input.deepLink || null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning()
      return { item: inserted, created: true }
    } catch (err: any) {
      // Unique race
      if (err?.code === "23505") {
        const [existing] = await db
          .select()
          .from(schema.notificationInbox)
          .where(eq(schema.notificationInbox.idempotencyKey, input.idempotencyKey))
          .limit(1)
        return { item: existing, created: false }
      }
      throw err
    }
  },

  async listForUser(userId: string, opts?: { limit?: number; unreadOnly?: boolean }) {
    const db = getDb()
    const limit = Math.min(Math.max(opts?.limit || 30, 1), 100)
    const conditions = [eq(schema.notificationInbox.userId, userId)]
    if (opts?.unreadOnly) {
      conditions.push(isNull(schema.notificationInbox.readAt))
    }
    const items = await db
      .select()
      .from(schema.notificationInbox)
      .where(and(...conditions))
      .orderBy(desc(schema.notificationInbox.createdAt))
      .limit(limit)

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.notificationInbox)
      .where(
        and(
          eq(schema.notificationInbox.userId, userId),
          isNull(schema.notificationInbox.readAt)
        )
      )

    return { items, unreadCount: countRow?.count || 0 }
  },

  async markRead(userId: string, notificationId: string) {
    const db = getDb()
    const [updated] = await db
      .update(schema.notificationInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notificationInbox.id, notificationId),
          eq(schema.notificationInbox.userId, userId)
        )
      )
      .returning()
    return updated || null
  },

  async markAllRead(userId: string) {
    const db = getDb()
    await db
      .update(schema.notificationInbox)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notificationInbox.userId, userId),
          isNull(schema.notificationInbox.readAt)
        )
      )
    return { success: true }
  },
}
