import { z } from "zod";
import { eq, and, desc, asc, inArray, lt, gt, gte, sql, ne } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";
import { BankResolutionService, maskAccountNumber } from "../payments/bank-resolution.service";
import { PROPERTY_STATUS, BOOKING_STATUS } from "../../config/constants";

export const HostPropertyDraftSchema = z.object({
  title: z.string().min(2).default("Untitled Listing"),
  tagline: z.string().optional(),
  description: z.string().optional().default(""),
  propertyType: z.string().optional().default("Apartment"),
  spaceType: z.string().optional().default("Entire place"),
  bedrooms: z.number().int().min(1).optional().default(1),
  bathrooms: z.number().min(1).optional().default(1),
  beds: z.number().int().min(1).optional().default(1),
  maxGuests: z.number().int().min(1).optional().default(2),
  pricePerNight: z.number().int().optional().default(15000),
  hostBasePrice: z.number().int().optional(),
  city: z.string().optional().default("Abuja"),
  neighborhood: z.string().optional().default(""),
  state: z.string().optional().default("FCT"),
  latitude: z.number().optional().default(9.0765),
  longitude: z.number().optional().default(7.3986),
  powerType: z.string().optional().default("Solar + Inverter"),
  powerDescription: z.string().optional(),
  internetDescription: z.string().optional(),
  securityDescription: z.string().optional(),
  waterDescription: z.string().optional(),
  parkingDescription: z.string().optional(),
  coverImage: z.string().optional().default(""),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  exactAddress: z.string().optional().default(""),
  unitNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  checkInInstructions: z.string().optional(),
  accessGateCode: z.string().optional(),
  status: z.string().optional(),
});

export const UpdateHostPropertySchema = HostPropertyDraftSchema.partial();

export const hostsService = {
  async createProperty(userId: string, data: any) {
    const parsed = HostPropertyDraftSchema.parse(data || {});
    const db = getDb();

    // Verify that the user exists and has an approved host verification
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user) throw new Error("User not found");

    if (user.role !== "admin") {
      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
      const isApproved = profile && (profile.isVerified === true || profile.verificationStatus === "APPROVED");
      if (!isApproved) {
        const err: any = new Error("Only verified property partners can list properties. Please complete your host onboarding and await platform approval.");
        err.statusCode = 403;
        throw err;
      }
    }

    const baseTitle = parsed.title || "Untitled Property";
    const cleanSlug = baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "property";
    const slug = `${cleanSlug}-${crypto.randomBytes(4).toString("hex")}`;
    const propertyId = `prop_${crypto.randomUUID()}`;

    const hostBasePrice = parsed.hostBasePrice || Math.round((parsed.pricePerNight || 15000) / 1.10);
    const guestPricePerNight = parsed.hostBasePrice
      ? Math.round(parsed.hostBasePrice * 1.10)
      : (parsed.pricePerNight || 15000);

    const [property] = await db
      .insert(schema.properties)
      .values({
        id: propertyId,
        hostId: userId,
        slug,
        title: baseTitle,
        tagline: parsed.tagline || null,
        description: parsed.description || "Draft property listing in progress.",
        propertyType: parsed.propertyType || "Apartment",
        spaceType: parsed.spaceType || "Entire place",
        bedrooms: parsed.bedrooms || 1,
        bathrooms: parsed.bathrooms || 1,
        beds: parsed.beds || 1,
        maxGuests: parsed.maxGuests || 2,
        pricePerNight: guestPricePerNight,
        hostBasePrice: hostBasePrice,
        city: parsed.city || "Abuja",
        neighborhood: parsed.neighborhood || "Central Area",
        state: parsed.state || "FCT",
        latitude: parsed.latitude || 9.0765,
        longitude: parsed.longitude || 7.3986,
        powerType: parsed.powerType || "Solar + Inverter",
        powerDescription: parsed.powerDescription || null,
        internetDescription: parsed.internetDescription || null,
        securityDescription: parsed.securityDescription || null,
        waterDescription: parsed.waterDescription || null,
        parkingDescription: parsed.parkingDescription || null,
        coverImage: parsed.coverImage || "/images/placeholder-property.jpg",
        status: "DRAFT",
      })
      .returning();

    await db.insert(schema.propertyPrivateDetails).values({
      id: `pvd_${property.id}`,
      propertyId: property.id,
      exactAddress: parsed.exactAddress || "Address to be provided",
      unitNumber: parsed.unitNumber || null,
      contactName: parsed.contactName || (user ? `${user.firstName} ${user.lastName}` : "Host"),
      contactPhone: parsed.contactPhone || user?.phone || "+2348000000000",
      contactEmail: parsed.contactEmail || user?.email || "host@ilestays.ng",
      checkInInstructions: parsed.checkInInstructions || null,
      accessGateCode: parsed.accessGateCode || null,
    });

    // Save initial images if provided
    if (parsed.images && parsed.images.length > 0) {
      for (let i = 0; i < parsed.images.length; i++) {
        await db.insert(schema.propertyImages).values({
          id: `img_${property.id}_${i}`,
          propertyId: property.id,
          url: parsed.images[i],
          displayOrder: i,
        });
      }
    }

    // Save initial amenities if provided
    if (parsed.amenities && parsed.amenities.length > 0) {
      for (let i = 0; i < parsed.amenities.length; i++) {
        await db.insert(schema.propertyAmenities).values({
          id: `am_${property.id}_${i}`,
          propertyId: property.id,
          name: parsed.amenities[i],
          category: "General",
        });
      }
    }

    return property;
  },

  async updateProperty(userId: string, propertyId: string, data: any) {
    const parsed = UpdateHostPropertySchema.parse(data);
    const db = getDb();

    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      throw new Error("Property not found or unauthorized");
    }

    const isSuspended = property.moderationStatus === "SUSPENDED" || property.status === "SUSPENDED";

    const {
      exactAddress,
      unitNumber,
      contactName,
      contactPhone,
      contactEmail,
      checkInInstructions,
      accessGateCode,
      images,
      amenities,
      ...publicProps
    } = parsed;

    if (isSuspended) {
      if (data?.status === "PUBLISHED" || (publicProps as any).status === "PUBLISHED") {
        const err: any = new Error("This property was suspended by platform administrators and cannot be republished directly. Please contact support.");
        err.statusCode = 403;
        throw err;
      }
      // Guarantee that administrative suspension remains intact even if host edits content
      (publicProps as any).status = "SUSPENDED";
      (publicProps as any).moderationStatus = "SUSPENDED";
    }

    if (parsed.hostBasePrice !== undefined) {
      (publicProps as any).hostBasePrice = parsed.hostBasePrice;
      (publicProps as any).pricePerNight = Math.round(parsed.hostBasePrice * 1.10);
    } else if (parsed.pricePerNight !== undefined) {
      (publicProps as any).pricePerNight = parsed.pricePerNight;
      (publicProps as any).hostBasePrice = Math.round(parsed.pricePerNight / 1.10);
    }

    let updatedProperty = property;

    if (Object.keys(publicProps).length > 0) {
      const [up] = await db
        .update(schema.properties)
        .set({
          ...publicProps,
          updatedAt: new Date(),
        })
        .where(eq(schema.properties.id, propertyId))
        .returning();
      updatedProperty = up;
    }

    // Update private details
    if (
      exactAddress !== undefined ||
      unitNumber !== undefined ||
      contactName !== undefined ||
      contactPhone !== undefined ||
      contactEmail !== undefined ||
      checkInInstructions !== undefined ||
      accessGateCode !== undefined
    ) {
      const privUpdate: any = { updatedAt: new Date() };
      if (exactAddress !== undefined) privUpdate.exactAddress = exactAddress;
      if (unitNumber !== undefined) privUpdate.unitNumber = unitNumber;
      if (contactName !== undefined) privUpdate.contactName = contactName;
      if (contactPhone !== undefined) privUpdate.contactPhone = contactPhone;
      if (contactEmail !== undefined) privUpdate.contactEmail = contactEmail;
      if (checkInInstructions !== undefined) privUpdate.checkInInstructions = checkInInstructions;
      if (accessGateCode !== undefined) privUpdate.accessGateCode = accessGateCode;

      await db
        .update(schema.propertyPrivateDetails)
        .set(privUpdate)
        .where(eq(schema.propertyPrivateDetails.propertyId, propertyId));
    }

    // Update images if provided
    if (images !== undefined) {
      await db.delete(schema.propertyImages).where(eq(schema.propertyImages.propertyId, propertyId));
      for (let i = 0; i < images.length; i++) {
        await db.insert(schema.propertyImages).values({
          id: `img_${propertyId}_${i}_${Date.now()}`,
          propertyId,
          url: images[i],
          displayOrder: i,
        });
      }
      if (images.length > 0 && (!publicProps.coverImage || publicProps.coverImage === "/images/placeholder-property.jpg")) {
        await db.update(schema.properties).set({ coverImage: images[0] }).where(eq(schema.properties.id, propertyId));
      }
    }

    // Update amenities if provided
    if (amenities !== undefined) {
      await db.delete(schema.propertyAmenities).where(eq(schema.propertyAmenities.propertyId, propertyId));
      for (let i = 0; i < amenities.length; i++) {
        await db.insert(schema.propertyAmenities).values({
          id: `am_${propertyId}_${i}_${Date.now()}`,
          propertyId,
          name: amenities[i],
          category: "General",
        });
      }
    }

    return updatedProperty;
  },

  async submitPropertyForReview(userId: string, propertyId: string) {
    const db = getDb();

    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) throw new Error("Property not found or unauthorized");
    if (property.status === "PUBLISHED" && property.moderationStatus !== "SUSPENDED") {
      throw new Error("This property is already published.");
    }
    if (property.moderationStatus === "SUSPENDED" || property.status === "SUSPENDED") {
      const err: any = new Error("This listing has been suspended by an administrator and cannot be published directly. Please contact support.");
      err.statusCode = 403;
      throw err;
    }

    // Enforce that host has approved KYC verification
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user?.role !== "admin") {
      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
      const isApproved = profile && (profile.isVerified === true || profile.verificationStatus === "APPROVED");
      if (!isApproved) {
        const err: any = new Error("Your host verification must be approved before you can publish listings.");
        err.statusCode = 403;
        throw err;
      }
    }

    const [privateDetails] = await db
      .select()
      .from(schema.propertyPrivateDetails)
      .where(eq(schema.propertyPrivateDetails.propertyId, propertyId))
      .limit(1);

    const images = await db
      .select()
      .from(schema.propertyImages)
      .where(eq(schema.propertyImages.propertyId, propertyId));

    // Structured Validation per Section 3.37
    const missingFields: string[] = [];

    if (!property.title || property.title.trim().length < 3 || property.title === "Untitled Listing") {
      missingFields.push("Property title (at least 3 characters)");
    }
    if (!property.description || property.description.trim().length < 15) {
      missingFields.push("Property description (at least 15 characters)");
    }
    if (!property.propertyType) {
      missingFields.push("Property type");
    }
    if (!property.city || !property.neighborhood) {
      missingFields.push("City and neighborhood location");
    }
    if (!property.latitude || !property.longitude) {
      missingFields.push("Geographic coordinates");
    }
    if (!privateDetails?.exactAddress || privateDetails.exactAddress.trim().length < 5) {
      missingFields.push("Exact private address (for confirmed guests)");
    }
    if (!property.pricePerNight || property.pricePerNight <= 0) {
      missingFields.push("Price per night (must be greater than ₦0)");
    }
    if (images.length === 0 && (!property.coverImage || property.coverImage === "/images/placeholder-property.jpg")) {
      missingFields.push("At least one property photo");
    }

    if (missingFields.length > 0) {
      const err: any = new Error("Please complete all required fields before publishing your listing.");
      err.missingFields = missingFields;
      err.statusCode = 400;
      throw err;
    }

    // Direct publication for KYC-approved hosts
    const [updated] = await db
      .update(schema.properties)
      .set({
        status: "PUBLISHED",
        moderationStatus: "NONE",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, propertyId))
      .returning();

    // Trigger host publication confirmation email via Resend
    import("../notifications/notifications.service").then(async ({ sendEmail, listingPublishedEmail }) => {
      const [host] = await db
        .select({ email: schema.users.email, firstName: schema.users.firstName })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (host) {
        sendEmail(
          listingPublishedEmail({
            hostName: host.firstName,
            hostEmail: host.email,
            propertyTitle: updated.title,
            propertyId: updated.id,
            nightlyPrice: updated.pricePerNight,
            city: updated.city,
            neighborhood: updated.neighborhood,
            currency: updated.currency,
          })
        ).catch((e) => console.warn("[Host] Failed to send publication email:", e));
      }
    });

    return {
      success: true,
      message: "Property published successfully and is now live on Ilé!",
      property: updated,
    };
  },

  async publishProperty(userId: string, propertyId: string) {
    return this.submitPropertyForReview(userId, propertyId);
  },

  async getHostProperties(userId: string) {
    const db = getDb();
    const props = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, userId))
      .orderBy(desc(schema.properties.createdAt));

    // Attach image counts
    const propertyIds = props.map((p) => p.id);
    let images: any[] = [];
    if (propertyIds.length > 0) {
      images = await db
        .select()
        .from(schema.propertyImages)
        .where(inArray(schema.propertyImages.propertyId, propertyIds));
    }

    return props.map((p) => ({
      ...p,
      imageCount: images.filter((img) => img.propertyId === p.id).length,
    }));
  },

  async getHostProperty(userId: string, propertyId: string) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) throw new Error("Property not found");

    const [privateDetails] = await db
      .select()
      .from(schema.propertyPrivateDetails)
      .where(eq(schema.propertyPrivateDetails.propertyId, propertyId))
      .limit(1);

    const images = await db
      .select()
      .from(schema.propertyImages)
      .where(eq(schema.propertyImages.propertyId, propertyId))
      .orderBy(asc(schema.propertyImages.displayOrder));

    const amenities = await db
      .select()
      .from(schema.propertyAmenities)
      .where(eq(schema.propertyAmenities.propertyId, propertyId));

    return {
      property,
      privateDetails,
      /** URLs in display order (backward compatible for existing web editors). */
      images: images.map((img) => img.url),
      /** Full media rows for reorder/cover APIs. */
      media: images.map((img) => ({
        id: img.id,
        url: img.url,
        displayOrder: img.displayOrder,
        caption: img.caption,
      })),
      amenities: amenities.map((a) => a.name),
    };
  },

  async getDashboard(userId: string) {
    const db = getDb();
    const properties = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, userId));

    const activeProperties = properties.filter((p) => p.status !== PROPERTY_STATUS.ARCHIVED);
    const totalProperties = activeProperties.length;
    const published = properties.filter((p) => p.status === PROPERTY_STATUS.PUBLISHED).length;
    const pending = properties.filter((p) => p.status === "PENDING_REVIEW" || p.status === "PENDING").length;
    const drafts = properties.filter((p) => p.status === PROPERTY_STATUS.DRAFT).length;
    const rejected = properties.filter((p) => p.status === PROPERTY_STATUS.REJECTED).length;
    const archived = properties.filter((p) => p.status === PROPERTY_STATUS.ARCHIVED).length;

    const propIds = properties.map((p) => p.id);
    let lifetimeGross = 0;
    let lifetimeHostEarnings = 0;
    let periodGross = 0;
    let periodHostEarnings = 0;
    let recentBookings: any[] = [];
    let byProperty: Array<{
      propertyId: string;
      title: string;
      status: string;
      gross: number;
      hostEarnings: number;
      bookingCount: number;
    }> = [];

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);

    if (propIds.length > 0) {
      const allBookings = await db
        .select({
          id: schema.bookings.id,
          propertyId: schema.bookings.propertyId,
          status: schema.bookings.status,
          accommodationSubtotal: schema.bookings.accommodationSubtotal,
          nightlyPrice: schema.bookings.nightlyPrice,
          numberOfNights: schema.bookings.numberOfNights,
          totalAmount: schema.bookings.totalAmount,
          serviceFee: schema.bookings.serviceFee,
          hostCommissionPct: schema.bookings.hostCommissionPct,
          hostCommissionAmount: schema.bookings.hostCommissionAmount,
          hostNetAmount: schema.bookings.hostNetAmount,
          checkInDate: schema.bookings.checkInDate,
          checkOutDate: schema.bookings.checkOutDate,
          guestFirstName: schema.bookings.guestFirstName,
          guestLastName: schema.bookings.guestLastName,
          referenceCode: schema.bookings.referenceCode,
          hostResponseDeadlineAt: schema.bookings.hostResponseDeadlineAt,
          createdAt: schema.bookings.createdAt,
        })
        .from(schema.bookings)
        .where(inArray(schema.bookings.propertyId, propIds))
        .orderBy(desc(schema.bookings.createdAt));

      const propertyEarnings = new Map<string, { gross: number; hostEarnings: number; bookingCount: number }>();

      for (const b of allBookings) {
        const isPaid = b.status === BOOKING_STATUS.CONFIRMED || b.status === BOOKING_STATUS.COMPLETED;
        if (!isPaid) continue;

        const subtotal =
          b.accommodationSubtotal ||
          (b.nightlyPrice * b.numberOfNights) ||
          (b.totalAmount - (b.serviceFee || 0));
        const commission =
          b.hostCommissionAmount && b.hostCommissionAmount > 0
            ? b.hostCommissionAmount
            : Math.round(subtotal * ((b.hostCommissionPct || 10) / 100));
        const net =
          b.hostNetAmount && b.hostNetAmount > 0 ? b.hostNetAmount : subtotal - commission;

        lifetimeGross += subtotal;
        lifetimeHostEarnings += net;

        if (b.createdAt && new Date(b.createdAt) >= periodStart) {
          periodGross += subtotal;
          periodHostEarnings += net;
        }

        const existing = propertyEarnings.get(b.propertyId) || {
          gross: 0,
          hostEarnings: 0,
          bookingCount: 0,
        };
        existing.gross += subtotal;
        existing.hostEarnings += net;
        existing.bookingCount += 1;
        propertyEarnings.set(b.propertyId, existing);
      }

      byProperty = properties.map((p) => {
        const stats = propertyEarnings.get(p.id) || {
          gross: 0,
          hostEarnings: 0,
          bookingCount: 0,
        };
        return {
          propertyId: p.id,
          title: p.title,
          status: p.status,
          gross: stats.gross,
          hostEarnings: stats.hostEarnings,
          bookingCount: stats.bookingCount,
        };
      });

      recentBookings = allBookings.slice(0, 10);
    }

    const { FinanceService } = await import("../finance/finance.service");
    const wallet = await FinanceService.getHostWallet(userId);
    const occupancy = await this.getOccupancyMetrics(userId, propIds);

    return {
      totalProperties,
      published,
      pending,
      drafts,
      rejected,
      archived,
      properties: activeProperties,
      recentBookings,
      earnings: {
        /** Lifetime accommodation gross from CONFIRMED/COMPLETED bookings (all rows, not truncated). */
        totalGross: lifetimeGross,
        /** Lifetime host earnings (hostNetAmount snapshots). */
        totalNet: lifetimeHostEarnings,
        totalCommission: lifetimeGross - lifetimeHostEarnings,
        lifetimeGross,
        lifetimeHostEarnings,
        period: {
          label: "month_to_date",
          gross: periodGross,
          hostEarnings: periodHostEarnings,
        },
        byProperty,
        wallet: wallet.balances,
        labels: {
          totalGross: "Guest accommodation (host base × nights)",
          totalNet: "Your earnings from confirmed stays",
          totalCommission: "Platform share on accommodation",
          walletPending: wallet.labels.pending,
          walletAvailable: wallet.labels.available,
          walletProcessing: wallet.labels.processing,
          walletPaid: wallet.labels.paid,
        },
      },
      occupancy,
      alerts: await this.getHostAlerts(userId, propIds),
    };
  },

  async getHostBookings(userId: string) {
    const db = getDb();

    // 1. Fetch properties owned by this host
    const props = await db
      .select({ id: schema.properties.id, title: schema.properties.title, city: schema.properties.city })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, userId));

    const propIds = props.map((p) => p.id);
    if (propIds.length === 0) {
      return { bookings: [] };
    }

    // 2. Fetch bookings strictly for this host's properties
    const bookingsList = await db
      .select({
        id: schema.bookings.id,
        referenceCode: schema.bookings.referenceCode,
        propertyId: schema.bookings.propertyId,
        guestFirstName: schema.bookings.guestFirstName,
        guestLastName: schema.bookings.guestLastName,
        guestEmail: schema.bookings.guestEmail,
        guestPhone: schema.bookings.guestPhone,
        guestCount: schema.bookings.guestCount,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        numberOfNights: schema.bookings.numberOfNights,
        nightlyPrice: schema.bookings.nightlyPrice,
        accommodationSubtotal: schema.bookings.accommodationSubtotal,
        hostCommissionPct: schema.bookings.hostCommissionPct,
        hostCommissionAmount: schema.bookings.hostCommissionAmount,
        paystackFeeAmount: schema.bookings.paystackFeeAmount,
        hostNetAmount: schema.bookings.hostNetAmount,
        totalAmount: schema.bookings.totalAmount,
        status: schema.bookings.status,
        hostResponse: schema.bookings.hostResponse,
        hostResponseDeadlineAt: schema.bookings.hostResponseDeadlineAt,
        paymentDeadlineAt: schema.bookings.paymentDeadlineAt,
        hostRespondedAt: schema.bookings.hostRespondedAt,
        guestCheckInConfirmedAt: schema.bookings.guestCheckInConfirmedAt,
        createdAt: schema.bookings.createdAt,
      })
      .from(schema.bookings)
      .where(inArray(schema.bookings.propertyId, propIds))
      .orderBy(desc(schema.bookings.createdAt));

    const enriched = bookingsList.map((b) => {
      const prop = props.find((p) => p.id === b.propertyId);
      const subtotal = b.accommodationSubtotal || (b.nightlyPrice * b.numberOfNights) || b.totalAmount;
      const commission = b.hostCommissionAmount && b.hostCommissionAmount > 0
        ? b.hostCommissionAmount
        : Math.round(subtotal * ((b.hostCommissionPct || 10) / 100));
      const net = b.hostNetAmount && b.hostNetAmount > 0
        ? b.hostNetAmount
        : subtotal - commission;

      return {
        ...b,
        bookingStatus: b.status,
        accommodationSubtotal: subtotal,
        hostCommissionAmount: commission,
        hostNetAmount: net,
        propertyTitle: prop?.title || "Property",
        propertyCity: prop?.city || "Nigeria",
        /** Guest-owned; host UI may display but must never forge via confirm-check-in. */
        guestCheckInConfirmed: !!b.guestCheckInConfirmedAt,
      };
    });

    return { bookings: enriched };
  },

  async getHostPayouts(userId: string) {
    const db = getDb();
    const list = await db
      .select({
        id: schema.payouts.id,
        bookingId: schema.payouts.bookingId,
        amount: schema.payouts.amount,
        currency: schema.payouts.currency,
        bankName: schema.payouts.bankName,
        accountNumber: schema.payouts.accountNumber,
        accountName: schema.payouts.accountName,
        status: schema.payouts.status,
        scheduledFor: schema.payouts.scheduledFor,
        disbursedAt: schema.payouts.disbursedAt,
        paystackTransferRef: schema.payouts.paystackTransferRef,
        notes: schema.payouts.notes,
        createdAt: schema.payouts.createdAt,
        bookingRef: schema.bookings.referenceCode,
        propertyName: schema.properties.title,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
      })
      .from(schema.payouts)
      .innerJoin(schema.bookings, eq(schema.payouts.bookingId, schema.bookings.id))
      .innerJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .where(eq(schema.payouts.hostId, userId))
      .orderBy(desc(schema.payouts.createdAt));

    return { payouts: list };
  },

  async getHostProfile(userId: string) {
    const db = getDb();
    const [user] = await db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    const [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    return {
      user,
      profile: profile || null,
      isHost: user.role === "host" || user.role === "admin",
    };
  },

  async updateHostProfile(userId: string, data: any) {
    const db = getDb();
    const userUpdates: any = { updatedAt: new Date() };
    if (data.firstName) userUpdates.firstName = data.firstName.trim();
    if (data.lastName) userUpdates.lastName = data.lastName.trim();
    if (data.phone) userUpdates.phone = data.phone.trim();
    if (data.role === "host" || data.becomeHost) userUpdates.role = "host";

    const [updatedUser] = await db
      .update(schema.users)
      .set(userUpdates)
      .where(eq(schema.users.id, userId))
      .returning();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    let updatedProfile;
    if (existingProfile) {
      const profUpdates: any = { updatedAt: new Date() };
      if (data.bio !== undefined) profUpdates.bio = data.bio;
      if (data.responseTime) profUpdates.responseTime = data.responseTime;
      if (data.responseRate) profUpdates.responseRate = data.responseRate;

      [updatedProfile] = await db
        .update(schema.profiles)
        .set(profUpdates)
        .where(eq(schema.profiles.userId, userId))
        .returning();
    } else {
      [updatedProfile] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId,
          bio: data.bio || "",
          responseTime: data.responseTime || "Within an hour",
          responseRate: data.responseRate || "100%",
          joinedYear: new Date().getFullYear(),
        })
        .returning();
    }

    return {
      user: updatedUser,
      profile: updatedProfile,
      isHost: updatedUser.role === "host" || updatedUser.role === "admin",
    };
  },

  async getOnboardingStatus(userId: string) {
    const db = getDb();
    const [user] = await db
      .select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phone: schema.users.phone,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        emailVerified: schema.users.emailVerified,
        phoneVerified: schema.users.phoneVerified,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) throw new Error("User not found");

    let [profile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (!profile) {
      const [newProf] = await db
        .insert(schema.profiles)
        .values({
          id: `prof_${crypto.randomUUID()}`,
          userId,
          onboardingStep: 1,
          onboardingCompleted: false,
          verificationStatus: "REGISTERED",
        })
        .returning();
      profile = newProf;
    }

    const missingRequirements: string[] = [];
    if (!user.emailVerified) missingRequirements.push("Verify your email address");
    if (!user.phone) missingRequirements.push("Provide your contact phone number");
    if (!profile.dateOfBirth || !profile.residentialAddress) missingRequirements.push("Complete personal and operational profile");
    if (!profile.idNumber || !profile.identityDocumentUrl || !profile.selfieUrl) missingRequirements.push("Upload Nigerian government ID & verified selfie");
    if (!profile.authorityDocUrl) missingRequirements.push("Provide proof of residence (utility bill, tenancy agreement, etc.)");
    if (!profile.bankAccountNumber || !profile.bankName) missingRequirements.push("Add Nigerian bank payout details");

    let progressPct = 15;
    if (profile.verificationStatus === "APPROVED") {
      progressPct = 100;
    } else if (profile.verificationStatus === "UNDER_REVIEW") {
      progressPct = 95;
    } else if (profile.onboardingStep >= 6) {
      progressPct = 90;
    } else if (profile.onboardingStep === 5) {
      progressPct = 75;
    } else if (profile.onboardingStep === 4) {
      progressPct = 60;
    } else if (profile.onboardingStep === 3) {
      progressPct = 40;
    } else if (profile.onboardingStep === 2) {
      progressPct = 25;
    }

    return {
      user,
      profile,
      step: profile.onboardingStep,
      completed: profile.onboardingCompleted,
      verificationStatus: profile.verificationStatus,
      isVerified: profile.isVerified || profile.verificationStatus === "APPROVED",
      reviewFeedback: profile.reviewFeedback,
      progressPct,
      missingRequirements,
    };
  },

  async updateOnboardingProfile(userId: string, data: any) {
    const db = getDb();

    const userUpdates: any = { updatedAt: new Date() };
    if (data.firstName) userUpdates.firstName = data.firstName.trim();
    if (data.lastName) userUpdates.lastName = data.lastName.trim();
    if (data.phone) userUpdates.phone = data.phone.trim();

    await db.update(schema.users).set(userUpdates).where(eq(schema.users.id, userId));

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    const nextStep = Math.max(existingProfile?.onboardingStep || 1, 3);
    const profUpdates: any = {
      updatedAt: new Date(),
      onboardingStep: nextStep,
    };

    if (data.dateOfBirth !== undefined) profUpdates.dateOfBirth = data.dateOfBirth;
    if (data.residentialAddress !== undefined) profUpdates.residentialAddress = data.residentialAddress;
    if (data.operatingCity !== undefined) profUpdates.operatingCity = data.operatingCity;
    if (data.operatingAreas !== undefined) profUpdates.operatingAreas = data.operatingAreas;
    if (data.bio !== undefined) profUpdates.bio = data.bio;

    if (
      existingProfile?.verificationStatus === "EMAIL_VERIFIED" ||
      existingProfile?.verificationStatus === "PHONE_VERIFIED" ||
      existingProfile?.verificationStatus === "REGISTERED"
    ) {
      profUpdates.verificationStatus = "PROFILE_COMPLETED";
    }

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set(profUpdates)
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { success: true, profile: updatedProfile };
  },

  async updateOnboardingIdentity(userId: string, data: any) {
    const db = getDb();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (!existingProfile) throw new Error("Host profile not found");

    const nextStep = Math.max(existingProfile.onboardingStep, 4);
    const profUpdates: any = {
      updatedAt: new Date(),
      onboardingStep: nextStep,
    };

    if (data.idType) profUpdates.idType = data.idType;
    if (data.idNumber) profUpdates.idNumber = data.idNumber.trim();
    if (data.identityDocumentUrl) profUpdates.identityDocumentUrl = data.identityDocumentUrl;
    if (data.idDocumentBackUrl !== undefined) profUpdates.idDocumentBackUrl = data.idDocumentBackUrl;
    if (data.selfieUrl) profUpdates.selfieUrl = data.selfieUrl;

    if (existingProfile.verificationStatus !== "APPROVED" && existingProfile.verificationStatus !== "UNDER_REVIEW") {
      profUpdates.verificationStatus = "IDENTITY_PENDING";
    }

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set(profUpdates)
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { success: true, profile: updatedProfile };
  },

  async updateOnboardingAuthority(userId: string, data: any) {
    const db = getDb();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (!existingProfile) throw new Error("Host profile not found");

    const nextStep = Math.max(existingProfile.onboardingStep, 5);
    const profUpdates: any = {
      updatedAt: new Date(),
      onboardingStep: nextStep,
    };

    if (data.hostType) profUpdates.hostType = data.hostType;
    if (data.companyName !== undefined) profUpdates.companyName = data.companyName;
    if (data.companyRegistrationNumber !== undefined) profUpdates.companyRegistrationNumber = data.companyRegistrationNumber;
    if (data.authorityDocType) profUpdates.authorityDocType = data.authorityDocType;
    if (data.authorityDocUrl) profUpdates.authorityDocUrl = data.authorityDocUrl;

    // Nigerian Bank Details - verify with Paystack resolution if bank details provided
    if (data.bankAccountNumber && data.bankCode) {
      const cleanAcc = String(data.bankAccountNumber).replace(/\D/g, "").trim();
      const cleanCode = String(data.bankCode).trim();
      const resolution = await BankResolutionService.resolveBankAccount(cleanAcc, cleanCode, userId);
      if (!resolution.resolved || !resolution.accountName) {
        throw new Error(resolution.error || "Bank account could not be verified by Paystack.");
      }
      profUpdates.bankName = resolution.bankName || data.bankName;
      profUpdates.bankCode = cleanCode;
      profUpdates.bankAccountNumber = cleanAcc;
      profUpdates.bankAccountName = resolution.accountName;
      profUpdates.bankAccountVerifiedAt = new Date();
    } else {
      if (data.bankName) profUpdates.bankName = data.bankName;
      if (data.bankCode) profUpdates.bankCode = data.bankCode;
      if (data.bankAccountNumber) profUpdates.bankAccountNumber = data.bankAccountNumber.trim();
      if (data.bankAccountName) profUpdates.bankAccountName = data.bankAccountName.trim();
    }

    const [updatedProfile] = await db
      .update(schema.profiles)
      .set(profUpdates)
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { success: true, profile: updatedProfile };
  },

  async savePropertyDraft(userId: string, draftData: any) {
    const db = getDb();

    const [existingProfile] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (!existingProfile) throw new Error("Host profile not found");

    const nextStep = Math.max(existingProfile.onboardingStep, 6);
    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        propertyDraftData: JSON.stringify(draftData || {}),
        onboardingStep: nextStep,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    return { success: true, profile: updatedProfile };
  },

  async submitOnboardingForReview(userId: string, data?: any) {
    const db = getDb();

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user) throw new Error("User not found");

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
    if (!profile) throw new Error("Host profile not found");

    // If client supplied supplemental data with submission, save to profile first
    if (data && typeof data === "object") {
      const updates: any = { updatedAt: new Date() };
      if (data.idNumber) updates.idNumber = String(data.idNumber).trim();
      if (data.idType) updates.idType = data.idType;
      if (data.identityDocumentUrl || data.idFrontUrl) {
        updates.identityDocumentUrl = data.identityDocumentUrl || data.idFrontUrl;
      }
      if (data.idDocumentBackUrl || data.idBackUrl) {
        updates.idDocumentBackUrl = data.idDocumentBackUrl || data.idBackUrl;
      }
      if (data.selfieUrl) updates.selfieUrl = data.selfieUrl;
      if (data.authorityDocType) updates.authorityDocType = data.authorityDocType;
      if (data.authorityDocUrl) updates.authorityDocUrl = data.authorityDocUrl;
      if (data.bankName) updates.bankName = data.bankName;
      if (data.bankCode) updates.bankCode = data.bankCode;
      if (data.bankAccountNumber) updates.bankAccountNumber = String(data.bankAccountNumber).trim();
      if (data.bankAccountName) updates.bankAccountName = String(data.bankAccountName).trim();
      if (data.hostType) updates.hostType = data.hostType;
      if (data.companyName) updates.companyName = data.companyName;
      if (data.companyRegistrationNumber || data.companyRegNumber) {
        updates.companyRegistrationNumber = data.companyRegistrationNumber || data.companyRegNumber;
      }
      if (data.residentialAddress) updates.residentialAddress = data.residentialAddress;
      if (data.dateOfBirth) updates.dateOfBirth = data.dateOfBirth;
      if (data.operatingCity) updates.operatingCity = data.operatingCity;

      if (Object.keys(updates).length > 1) {
        await db.update(schema.profiles).set(updates).where(eq(schema.profiles.userId, userId));
        Object.assign(profile, updates);
      }
    }

    const effectiveIdNumber = profile.idNumber || data?.idNumber;
    const effectiveIdDocUrl = profile.identityDocumentUrl || data?.identityDocumentUrl || data?.idFrontUrl;
    const effectiveSelfieUrl = profile.selfieUrl || data?.selfieUrl;
    const effectiveAuthorityDocUrl = profile.authorityDocUrl || data?.authorityDocUrl;
    const effectiveBankAccountNumber = profile.bankAccountNumber || data?.bankAccountNumber;
    const effectiveBankName = profile.bankName || data?.bankName;

    if (!effectiveIdNumber || !effectiveIdDocUrl) {
      throw new Error("Please submit a valid government ID document.");
    }
    if (!effectiveSelfieUrl) {
      throw new Error("Please upload a verification selfie photo.");
    }
    if (!effectiveAuthorityDocUrl) {
      throw new Error("Please provide proof of residence (utility bill, tenancy agreement, or estate clearance).");
    }
    if (!effectiveBankAccountNumber || !effectiveBankName) {
      throw new Error("Please provide your Nigerian bank account details for payout verification.");
    }

    const prevStatus = profile.verificationStatus;
    const [updatedProfile] = await db
      .update(schema.profiles)
      .set({
        verificationStatus: "UNDER_REVIEW",
        onboardingCompleted: true,
        onboardingStep: 6,
        reviewFeedback: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.userId, userId))
      .returning();

    // Log verification state transition
    await db.insert(schema.verificationLogs).values({
      id: `vlog_${crypto.randomUUID()}`,
      hostId: userId,
      previousStatus: prevStatus,
      newStatus: "UNDER_REVIEW",
      action: "SUBMIT",
      notes: "Host submitted complete onboarding and KYC dossier for admin review.",
    });

    // Send confirmation email to host
    const { sendEmail, hostApplicationSubmittedEmail } = await import("../notifications/notifications.service");
    sendEmail(
      hostApplicationSubmittedEmail({
        hostName: user.firstName,
        hostEmail: user.email,
      })
    ).catch((e) => console.warn("[Host] Failed to send onboarding submission confirmation:", e));

    return {
      success: true,
      message: "Application submitted successfully! Your credentials are now under review.",
      profile: updatedProfile,
    };
  },

  async getPropertyAvailability(userId: string, propertyId: string) {
    const db = getDb();

    const [property] = await db
      .select({ id: schema.properties.id, title: schema.properties.title, hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    const blocks = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.propertyId, propertyId))
      .orderBy(desc(schema.availabilityBlocks.startDate));

    const enriched = await Promise.all(
      blocks.map(async (block) => {
        if (!block.bookingId) {
          return {
            ...block,
            isReservation: false,
            booking: null,
          };
        }

        const [booking] = await db
          .select({
            id: schema.bookings.id,
            referenceCode: schema.bookings.referenceCode,
            guestFirstName: schema.bookings.guestFirstName,
            guestLastName: schema.bookings.guestLastName,
            guestCount: schema.bookings.guestCount,
            status: schema.bookings.status,
          })
          .from(schema.bookings)
          .where(eq(schema.bookings.id, block.bookingId))
          .limit(1);

        return {
          ...block,
          isReservation: true,
          booking: booking || null,
        };
      })
    );

    return {
      property: {
        id: property.id,
        title: property.title,
      },
      blocks: enriched,
    };
  },

  async blockPropertyDates(
    userId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
    notes?: string
  ) {
    const db = getDb();

    const [property] = await db
      .select({ id: schema.properties.id, hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err: any = new Error("Invalid date format. Expected YYYY-MM-DD.");
      err.statusCode = 400;
      throw err;
    }

    if (end <= start) {
      const err: any = new Error("End date must be after start date.");
      err.statusCode = 400;
      throw err;
    }

    // Verify no collision with active confirmed or pending reservations
    const conflicts = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.propertyId, propertyId),
          and(
            lt(schema.availabilityBlocks.startDate, endDate),
            gt(schema.availabilityBlocks.endDate, startDate)
          )
        )
      );

    const activeReservations = conflicts.filter((c) => c.type === "RESERVATION" || c.bookingId);
    if (activeReservations.length > 0) {
      const err: any = new Error("Cannot block dates that contain active guest reservations.");
      err.statusCode = 409;
      err.code = "ACTIVE_RESERVATION_CONFLICT";
      throw err;
    }

    const blockId = `block_${crypto.randomUUID()}`;
    const [newBlock] = await db
      .insert(schema.availabilityBlocks)
      .values({
        id: blockId,
        propertyId,
        startDate,
        endDate,
        type: "BLOCKED",
      })
      .returning();

    return {
      success: true,
      message: "Dates successfully blocked.",
      block: newBlock,
    };
  },

  async unblockPropertyDates(userId: string, propertyId: string, blockId: string) {
    const db = getDb();

    const [property] = await db
      .select({ id: schema.properties.id, hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    const [block] = await db
      .select()
      .from(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.id, blockId),
          eq(schema.availabilityBlocks.propertyId, propertyId)
        )
      )
      .limit(1);

    if (!block) {
      const err: any = new Error("Availability block not found.");
      err.statusCode = 404;
      throw err;
    }

    if (block.type === "RESERVATION" || block.bookingId) {
      const err: any = new Error("Cannot unblock active guest reservations. Active bookings must be managed via cancellations.");
      err.statusCode = 400;
      throw err;
    }

    await db
      .delete(schema.availabilityBlocks)
      .where(eq(schema.availabilityBlocks.id, blockId));

    return {
      success: true,
      message: "Dates successfully unblocked and returned to inventory.",
      blockId,
    };
  },

  async unpublishProperty(userId: string, propertyId: string) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    if (property.moderationStatus === "SUSPENDED" || property.status === "SUSPENDED") {
      const err: any = new Error("This property was suspended by platform administrators. Please contact support.");
      err.statusCode = 403;
      throw err;
    }

    const [updated] = await db
      .update(schema.properties)
      .set({
        status: "DRAFT",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, propertyId))
      .returning();

    return {
      success: true,
      message: "Property listing unpublished and set to Draft. It is no longer visible on the marketplace.",
      property: updated,
    };
  },

  /**
   * Soft-archive when booking/payment/payout/refund/ledger history exists.
   * Hard-delete only empty listings with no financial or booking history.
   * Never cascades bookings, payments, payouts, refunds, or ledger rows.
   */
  async deleteProperty(
    userId: string,
    propertyId: string,
    confirmWithReservations = false,
    options: { ipAddress?: string; mode?: "archive" | "delete" } = {}
  ) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    if (property.status === PROPERTY_STATUS.ARCHIVED) {
      return {
        success: true,
        action: "archive" as const,
        message: "Property is already archived and hidden from the marketplace.",
        property,
      };
    }

    const history = await this.getPropertyFinancialHistory(propertyId);
    const todayStr = new Date().toISOString().split("T")[0];
    const upcomingBookings = await db
      .select({
        id: schema.bookings.id,
        referenceCode: schema.bookings.referenceCode,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        status: schema.bookings.status,
      })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.propertyId, propertyId),
          inArray(schema.bookings.status, [
            BOOKING_STATUS.PENDING_HOST,
            BOOKING_STATUS.PAYMENT_PENDING,
            BOOKING_STATUS.CONFIRMED,
            "PENDING",
          ]),
          gte(schema.bookings.checkOutDate, todayStr)
        )
      );

    const mustArchive = history.hasHistory;
    const requestedMode = options.mode || (mustArchive ? "archive" : "delete");

    if (upcomingBookings.length > 0 && !confirmWithReservations) {
      const err: any = new Error(
        `This listing has ${upcomingBookings.length} upcoming or active reservation(s). Archiving hides it from the marketplace but keeps all bookings and financial history intact.`
      );
      err.statusCode = 409;
      err.requiresConfirmation = true;
      err.upcomingCount = upcomingBookings.length;
      err.action = "archive";
      err.hasFinancialHistory = mustArchive;
      throw err;
    }

    if (mustArchive || requestedMode === "archive") {
      const [archived] = await db
        .update(schema.properties)
        .set({
          status: PROPERTY_STATUS.ARCHIVED,
          updatedAt: new Date(),
        })
        .where(eq(schema.properties.id, propertyId))
        .returning();

      // Remove only future host-created blocks (not reservation-linked inventory)
      await db
        .delete(schema.availabilityBlocks)
        .where(
          and(
            eq(schema.availabilityBlocks.propertyId, propertyId),
            eq(schema.availabilityBlocks.type, "MANUAL_BLOCK"),
            gte(schema.availabilityBlocks.startDate, todayStr)
          )
        );

      await db.insert(schema.auditLogs).values({
        id: `audit_${crypto.randomUUID()}`,
        userId,
        action: "PROPERTY_ARCHIVED",
        entityType: "property",
        entityId: propertyId,
        details: JSON.stringify({
          title: property.title,
          previousStatus: property.status,
          bookingCount: history.bookingCount,
          paymentCount: history.paymentCount,
          payoutCount: history.payoutCount,
          refundCount: history.refundCount,
          upcomingReservations: upcomingBookings.length,
          reason: "Host archive — financial/booking history preserved",
        }),
        ipAddress: options.ipAddress || null,
      });

      return {
        success: true,
        action: "archive" as const,
        message:
          "Listing archived and hidden from the marketplace. Bookings, payments, payouts, refunds, and ledger history were preserved.",
        property: archived,
        historyPreserved: {
          bookings: history.bookingCount,
          payments: history.paymentCount,
          payouts: history.payoutCount,
          refunds: history.refundCount,
        },
      };
    }

    // Empty listing: hard-delete only orphan marketing assets (no booking/finance rows)
    await db.delete(schema.propertyPrivateDetails).where(eq(schema.propertyPrivateDetails.propertyId, propertyId));
    await db.delete(schema.propertyImages).where(eq(schema.propertyImages.propertyId, propertyId));
    await db.delete(schema.propertyAmenities).where(eq(schema.propertyAmenities.propertyId, propertyId));
    await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.propertyId, propertyId));
    await db.delete(schema.reviews).where(eq(schema.reviews.propertyId, propertyId));
    await db.delete(schema.properties).where(eq(schema.properties.id, propertyId));

    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId,
      action: "PROPERTY_DELETED",
      entityType: "property",
      entityId: propertyId,
      details: JSON.stringify({
        title: property.title,
        previousStatus: property.status,
        reason: "Hard delete of empty listing with no booking/financial history",
      }),
      ipAddress: options.ipAddress || null,
    });

    return {
      success: true,
      action: "delete" as const,
      message: "Empty listing permanently deleted (no booking or financial history existed).",
    };
  },

  async getPropertyFinancialHistory(propertyId: string) {
    const db = getDb();
    const bookings = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(eq(schema.bookings.propertyId, propertyId));
    const bookingIds = bookings.map((b) => b.id);

    let paymentCount = 0;
    let payoutCount = 0;
    let refundCount = 0;
    let hostEarningsCount = 0;

    if (bookingIds.length > 0) {
      const [payments] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.payments)
        .where(inArray(schema.payments.bookingId, bookingIds));
      const [payouts] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.payouts)
        .where(inArray(schema.payouts.bookingId, bookingIds));
      const [refunds] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.refunds)
        .where(inArray(schema.refunds.bookingId, bookingIds));
      const [earnings] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.hostEarnings)
        .where(inArray(schema.hostEarnings.bookingId, bookingIds));
      paymentCount = payments?.count || 0;
      payoutCount = payouts?.count || 0;
      refundCount = refunds?.count || 0;
      hostEarningsCount = earnings?.count || 0;
    }

    return {
      bookingCount: bookings.length,
      paymentCount,
      payoutCount,
      refundCount,
      hostEarningsCount,
      hasHistory:
        bookings.length > 0 ||
        paymentCount > 0 ||
        payoutCount > 0 ||
        refundCount > 0 ||
        hostEarningsCount > 0,
    };
  },

  /**
   * Occupancy = booked nights (CONFIRMED/COMPLETED overlapping window)
   * / available nights in window (calendar days × active listings).
   * Host MANUAL_BLOCK nights are excluded from the denominator.
   */
  async getOccupancyMetrics(userId: string, propIds?: string[]) {
    const db = getDb();
    const ids =
      propIds ||
      (
        await db
          .select({ id: schema.properties.id })
          .from(schema.properties)
          .where(
            and(
              eq(schema.properties.hostId, userId),
              ne(schema.properties.status, PROPERTY_STATUS.ARCHIVED)
            )
          )
      ).map((p) => p.id);

    const windowDays = 30;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + windowDays);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    if (ids.length === 0) {
      return {
        windowDays,
        startDate: startStr,
        endDate: endStr,
        listingCount: 0,
        availableNights: 0,
        bookedNights: 0,
        blockedNights: 0,
        occupancyRate: 0,
        formula:
          "occupancyRate = bookedNights / max(1, availableNights) where availableNights = (windowDays × activeListings) − manualBlockNights; bookedNights = nights from CONFIRMED/COMPLETED stays overlapping the window",
      };
    }

    const bookings = await db
      .select({
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        status: schema.bookings.status,
      })
      .from(schema.bookings)
      .where(
        and(
          inArray(schema.bookings.propertyId, ids),
          inArray(schema.bookings.status, [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED]),
          lt(schema.bookings.checkInDate, endStr),
          gt(schema.bookings.checkOutDate, startStr)
        )
      );

    const blocks = await db
      .select({
        startDate: schema.availabilityBlocks.startDate,
        endDate: schema.availabilityBlocks.endDate,
        type: schema.availabilityBlocks.type,
      })
      .from(schema.availabilityBlocks)
      .where(
        and(
          inArray(schema.availabilityBlocks.propertyId, ids),
          eq(schema.availabilityBlocks.type, "MANUAL_BLOCK"),
          lt(schema.availabilityBlocks.startDate, endStr),
          gt(schema.availabilityBlocks.endDate, startStr)
        )
      );

    const countOverlapNights = (rangeStart: string, rangeEnd: string) => {
      const s = new Date(Math.max(new Date(rangeStart).getTime(), start.getTime()));
      const e = new Date(Math.min(new Date(rangeEnd).getTime(), end.getTime()));
      const nights = Math.round((e.getTime() - s.getTime()) / 86400000);
      return nights > 0 ? nights : 0;
    };

    let bookedNights = 0;
    for (const b of bookings) {
      bookedNights += countOverlapNights(b.checkInDate, b.checkOutDate);
    }

    let blockedNights = 0;
    for (const block of blocks) {
      blockedNights += countOverlapNights(block.startDate, block.endDate);
    }

    const capacityNights = windowDays * ids.length;
    const availableNights = Math.max(0, capacityNights - blockedNights);
    const occupancyRate =
      availableNights > 0 ? Math.round((bookedNights / availableNights) * 1000) / 1000 : 0;

    return {
      windowDays,
      startDate: startStr,
      endDate: endStr,
      listingCount: ids.length,
      availableNights,
      bookedNights,
      blockedNights,
      occupancyRate,
      formula:
        "occupancyRate = bookedNights / max(1, availableNights) where availableNights = (windowDays × activeListings) − manualBlockNights; bookedNights = nights from CONFIRMED/COMPLETED stays overlapping the window",
    };
  },

  async getHostAlerts(userId: string, propIds?: string[]) {
    const db = getDb();
    const alerts: Array<{
      id: string;
      type: string;
      severity: "info" | "warning" | "action";
      title: string;
      body: string;
      href?: string;
      createdAt: string;
    }> = [];

    const ids =
      propIds ||
      (
        await db
          .select({ id: schema.properties.id })
          .from(schema.properties)
          .where(eq(schema.properties.hostId, userId))
      ).map((p) => p.id);

    if (ids.length > 0) {
      const pendingHost = await db
        .select({
          id: schema.bookings.id,
          referenceCode: schema.bookings.referenceCode,
          hostResponseDeadlineAt: schema.bookings.hostResponseDeadlineAt,
          guestFirstName: schema.bookings.guestFirstName,
          createdAt: schema.bookings.createdAt,
        })
        .from(schema.bookings)
        .where(
          and(
            inArray(schema.bookings.propertyId, ids),
            eq(schema.bookings.status, BOOKING_STATUS.PENDING_HOST)
          )
        )
        .orderBy(desc(schema.bookings.createdAt))
        .limit(10);

      for (const b of pendingHost) {
        alerts.push({
          id: `alert_req_${b.id}`,
          type: "HOST_REQUEST_RECEIVED",
          severity: "action",
          title: "Booking request waiting for you",
          body: `${b.guestFirstName || "Guest"} · ${b.referenceCode}. Accept or decline before the deadline ends.`,
          href: "/host/dashboard?tab=bookings",
          createdAt: (b.createdAt || new Date()).toISOString(),
        });
      }
    }

    const [profile] = await db
      .select({
        verificationStatus: schema.profiles.verificationStatus,
        bankAccountVerifiedAt: schema.profiles.bankAccountVerifiedAt,
        bankAccountNumber: schema.profiles.bankAccountNumber,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (profile && profile.verificationStatus !== "APPROVED") {
      const verificationLabel = (() => {
        switch ((profile.verificationStatus || "").toUpperCase()) {
          case "UNDER_REVIEW":
            return "Identity under review"
          case "REJECTED":
          case "NEEDS_MORE_INFO":
            return "More information needed"
          case "PROFILE_COMPLETED":
          case "REGISTERED":
            return "Identity verification incomplete"
          default:
            return "Identity verification incomplete"
        }
      })()
      alerts.push({
        id: "alert_kyc",
        type: "KYC_STATUS",
        severity: "warning",
        title: verificationLabel,
        body: "Complete identity verification before you can publish listings.",
        href: "/host/onboarding/status",
        createdAt: new Date().toISOString(),
      });
    }

    if (!profile?.bankAccountVerifiedAt || !profile?.bankAccountNumber) {
      alerts.push({
        id: "alert_bank",
        type: "PAYOUT_ACCOUNT",
        severity: "info",
        title: "Add a payout bank account",
        body: "Withdrawals need a verified Nigerian bank account. Saving an account does not send money by itself.",
        href: "/host/dashboard?tab=financials",
        createdAt: new Date().toISOString(),
      });
    }

    try {
      const inbox = await db
        .select({
          id: schema.notificationInbox.id,
          title: schema.notificationInbox.title,
          body: schema.notificationInbox.body,
          eventType: schema.notificationInbox.eventType,
          deepLink: schema.notificationInbox.deepLink,
          createdAt: schema.notificationInbox.createdAt,
          readAt: schema.notificationInbox.readAt,
        })
        .from(schema.notificationInbox)
        .where(
          and(
            eq(schema.notificationInbox.userId, userId),
            sql`${schema.notificationInbox.readAt} IS NULL`
          )
        )
        .orderBy(desc(schema.notificationInbox.createdAt))
        .limit(5);

      for (const n of inbox) {
        if (!n.eventType?.startsWith("HOST_") && !n.eventType?.includes("BOOKING")) continue;
        alerts.push({
          id: `alert_inbox_${n.id}`,
          type: n.eventType || "INBOX",
          severity: "info",
          title: n.title,
          body: n.body || "",
          href: n.deepLink || "/notifications",
          createdAt: (n.createdAt || new Date()).toISOString(),
        });
      }
    } catch {
      // notification_inbox may be absent on drifted environments
    }

    return alerts;
  },

  async reorderPropertyMedia(
    userId: string,
    propertyId: string,
    orderedImageIds: string[],
    coverImageId?: string
  ) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    const images = await db
      .select()
      .from(schema.propertyImages)
      .where(eq(schema.propertyImages.propertyId, propertyId));

    if (images.length === 0) {
      const err: any = new Error("No media to reorder");
      err.statusCode = 400;
      throw err;
    }

    const imageIds = new Set(images.map((img) => img.id));
    if (orderedImageIds.length !== images.length || orderedImageIds.some((id) => !imageIds.has(id))) {
      const err: any = new Error("orderedImageIds must include every image for this property exactly once");
      err.statusCode = 400;
      throw err;
    }

    for (let i = 0; i < orderedImageIds.length; i++) {
      await db
        .update(schema.propertyImages)
        .set({ displayOrder: i })
        .where(eq(schema.propertyImages.id, orderedImageIds[i]));
    }

    const coverId = coverImageId || orderedImageIds[0];
    const cover = images.find((img) => img.id === coverId);
    if (!cover) {
      const err: any = new Error("coverImageId must belong to this property");
      err.statusCode = 400;
      throw err;
    }

    const [updated] = await db
      .update(schema.properties)
      .set({ coverImage: cover.url, updatedAt: new Date() })
      .where(eq(schema.properties.id, propertyId))
      .returning();

    const ordered = await db
      .select()
      .from(schema.propertyImages)
      .where(eq(schema.propertyImages.propertyId, propertyId))
      .orderBy(asc(schema.propertyImages.displayOrder));

    return {
      success: true,
      property: updated,
      images: ordered,
      message: "Media order and cover image saved.",
    };
  },

  async getPayoutAccount(userId: string) {
    const db = getDb();
    const [profile] = await db
      .select({
        bankName: schema.profiles.bankName,
        bankCode: schema.profiles.bankCode,
        bankAccountNumber: schema.profiles.bankAccountNumber,
        bankAccountName: schema.profiles.bankAccountName,
        bankAccountVerifiedAt: schema.profiles.bankAccountVerifiedAt,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId))
      .limit(1);

    if (!profile || !profile.bankAccountNumber) {
      return { hasAccount: false, account: null };
    }

    return {
      hasAccount: true,
      account: {
        bankName: profile.bankName,
        bankCode: profile.bankCode,
        accountNumberMasked: maskAccountNumber(profile.bankAccountNumber),
        accountName: profile.bankAccountName,
        verifiedAt: profile.bankAccountVerifiedAt,
      },
    };
  },

  async updatePayoutAccount(
    userId: string,
    body: { bankCode: string; accountNumber: string },
    ipAddress?: string
  ) {
    return BankResolutionService.updateHostPayoutAccount(
      userId,
      {
        bankCode: String(body.bankCode).trim(),
        accountNumber: String(body.accountNumber).trim(),
      },
      ipAddress || "unknown-ip"
    );
  },

  async relistProperty(userId: string, propertyId: string) {
    const db = getDb();
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.hostId, userId)))
      .limit(1);

    if (!property) {
      const err: any = new Error("Property not found or unauthorized");
      err.statusCode = 404;
      throw err;
    }

    // Host must be verified and approved
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (user?.role !== "admin") {
      const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
      if (!profile || !profile.isVerified || profile.verificationStatus !== "APPROVED") {
        const err: any = new Error("Your host verification must be approved before you can relist properties.");
        err.statusCode = 403;
        throw err;
      }
    }

    if (property.status === "SUSPENDED" || property.moderationStatus === "SUSPENDED") {
      const err: any = new Error("This property was suspended by platform administrators and cannot be self-relisted. Please contact support.");
      err.statusCode = 403;
      throw err;
    }

    if (property.status === PROPERTY_STATUS.ARCHIVED) {
      // Archived listings may be relisted once KYC gates pass (checked above)
    }

    // Ensure property has minimum required content to be published
    if (!property.title || property.title.trim().length < 3) {
      const err: any = new Error("Property title must have at least 3 characters before relisting.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Release any expired reservation blocks so dates are open again
    const todayStr = new Date().toISOString().split("T")[0];
    await db
      .delete(schema.availabilityBlocks)
      .where(
        and(
          eq(schema.availabilityBlocks.propertyId, propertyId),
          lt(schema.availabilityBlocks.endDate, todayStr)
        )
      );

    // 2. Set property status back to PUBLISHED
    const [updated] = await db
      .update(schema.properties)
      .set({
        status: "PUBLISHED",
        moderationStatus: "NONE",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, propertyId))
      .returning();

    return {
      success: true,
      message: "Property relisted successfully and published back to explore listings!",
      property: updated,
    };
  },
};
