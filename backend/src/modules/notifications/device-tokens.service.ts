import crypto from "crypto"
import { and, eq, isNull } from "drizzle-orm"
import { getDb, schema } from "../../db/client"

export const deviceTokensService = {
  async register(params: {
    userId: string
    token: string
    platform: "ios" | "android" | "web"
    provider?: "fcm" | "web_push"
    appVersion?: string
    userAgent?: string
  }) {
    const db = getDb()
    const token = params.token.trim()
    if (!token) throw new Error("Device token is required")

    const [existing] = await db
      .select()
      .from(schema.deviceTokens)
      .where(eq(schema.deviceTokens.token, token))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(schema.deviceTokens)
        .set({
          userId: params.userId,
          platform: params.platform,
          provider: params.provider || existing.provider,
          appVersion: params.appVersion || existing.appVersion,
          userAgent: params.userAgent || existing.userAgent,
          lastSeenAt: new Date(),
          revokedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.deviceTokens.id, existing.id))
        .returning()
      return updated
    }

    const [inserted] = await db
      .insert(schema.deviceTokens)
      .values({
        id: `dtoken_${crypto.randomUUID()}`,
        userId: params.userId,
        token,
        platform: params.platform,
        provider: params.provider || (params.platform === "web" ? "web_push" : "fcm"),
        appVersion: params.appVersion || null,
        userAgent: params.userAgent || null,
      })
      .returning()
    return inserted
  },

  async revoke(userId: string, token: string) {
    const db = getDb()
    await db
      .update(schema.deviceTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.deviceTokens.userId, userId),
          eq(schema.deviceTokens.token, token.trim())
        )
      )
    return { success: true }
  },

  async listActiveForUser(userId: string) {
    const db = getDb()
    return db
      .select()
      .from(schema.deviceTokens)
      .where(
        and(eq(schema.deviceTokens.userId, userId), isNull(schema.deviceTokens.revokedAt))
      )
  },
}
