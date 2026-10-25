import { eq, and, sql, desc, count, inArray } from "drizzle-orm";
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

    // Query payments with status 'SUCCESS' (matches payments.service.ts)
    const revenueResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.payments.amount}), 0)` })
      .from(schema.payments)
      .where(eq(schema.payments.status, "SUCCESS"));

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

    const updateData: any = { status, updatedAt: new Date(), moderatedAt: new Date(), moderatedBy: adminId };
    if (status === "SUSPENDED") {
      updateData.moderationStatus = "SUSPENDED";
      updateData.moderationReason = reason || "Listing suspended by platform administrator.";
    } else if (status === "REJECTED") {
      updateData.moderationStatus = "REJECTED";
      updateData.moderationReason = reason || "Listing rejected during moderation.";
      if (reason) updateData.rejectionReason = reason;
    } else if (status === "PUBLISHED") {
      updateData.moderationStatus = "NONE";
      updateData.moderationReason = null;
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
    if (status === "SUSPENDED") {
      import("../notifications/notifications.service").then(async ({ sendEmail, listingSuspendedEmail }) => {
        const [host] = await db
          .select({ email: schema.users.email, firstName: schema.users.firstName })
          .from(schema.users)
          .where(eq(schema.users.id, property.hostId))
          .limit(1);

        if (host) {
          sendEmail(
            listingSuspendedEmail({
              hostName: host.firstName,
              hostEmail: host.email,
              propertyTitle: property.title,
              reason: reason || undefined,
            })
          ).catch((e) => console.warn("[Admin] Failed to send listing suspension email:", e));
        }
      });
    } else if (status === "PUBLISHED" || status === "REJECTED") {
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

  async deleteProperty(id: string, adminId: string, ipAddress?: string) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.id, id))
      .limit(1);

    if (!property) {
      throw new Error("Property not found");
    }

    // Clean up dependent child records safely before removing property
    await db.delete(schema.propertyPrivateDetails).where(eq(schema.propertyPrivateDetails.propertyId, id));
    await db.delete(schema.propertyImages).where(eq(schema.propertyImages.propertyId, id));
    await db.delete(schema.propertyAmenities).where(eq(schema.propertyAmenities.propertyId, id));
    await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.propertyId, id));
    await db.delete(schema.reviews).where(eq(schema.reviews.propertyId, id));
    await db.delete(schema.bookings).where(eq(schema.bookings.propertyId, id));
    await db.delete(schema.properties).where(eq(schema.properties.id, id));

    // Insert audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "PROPERTY_DELETED",
      entityType: "property",
      entityId: id,
      details: `Property "${property.title}" (ID: ${id}) permanently deleted by administrator. Removed from marketplace.`,
      ipAddress: ipAddress || null,
    });

    return { success: true, message: `Property "${property.title}" permanently deleted and removed from marketplace.` };
  },

  async deleteHost(hostId: string, adminId: string, ipAddress?: string) {
    const db = getDb();
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, hostId))
      .limit(1);

    if (!host) {
      throw new Error("Host not found");
    }

    // 1. Delete all properties owned by this host
    const hostProperties = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId));

    for (const prop of hostProperties) {
      await db.delete(schema.propertyPrivateDetails).where(eq(schema.propertyPrivateDetails.propertyId, prop.id));
      await db.delete(schema.propertyImages).where(eq(schema.propertyImages.propertyId, prop.id));
      await db.delete(schema.propertyAmenities).where(eq(schema.propertyAmenities.propertyId, prop.id));
      await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.propertyId, prop.id));
      await db.delete(schema.reviews).where(eq(schema.reviews.propertyId, prop.id));
      await db.delete(schema.bookings).where(eq(schema.bookings.propertyId, prop.id));
      await db.delete(schema.properties).where(eq(schema.properties.id, prop.id));
    }

    // 2. Delete payouts, earnings, verification logs, profile
    await db.delete(schema.payouts).where(eq(schema.payouts.hostId, hostId));
    await db.delete(schema.hostEarnings).where(eq(schema.hostEarnings.hostId, hostId));
    await db.delete(schema.verificationLogs).where(eq(schema.verificationLogs.hostId, hostId));
    await db.delete(schema.profiles).where(eq(schema.profiles.userId, hostId));

    // 3. Delete user account
    await db.delete(schema.users).where(eq(schema.users.id, hostId));

    // 4. Audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "HOST_DELETED",
      entityType: "user",
      entityId: hostId,
      details: `Host account ${host.firstName} ${host.lastName} (${host.email}) and all ${hostProperties.length} listings permanently deleted.`,
      ipAddress: ipAddress || null,
    });

    return { success: true, message: `Host ${host.firstName} ${host.lastName} and all associated records deleted successfully.` };
  },

  async deleteKyc(hostId: string, adminId: string, ipAddress?: string) {
    const db = getDb();
    const [host] = await db
      .select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, hostId))
      .limit(1);

    if (!host) {
      throw new Error("Host not found");
    }

    // Delete verification logs
    await db.delete(schema.verificationLogs).where(eq(schema.verificationLogs.hostId, hostId));

    // Reset profile verification status and uploaded documents
    await db
      .update(schema.profiles)
      .set({
        verificationStatus: "UNVERIFIED",
        isVerified: false,
        idType: null,
        idNumber: null,
        identityDocumentUrl: null,
        idDocumentBackUrl: null,
        selfieUrl: null,
        authorityDocType: null,
        authorityDocUrl: null,
        reviewFeedback: "KYC documents and submission were cleared by administrator.",
        reviewedAt: null,
        reviewedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId));

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "KYC_REQUEST_DELETED",
      entityType: "profile",
      entityId: hostId,
      details: `KYC submission for ${host.firstName} ${host.lastName} (${host.email}) was cleared and reset to UNVERIFIED.`,
      ipAddress: ipAddress || null,
    });

    return { success: true, message: `KYC records for ${host.firstName} ${host.lastName} have been cleared.` };
  },

  async deleteBooking(bookingId: string, adminId: string, ipAddress?: string) {
    const db = getDb();
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Clean up availability blocks, payouts, refunds, payments
    await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.bookingId, bookingId));
    await db.delete(schema.payouts).where(eq(schema.payouts.bookingId, bookingId));
    await db.delete(schema.refunds).where(eq(schema.refunds.bookingId, bookingId));
    await db.delete(schema.payments).where(eq(schema.payments.bookingId, bookingId));
    await db.delete(schema.reviews).where(eq(schema.reviews.bookingId, bookingId));
    await db.delete(schema.bookings).where(eq(schema.bookings.id, bookingId));

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "BOOKING_DELETED",
      entityType: "booking",
      entityId: bookingId,
      details: `Booking #${booking.referenceCode} (${booking.guestFirstName} ${booking.guestLastName}) permanently deleted by administrator.`,
      ipAddress: ipAddress || null,
    });

    return { success: true, message: `Booking #${booking.referenceCode} deleted successfully.` };
  },

  async deleteTransaction(paymentId: string, adminId: string, ipAddress?: string) {
    const db = getDb();
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new Error("Payment record not found");
    }

    await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "PAYMENT_DELETED",
      entityType: "payment",
      entityId: paymentId,
      details: `Payment transaction ${payment.reference} (₦${(payment.amount / 100).toLocaleString()}) deleted by administrator.`,
      ipAddress: ipAddress || null,
    });

    return { success: true, message: `Transaction ${payment.reference} deleted successfully.` };
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

    let validAdminId: string | null = null;
    if (adminId) {
      const [adminUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, adminId)).limit(1);
      if (adminUser) validAdminId = adminUser.id;
    }

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    let updatedProfile;
    if (profile) {
      const [p] = await db
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
      updatedProfile = p;
    } else {
      const [p] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId: hostId,
          isVerified: true,
          verificationStatus: "APPROVED",
          reviewedBy: adminId,
          reviewedAt: new Date(),
          reviewFeedback: null,
        })
        .returning();
      updatedProfile = p;
    }

    // Ensure host role & active status on users table
    await db
      .update(schema.users)
      .set({
        role: "host",
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, hostId));

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId: validAdminId,
      previousStatus: prevStatus,
      newStatus: "APPROVED",
      action: "APPROVE",
      notes: "Host KYC, identity, and ownership documents reviewed and approved by platform admin.",
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: validAdminId || adminId,
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

    let validAdminId: string | null = null;
    if (adminId) {
      const [adminUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, adminId)).limit(1);
      if (adminUser) validAdminId = adminUser.id;
    }

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    let updatedProfile;
    if (profile) {
      const [p] = await db
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
      updatedProfile = p;
    } else {
      const [p] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId: hostId,
          isVerified: false,
          verificationStatus: "REJECTED",
          reviewFeedback: reason,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        })
        .returning();
      updatedProfile = p;
    }

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId: validAdminId,
      previousStatus: prevStatus,
      newStatus: "REJECTED",
      action: "REJECT",
      reason,
      notes: `Rejected by admin. Reason: ${reason}`,
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: validAdminId || adminId,
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

    let validAdminId: string | null = null;
    if (adminId) {
      const [adminUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, adminId)).limit(1);
      if (adminUser) validAdminId = adminUser.id;
    }

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    let updatedProfile;
    if (profile) {
      const [p] = await db
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
      updatedProfile = p;
    } else {
      const [p] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId: hostId,
          verificationStatus: "ACTION_REQUIRED",
          reviewFeedback: instructions,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        })
        .returning();
      updatedProfile = p;
    }

    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId: validAdminId,
      previousStatus: prevStatus,
      newStatus: "ACTION_REQUIRED",
      action: "REQUEST_INFO",
      notes: instructions,
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: validAdminId || adminId,
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

    let validAdminId: string | null = null;
    if (adminId) {
      const [adminUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, adminId)).limit(1);
      if (adminUser) validAdminId = adminUser.id;
    }

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, hostId)).limit(1);
    const prevStatus = profile?.verificationStatus || "REGISTERED";

    // 1. Update user profile to SUSPENDED & isVerified to false
    let updatedProfile;
    if (profile) {
      const [p] = await db
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
      updatedProfile = p;
    } else {
      const [p] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId: hostId,
          isVerified: false,
          verificationStatus: "SUSPENDED",
          reviewFeedback: reason || "Account suspended by platform administration.",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        })
        .returning();
      updatedProfile = p;
    }

    // 2. Mark user status as SUSPENDED
    await db
      .update(schema.users)
      .set({
        status: "SUSPENDED",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, hostId));

    // 3. Suspend all active/published properties for this host with moderation tracking
    await db
      .update(schema.properties)
      .set({
        status: "SUSPENDED",
        moderationStatus: "SUSPENDED",
        moderationReason: reason || "Host account suspended by administrator.",
        moderatedAt: new Date(),
        moderatedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.hostId, hostId));

    // 4. Record in verification logs
    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId: validAdminId,
      previousStatus: prevStatus,
      newStatus: "SUSPENDED",
      action: "SUSPEND",
      reason: reason || "Administrative suspension",
      notes: `Suspended by admin. Reason: ${reason || "Account suspended."}`,
    });

    // 5. Record in audit logs
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: validAdminId || adminId,
      action: "HOST_SUSPENDED",
      entityType: "host",
      entityId: hostId,
      details: `Host ${host.firstName} ${host.lastName} (${host.email}) suspended. Reason: ${reason || "Violation of platform policies"}`,
      ipAddress: ipAddress || null,
    });

    // 6. Notify host of account suspension via Resend
    import("../notifications/notifications.service").then(async ({ sendEmail, hostAccountSuspendedEmail }) => {
      sendEmail(
        hostAccountSuspendedEmail({
          hostName: host.firstName,
          hostEmail: host.email,
          reason: reason || undefined,
        })
      ).catch((e) => console.warn("[Admin] Failed to send host account suspension email:", e));
    });

    return {
      success: true,
      message: `Host account and all associated listings have been suspended.`,
      profile: updatedProfile,
    };
  },

  async reinstateHost(hostId: string, adminId: string, reason?: string, ipAddress?: string) {
    const db = getDb();

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, hostId))
      .limit(1);

    if (!host) {
      const err: any = new Error("Host user not found");
      err.statusCode = 404;
      throw err;
    }

    const [adminUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, adminId))
      .limit(1);

    const validAdminId = adminUser ? adminUser.id : null;

    // 1. Activate host user account
    await db
      .update(schema.users)
      .set({
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, hostId));

    // 2. Restore host profile verification
    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        verificationStatus: "APPROVED",
        isVerified: true,
        reviewFeedback: `Reinstated: ${reason || "Account clearance restored by platform administrator"}`,
        reviewedBy: validAdminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, hostId))
      .returning();

    // 3. Clear suspension on host properties
    await db
      .update(schema.properties)
      .set({
        moderationStatus: "NONE",
        moderationReason: null,
        moderatedAt: new Date(),
        moderatedBy: validAdminId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.properties.hostId, hostId),
          eq(schema.properties.moderationStatus, "SUSPENDED")
        )
      );

    // 4. Verification and Audit logs
    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId,
      adminId: validAdminId,
      previousStatus: "SUSPENDED",
      newStatus: "APPROVED",
      action: "REINSTATE",
      reason: reason || "Administrative reinstatement",
      notes: `Reinstated by admin. Clearance restored.`,
    });

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: validAdminId || adminId,
      action: "HOST_REINSTATED",
      entityType: "host",
      entityId: hostId,
      details: `Host ${host.firstName} ${host.lastName} (${host.email}) reinstated. Reason: ${reason || "Account restored."}`,
      ipAddress: ipAddress || null,
    });

    return {
      success: true,
      message: `Host account and listings have been successfully reinstated.`,
      profile: updatedProfile,
    };
  },

  async getSettings() {
    const db = getDb();
    const [settings] = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);

    if (!settings) {
      return {
        id: "default",
        defaultHostCommissionPct: 10,
        payoutHoldHours: 24,
        updatedAt: new Date(),
      };
    }

    return settings;
  },

  async updateSettings(
    data: { defaultHostCommissionPct?: number; payoutHoldHours?: number },
    adminId: string,
    ipAddress?: string
  ) {
    const db = getDb();

    if (data.defaultHostCommissionPct !== undefined) {
      if (data.defaultHostCommissionPct < 0 || data.defaultHostCommissionPct > 50) {
        throw new Error("Commission rate must be between 0% and 50%.");
      }
    }

    if (data.payoutHoldHours !== undefined) {
      if (data.payoutHoldHours < 0 || data.payoutHoldHours > 168) {
        throw new Error("Payout hold period must be between 0 and 168 hours (7 days).");
      }
    }

    const [existing] = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);

    let updated: any;
    if (!existing) {
      const [inserted] = await db
        .insert(schema.platformSettings)
        .values({
          id: "default",
          defaultHostCommissionPct: data.defaultHostCommissionPct ?? 10,
          payoutHoldHours: data.payoutHoldHours ?? 24,
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .returning();
      updated = inserted;
    } else {
      const [up] = await db
        .update(schema.platformSettings)
        .set({
          ...(data.defaultHostCommissionPct !== undefined ? { defaultHostCommissionPct: data.defaultHostCommissionPct } : {}),
          ...(data.payoutHoldHours !== undefined ? { payoutHoldHours: data.payoutHoldHours } : {}),
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSettings.id, "default"))
        .returning();
      updated = up;
    }

    // Audit log
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: adminId,
      action: "SETTINGS_UPDATED",
      entityType: "platform_settings",
      entityId: "default",
      details: `Updated platform settings: commission=${updated.defaultHostCommissionPct}%, payoutHold=${updated.payoutHoldHours}h`,
      ipAddress: ipAddress || null,
    });

    return updated;
  },
};
