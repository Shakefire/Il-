import { eq, and, sql, desc, count } from "drizzle-orm";
import { getDb, schema } from "../../db/client";
import { parsePagination, paginatedResponse, PaginationParams } from "../../lib/pagination";
import crypto from "crypto";

export const adminService = {
  async getStats() {
    const db = getDb();

    const [totalUsers] = await db.select({ total: count(schema.users.id) }).from(schema.users);
    const [totalProperties] = await db.select({ total: count(schema.properties.id) }).from(schema.properties);
    const [totalBookings] = await db.select({ total: count(schema.bookings.id) }).from(schema.bookings);
    const [pendingHosts] = await db
      .select({ total: count(schema.profiles.id) })
      .from(schema.profiles)
      .where(eq(schema.profiles.verificationStatus, "UNDER_REVIEW"));

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
      pendingHosts: Number(pendingHosts?.total) || 0,
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

    // Fetch host names and private details
    const enriched = await Promise.all(
      items.map(async (prop: any) => {
        const [host] = await db
          .select({
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            email: schema.users.email,
            phone: schema.users.phone,
          })
          .from(schema.users)
          .where(eq(schema.users.id, prop.hostId))
          .limit(1);

        const [privateDetails] = await db
          .select()
          .from(schema.propertyPrivateDetails)
          .where(eq(schema.propertyPrivateDetails.propertyId, prop.id))
          .limit(1);

        return {
          ...prop,
          hostName: host ? `${host.firstName} ${host.lastName}` : "Host",
          hostEmail: host?.email || "",
          hostPhone: host?.phone || "",
          privateDetails: privateDetails || null,
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

    // Enrich with property, private details, host, and payment
    const enriched = await Promise.all(
      items.map(async (b: any) => {
        const [property] = await db
          .select({
            id: schema.properties.id,
            title: schema.properties.title,
            slug: schema.properties.slug,
            city: schema.properties.city,
            neighborhood: schema.properties.neighborhood,
            state: schema.properties.state,
            propertyType: schema.properties.propertyType,
            coverImage: schema.properties.coverImage,
            hostId: schema.properties.hostId,
          })
          .from(schema.properties)
          .where(eq(schema.properties.id, b.propertyId))
          .limit(1);

        const [privateDetails] = await db
          .select()
          .from(schema.propertyPrivateDetails)
          .where(eq(schema.propertyPrivateDetails.propertyId, b.propertyId))
          .limit(1);

        const [payment] = await db
          .select()
          .from(schema.payments)
          .where(eq(schema.payments.bookingId, b.id))
          .limit(1);

        const guestFullName = `${b.guestFirstName || ""} ${b.guestLastName || ""}`.trim() || "Guest";

        return {
          ...b,
          // Normalised helpers for UI components
          reference: b.referenceCode,
          ticketCode: b.referenceCode,
          guestName: guestFullName,
          checkIn: b.checkInDate,
          checkOut: b.checkOutDate,
          nights: b.numberOfNights,
          totalPrice: b.totalAmount,
          propertyTitle: property?.title || "Property",
          propertyCity: property?.city || "",
          property: property || null,
          contactDetails: privateDetails
            ? {
                exactAddress: privateDetails.exactAddress,
                unitNumber: privateDetails.unitNumber,
                contactName: privateDetails.contactName,
                contactPhone: privateDetails.contactPhone,
                contactEmail: privateDetails.contactEmail,
                accessGateCode: privateDetails.accessGateCode,
                checkInInstructions: privateDetails.checkInInstructions,
              }
            : null,
          payment: payment
            ? {
                id: payment.id,
                reference: payment.reference,
                amount: payment.amount,
                status: payment.status,
                paymentMethod: payment.method || payment.gatewayProvider || "Paystack Direct",
                paidAt: payment.paidAt || payment.createdAt,
              }
            : null,
        };
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

  async getHostApplications(statusFilter?: string, pagination?: PaginationParams) {
    const db = getDb();
    const pag = pagination || { limit: 50, offset: 0, page: 1 };

    let whereClause: any = eq(schema.users.role, "host");
    if (statusFilter && statusFilter !== "ALL") {
      whereClause = and(eq(schema.users.role, "host"), eq(schema.profiles.verificationStatus, statusFilter));
    }

    const [totalResult] = await db
      .select({ total: count(schema.users.id) })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(whereClause);

    const total = Number(totalResult?.total) || 0;

    const rows = await db
      .select({
        user: {
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          phone: schema.users.phone,
          role: schema.users.role,
          emailVerified: schema.users.emailVerified,
          phoneVerified: schema.users.phoneVerified,
          createdAt: schema.users.createdAt,
        },
        profile: schema.profiles,
      })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.profiles.updatedAt))
      .limit(pag.limit)
      .offset(pag.offset);

    const formatted = rows.map((r) => ({
      ...r.user,
      profile: r.profile,
    }));

    return paginatedResponse(formatted, total, pag);
  },

  async getHostApplication(hostId: string) {
    const db = getDb();

    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        role: schema.users.role,
        emailVerified: schema.users.emailVerified,
        phoneVerified: schema.users.phoneVerified,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, hostId))
      .limit(1);

    if (!user) throw new Error("Host user not found");

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, hostId))
      .limit(1);

    const logs = await db
      .select()
      .from(schema.verificationLogs)
      .where(eq(schema.verificationLogs.hostId, hostId))
      .orderBy(desc(schema.verificationLogs.createdAt));

    const properties = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId));

    return {
      host: user,
      profile: profile || null,
      verificationLogs: logs,
      properties,
    };
  },

  async approveHostApplication(hostId: string, adminId: string, ipAddress?: string) {
    const db = getDb();

    const [host] = await db.select().from(schema.users).where(eq(schema.users.id, hostId)).limit(1);
    if (!host) throw new Error("Host user not found");

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        isVerified: true,
        verificationStatus: "APPROVED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewFeedback: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId))
      .returning();

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId,
      previousStatus: prevStatus,
      newStatus: "APPROVED",
      action: "APPROVE",
      notes: "Host KYC, identity, and ownership documents reviewed and approved by platform admin.",
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "HOST_APPROVED",
      entityType: "host",
      entityId: hostId,
      details: `Host ${host.firstName} ${host.lastName} (${host.email}) verified and approved.`,
      ipAddress: ipAddress || null,
    });

    // Send congratulatory approval email
    import("../notifications/notifications.service").then(({ sendEmail, hostApplicationApprovedEmail }) => {
      sendEmail(
        hostApplicationApprovedEmail({
          hostName: host.firstName,
          hostEmail: host.email,
        })
      ).catch((e) => console.warn("[Admin] Failed to send host approval email:", e));
    });

    return {
      success: true,
      message: `Host ${host.firstName} ${host.lastName} has been verified and approved.`,
      profile: updatedProfile,
    };
  },

  async rejectHostApplication(hostId: string, reason: string, adminId: string, ipAddress?: string) {
    const db = getDb();

    const [host] = await db.select().from(schema.users).where(eq(schema.users.id, hostId)).limit(1);
    if (!host) throw new Error("Host user not found");

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        isVerified: false,
        verificationStatus: "REJECTED",
        reviewFeedback: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId))
      .returning();

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId,
      previousStatus: prevStatus,
      newStatus: "REJECTED",
      action: "REJECT",
      reason,
      notes: `Rejected by admin. Reason: ${reason}`,
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "HOST_REJECTED",
      entityType: "host",
      entityId: hostId,
      details: `Host ${host.firstName} ${host.lastName} rejected. Reason: ${reason}`,
      ipAddress: ipAddress || null,
    });

    // Send rejection email
    import("../notifications/notifications.service").then(({ sendEmail, hostApplicationRejectedEmail }) => {
      sendEmail(
        hostApplicationRejectedEmail({
          hostName: host.firstName,
          hostEmail: host.email,
          reason,
        })
      ).catch((e) => console.warn("[Admin] Failed to send host rejection email:", e));
    });

    return {
      success: true,
      message: `Host application marked as rejected.`,
      profile: updatedProfile,
    };
  },

  async requestHostInfo(hostId: string, instructions: string, adminId: string, ipAddress?: string) {
    const db = getDb();

    const [host] = await db.select().from(schema.users).where(eq(schema.users.id, hostId)).limit(1);
    if (!host) throw new Error("Host user not found");

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        verificationStatus: "ACTION_REQUIRED",
        reviewFeedback: instructions,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId))
      .returning();

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId,
      previousStatus: prevStatus,
      newStatus: "ACTION_REQUIRED",
      action: "REQUEST_INFO",
      notes: instructions,
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "HOST_INFO_REQUESTED",
      entityType: "host",
      entityId: hostId,
      details: `Additional information requested from host ${host.email}: ${instructions}`,
      ipAddress: ipAddress || null,
    });

    // Send instruction email
    import("../notifications/notifications.service").then(({ sendEmail, hostApplicationInfoRequestedEmail }) => {
      sendEmail(
        hostApplicationInfoRequestedEmail({
          hostName: host.firstName,
          hostEmail: host.email,
          instructions,
        })
      ).catch((e) => console.warn("[Admin] Failed to send info request email:", e));
    });

    return {
      success: true,
      message: `Host has been notified with instructions to update their documents.`,
      profile: updatedProfile,
    };
  },

  async suspendHostApplication(hostId: string, reason: string, adminId: string, ipAddress?: string) {
    const db = getDb();

    const [host] = await db.select().from(schema.users).where(eq(schema.users.id, hostId)).limit(1);
    if (!host) throw new Error("Host user not found");

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    // 1. Update user profile to SUSPENDED & isVerified to false
    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        isVerified: false,
        verificationStatus: "SUSPENDED",
        reviewFeedback: reason || "Account suspended by platform administration.",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId))
      .returning();

    // 2. Mark user status as SUSPENDED
    await db
      .update(schema.users)
      .set({
        status: "SUSPENDED",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, hostId));

    // 3. Suspend all active/published properties for this host
    await db
      .update(schema.properties)
      .set({
        status: "SUSPENDED",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.hostId, hostId));

    // 4. Record in verification logs
    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId,
      previousStatus: prevStatus,
      newStatus: "SUSPENDED",
      action: "SUSPEND",
      reason: reason || "Administrative suspension",
      notes: `Suspended by admin. Reason: ${reason || "Account suspended."}`,
    });

    // 5. Record in audit logs
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "HOST_SUSPENDED",
      entityType: "host",
      entityId: hostId,
      details: `Host ${host.firstName} ${host.lastName} (${host.email}) suspended. Reason: ${reason || "Violation of platform policies"}`,
      ipAddress: ipAddress || null,
    });

    return {
      success: true,
      message: `Host account and all associated listings have been suspended.`,
      profile: updatedProfile,
    };
  },
};
