import { z } from "zod";
import { eq, and, desc, inArray, lt, gt } from "drizzle-orm";
import crypto from "crypto";
import { getDb, schema } from "../../db/client";

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
});

export const UpdateHostPropertySchema = HostPropertyDraftSchema.partial();

export const hostsService = {
  async createProperty(userId: string, data: any) {
    const parsed = HostPropertyDraftSchema.parse(data || {});
    const db = getDb();

    // Auto-upgrade user role to host if guest
    await db
      .update(schema.users)
      .set({ role: "host" })
      .where(and(eq(schema.users.id, userId), eq(schema.users.role, "guest")));

    const baseTitle = parsed.title || "Untitled Property";
    const slug = `${baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomBytes(4).toString("hex")}`;
    const propertyId = `prop_${crypto.randomUUID()}`;

    // Get user info for default contact
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);

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
        pricePerNight: parsed.pricePerNight || 15000,
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
      contactEmail: parsed.contactEmail || user?.email || "host@ile.ng",
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

    if (property.status === "SUSPENDED") {
      throw new Error("Cannot update suspended property");
    }

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
    if (property.status === "PUBLISHED") throw new Error("This property is already published.");
    if (property.status === "SUSPENDED") throw new Error("This property is suspended.");

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
    if (!property.pricePerNight || property.pricePerNight < 5000) {
      missingFields.push("Price per night (minimum ₦5,000)");
    }
    if (images.length === 0 && (!property.coverImage || property.coverImage === "/images/placeholder-property.jpg")) {
      missingFields.push("At least one property photo");
    }

    if (missingFields.length > 0) {
      const err: any = new Error("Please complete all required fields before submitting for review.");
      err.missingFields = missingFields;
      err.statusCode = 400;
      throw err;
    }

    const [updated] = await db
      .update(schema.properties)
      .set({
        status: "PENDING_REVIEW",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, propertyId))
      .returning();

    // Trigger host submission receipt email via Resend
    import("../notifications/notifications.service").then(async ({ sendEmail, hostPropertySubmittedEmail }) => {
      const [host] = await db
        .select({ email: schema.users.email, firstName: schema.users.firstName })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (host) {
        sendEmail(
          hostPropertySubmittedEmail({
            hostName: host.firstName,
            hostEmail: host.email,
            propertyTitle: updated.title,
            propertyId: updated.id,
          })
        ).catch((e) => console.warn("[Host] Failed to send submission email:", e));
      }
    });

    return {
      success: true,
      message: "Property submitted for review. An administrator will review your listing shortly.",
      property: updated,
    };
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
      .where(eq(schema.propertyImages.propertyId, propertyId));

    const amenities = await db
      .select()
      .from(schema.propertyAmenities)
      .where(eq(schema.propertyAmenities.propertyId, propertyId));

    return {
      property,
      privateDetails,
      images: images.map((img) => img.url),
      amenities: amenities.map((a) => a.name),
    };
  },

  async getDashboard(userId: string) {
    const db = getDb();
    const properties = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, userId));

    const totalProperties = properties.length;
    const published = properties.filter((p) => p.status === "PUBLISHED").length;
    const pending = properties.filter((p) => p.status === "PENDING_REVIEW" || p.status === "PENDING").length;
    const drafts = properties.filter((p) => p.status === "DRAFT").length;
    const rejected = properties.filter((p) => p.status === "REJECTED").length;

    const propIds = properties.map((p) => p.id);
    let totalGross = 0;
    let totalNet = 0;
    let recentBookings: any[] = [];

    if (propIds.length > 0) {
      const bookings = await db
        .select()
        .from(schema.bookings)
        .where(inArray(schema.bookings.propertyId, propIds))
        .orderBy(desc(schema.bookings.createdAt))
        .limit(10);

      const paidBookings = bookings.filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED");

      for (const b of paidBookings) {
        totalGross += b.totalAmount;
        totalNet += b.totalAmount - b.serviceFee;
      }

      recentBookings = bookings;
    }

    return {
      totalProperties,
      published,
      pending,
      drafts,
      rejected,
      properties,
      recentBookings,
      earnings: {
        totalGross,
        totalNet,
      },
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
        totalAmount: schema.bookings.totalAmount,
        status: schema.bookings.status,
        createdAt: schema.bookings.createdAt,
      })
      .from(schema.bookings)
      .where(inArray(schema.bookings.propertyId, propIds))
      .orderBy(desc(schema.bookings.createdAt));

    const enriched = bookingsList.map((b) => {
      const prop = props.find((p) => p.id === b.propertyId);
      return {
        ...b,
        propertyTitle: prop?.title || "Property",
        propertyCity: prop?.city || "Nigeria",
      };
    });

    return { bookings: enriched };
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

  async deleteProperty(userId: string, propertyId: string) {
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

    // Guard against deleting property with active bookings
    const activeBookings = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.propertyId, propertyId),
          inArray(schema.bookings.status, ["CONFIRMED", "COMPLETED", "PAYMENT_PENDING"])
        )
      )
      .limit(1);

    if (activeBookings.length > 0) {
      const err: any = new Error("Cannot delete property with active or pending reservations.");
      err.statusCode = 400;
      throw err;
    }

    await db.delete(schema.propertyPrivateDetails).where(eq(schema.propertyPrivateDetails.propertyId, propertyId));
    await db.delete(schema.propertyImages).where(eq(schema.propertyImages.propertyId, propertyId));
    await db.delete(schema.propertyAmenities).where(eq(schema.propertyAmenities.propertyId, propertyId));
    await db.delete(schema.availabilityBlocks).where(eq(schema.availabilityBlocks.propertyId, propertyId));
    await db.delete(schema.properties).where(eq(schema.properties.id, propertyId));

    return { success: true, message: "Property listing deleted successfully." };
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

    if (property.status === "SUSPENDED") {
      const err: any = new Error("This property was suspended by platform administrators and cannot be self-relisted.");
      err.statusCode = 403;
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
