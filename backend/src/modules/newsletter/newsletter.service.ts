import { eq } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import crypto from "crypto";

export const newsletterService = {
  async subscribe(email: string): Promise<{ status: "subscribed" | "already_subscribed" | "reactivated" }> {
    const db = getDb();
    const normalized = email.trim().toLowerCase();

    const existing = await db
      .select()
      .from(schema.newsletterSubscribers)
      .where(eq(schema.newsletterSubscribers.email, normalized))
      .limit(1);

    if (existing.length > 0) {
      const sub = existing[0];
      if (sub.status === "active") {
        return { status: "already_subscribed" };
      }
      // Reactivate unsubscribed
      await db
        .update(schema.newsletterSubscribers)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(schema.newsletterSubscribers.email, normalized));
      return { status: "reactivated" };
    }

    await db.insert(schema.newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email: normalized,
      status: "active",
      subscribedAt: new Date(),
      updatedAt: new Date(),
    });

    return { status: "subscribed" };
  },

  async getSubscribers(page = 1, limit = 50) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(schema.newsletterSubscribers)
      .orderBy(schema.newsletterSubscribers.subscribedAt)
      .limit(limit)
      .offset(offset);

    return items;
  },

  async unsubscribe(email: string): Promise<boolean> {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    await db
      .update(schema.newsletterSubscribers)
      .set({ status: "unsubscribed", updatedAt: new Date() })
      .where(eq(schema.newsletterSubscribers.email, normalized));
    return true;
  },
};
