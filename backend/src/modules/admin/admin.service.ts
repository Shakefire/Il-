import { eq, sql, desc, count } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { parsePagination, paginatedResponse, PaginationParams } from "../../lib/pagination";
import crypto from "crypto";

export const adminService = {
  async getStats() {
    const db = getDb();

    const [totalUsers] = await db.select({ total: count(schema.users.id) }).from(schema.users);
    const [totalProperties] = await db.select({ total: count(schema.properties.id) }).from(schema.properties);
    const [totalBookings] = await db.select({ total: count(schema.bookings.id) }).from(schema.bookings);

    // CRITICAL FIX: Query payments with status 'VERIFIED' (not 'SUCCESSFUL')
    const revenueResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amount}), 0)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "VERIFIED"));

    const totalRevenue = Number(revenueResult[0]?.total) || 0;

    return {
      users: Number(totalUsers?.total) || 0,
      properties: Number(totalProperties?.total) || 0,
      bookings: Number(totalBookings?.total) || 0,
      revenue: totalRevenue,
    };
  },

  async getProperties(pagination: PaginationParams) {
    const db = getDb();

    const [totalResult] = await db.select({ total: count(schema.properties.id) }).from(schema.properties);
    const total = Number(totalResult?.total) || 0;

    const items = await db
      .select()
      .from(schema.properties)
      .orderBy(desc(schema.properties.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    // Fetch host names
    const enriched = await Promise.all(
      items.map(async (prop: any) => {
        const [host] = await db
          .select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(eq(schema.users.id, prop.hostId))
          .limit(1);

        return {
          ...prop,
          hostName: host ? `${host.firstName} ${host.lastName}` : "Unknown",
        };
      })
    );

    return paginatedResponse(enriched, total, pagination);
  },

  async updatePropertyStatus(
    id: string,
    status: "PUBLISHED" | "REJECTED" | "SUSPENDED",
    reason: string | null,
    adminId: string,
    ipAddress?: string
  ) {
    const db = getDb();

    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, id))
      .limit(1);

    if (!property) {
      throw new Error("Property not found");
    }

    const updateData: any = { status, updatedAt: new Date() };
    if (reason && status === "REJECTED") {
      updateData.rejectionReason = reason;
    }

    const [updated] = await db
      .update(schema.properties)
      .set(updateData)
      .where(eq(schema.properties.id, id))
      .returning();

    // Insert audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: `PROPERTY_${status}`,
      entityType: "property",
      entityId: id,
      details: reason || `Property status changed to ${status}`,
      ipAddress: ipAddress || null,
    });

    // Notify host via Resend
    if (status === "PUBLISHED" || status === "REJECTED") {
      import("../notifications/notifications.service").then(async ({ sendEmail, propertyReviewStatusEmail }) => {
        const [host] = await db
          .select({ email: schema.users.email, firstName: schema.users.firstName })
          .from(schema.users)
          .where(eq(schema.users.id, property.hostId))
          .limit(1);

        if (host) {
          sendEmail(
            propertyReviewStatusEmail({
              hostName: host.firstName,
              hostEmail: host.email,
              propertyTitle: property.title,
              status: status === "PUBLISHED" ? "APPROVED" : "REJECTED",
              reason: reason || undefined,
            })
          ).catch((e) => console.warn("[Admin] Failed to send moderation status email:", e));
        }
      });
    }

    return updated;
  },

  async getBookings(pagination: PaginationParams) {
    const db = getDb();

    const [totalResult] = await db.select({ total: count(schema.bookings.id) }).from(schema.bookings);
    const total = Number(totalResult?.total) || 0;

    const items = await db
      .select()
      .from(schema.bookings)
      .orderBy(desc(schema.bookings.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    // Enrich with property title
    const enriched = await Promise.all(
      items.map(async (b: any) => {
        const [property] = await db
          .select({ title: schema.properties.title, city: schema.properties.city })
          .from(schema.properties)
          .where(eq(schema.properties.id, b.propertyId))
          .limit(1);

        return { ...b, property: property || null };
      })
    );

    return paginatedResponse(enriched, total, pagination);
  },

  async getAuditLogs(pagination: PaginationParams) {
    const db = getDb();

    const [totalResult] = await db.select({ total: count(schema.auditLogs.id) }).from(schema.auditLogs);
    const total = Number(totalResult?.total) || 0;

    const items = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return paginatedResponse(items, total, pagination);
  },
};
