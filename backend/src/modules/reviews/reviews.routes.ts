import { FastifyInstance } from "fastify";
import { getDb, schema } from "../../db/client";
import { eq, and, desc } from "drizzle-orm";
import { authenticateRequest, requireRole } from "../../lib/security";
import { toPlainText } from "../../lib/plain-text";
import { parsePagination, paginatedResponse } from "../../lib/pagination";
import { BOOKING_STATUS } from "../../config/constants";
import { z } from "zod";
import crypto from "crypto";

// ─── Validation Schemas ───

const CreateReviewSchema = z.object({
  bookingId: z.string().min(1),
  overallRating: z.number().int().min(1).max(5),
  cleanlinessRating: z.number().int().min(1).max(5).optional(),
  accuracyRating: z.number().int().min(1).max(5).optional(),
  locationRating: z.number().int().min(1).max(5).optional(),
  valueRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  infrastructureRating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
});

const HostResponseSchema = z.object({
  response: z.string().min(1).max(1000),
});

// ─── Service Functions ───

export async function createReview(
  guestId: string,
  data: z.infer<typeof CreateReviewSchema>
) {
  const db = getDb();

  // 1. Verify booking exists and belongs to this guest
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.id, data.bookingId),
        eq(schema.bookings.guestId, guestId)
      )
    )
    .limit(1);

  if (!booking) {
    return { error: "Booking not found or does not belong to you.", status: 404 };
  }

  if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.COMPLETED) {
    return { error: "You can review a stay only after it is confirmed.", status: 400 };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (booking.checkOutDate >= today) {
    return { error: "You can review this stay after checkout.", status: 400 };
  }

  // 3. Check for existing review
  const [existingReview] = await db
    .select({ id: schema.reviews.id })
    .from(schema.reviews)
    .where(eq(schema.reviews.bookingId, data.bookingId))
    .limit(1);

  if (existingReview) {
    return { error: "You have already reviewed this booking.", status: 409 };
  }

  // 4. Insert review
  const reviewId = `rev_${crypto.randomUUID()}`;
  const [review] = await db
    .insert(schema.reviews)
    .values({
      id: reviewId,
      propertyId: booking.propertyId,
      bookingId: data.bookingId,
      guestId,
      overallRating: data.overallRating,
      cleanlinessRating: data.cleanlinessRating ?? null,
      accuracyRating: data.accuracyRating ?? null,
      locationRating: data.locationRating ?? null,
      valueRating: data.valueRating ?? null,
      communicationRating: data.communicationRating ?? null,
      infrastructureRating: data.infrastructureRating ?? null,
      title: data.title ? toPlainText(data.title, 200) : null,
      body: data.body ? toPlainText(data.body, 2000) : null,
    })
    .returning();

  // 5. Recalculate property average rating
  await recalculatePropertyRating(booking.propertyId);

  // 6. Notify host of new guest review across in-app, email, and push
  Promise.all([
    import("../notifications/notifications.service"),
    import("../notifications/orchestrator"),
  ]).then(async ([{ hostNewReviewEmail }, { notifyUserEvent }]) => {
    try {
      const [property] = await db
        .select({ title: schema.properties.title, hostId: schema.properties.hostId })
        .from(schema.properties)
        .where(eq(schema.properties.id, booking.propertyId))
        .limit(1);

      if (property) {
        const [host] = await db
          .select({ id: schema.users.id, email: schema.users.email, firstName: schema.users.firstName, phone: schema.users.phone })
          .from(schema.users)
          .where(eq(schema.users.id, property.hostId))
          .limit(1);

        const [guest] = await db
          .select({ firstName: schema.users.firstName, lastName: schema.users.lastName })
          .from(schema.users)
          .where(eq(schema.users.id, guestId))
          .limit(1);

        const guestName = guest
          ? `${guest.firstName} ${guest.lastName}`
          : `${booking.guestFirstName} ${booking.guestLastName}`.trim() || "A guest";

        if (host) {
          notifyUserEvent({
            userId: host.id,
            event: "HOST_NEW_REVIEW",
            entityType: "review",
            entityId: booking.propertyId,
            category: "review",
            channels: {
              category: "review",
              email: host.email
                ? hostNewReviewEmail({
                    hostName: host.firstName,
                    hostEmail: host.email,
                    propertyTitle: property.title,
                    guestName,
                    rating: data.overallRating,
                    reviewTitle: data.title,
                    reviewBody: data.body,
                  })
                : undefined,
              inbox: {
                userId: host.id,
                title: "New guest review received",
                body: `${guestName} left a ${data.overallRating}★ review for ${property.title}: "${data.title}"`,
                deepLink: `/host/reviews`,
              },
              push: true,
            },
          });
        }
      }
    } catch (err) {
      console.warn("[Reviews] Error dispatching host review notification:", err);
    }
  });

  return { review, status: 201 };
}

async function hiddenReviewIds(): Promise<Set<string>> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        reviewId: schema.reviewModeration.reviewId,
        status: schema.reviewModeration.status,
      })
      .from(schema.reviewModeration);
    return new Set(rows.filter((row) => row.status === "HIDDEN").map((row) => row.reviewId));
  } catch {
    return new Set();
  }
}

async function recalculatePropertyRating(propertyId: string) {
  const db = getDb();
  const hidden = await hiddenReviewIds();
  const rows = await db
    .select({ id: schema.reviews.id, overallRating: schema.reviews.overallRating })
    .from(schema.reviews)
    .where(eq(schema.reviews.propertyId, propertyId));
  const visible = rows.filter((row) => !hidden.has(row.id));
  const newRating = visible.length
    ? visible.reduce((sum, row) => sum + row.overallRating, 0) / visible.length
    : 5.0;

  await db
    .update(schema.properties)
    .set({
      rating: Math.round(newRating * 10) / 10,
      reviewCount: visible.length,
      updatedAt: new Date(),
    })
    .where(eq(schema.properties.id, propertyId));
}

export async function getPropertyReviews(propertyId: string, pagination: ReturnType<typeof parsePagination>) {
  const db = getDb();
  const hidden = await hiddenReviewIds();

  const reviews = await db
    .select({
      id: schema.reviews.id,
      overallRating: schema.reviews.overallRating,
      cleanlinessRating: schema.reviews.cleanlinessRating,
      accuracyRating: schema.reviews.accuracyRating,
      locationRating: schema.reviews.locationRating,
      valueRating: schema.reviews.valueRating,
      communicationRating: schema.reviews.communicationRating,
      infrastructureRating: schema.reviews.infrastructureRating,
      title: schema.reviews.title,
      body: schema.reviews.body,
      hostResponse: schema.reviews.hostResponse,
      hostRespondedAt: schema.reviews.hostRespondedAt,
      createdAt: schema.reviews.createdAt,
      guestFirstName: schema.users.firstName,
      guestLastName: schema.users.lastName,
      guestAvatar: schema.users.avatarUrl,
    })
    .from(schema.reviews)
    .innerJoin(schema.users, eq(schema.reviews.guestId, schema.users.id))
    .where(eq(schema.reviews.propertyId, propertyId))
    .orderBy(desc(schema.reviews.createdAt));

  const visible = reviews.filter((review) => !hidden.has(review.id));
  const page = visible.slice(pagination.offset, pagination.offset + pagination.limit);
  return paginatedResponse(page, visible.length, pagination);
}

// ─── Routes ───

export async function reviewsRoutes(fastify: FastifyInstance) {
  fastify.get("/mine", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.guestId, session.userId))
      .orderBy(desc(schema.reviews.createdAt));
    let hidden = new Set<string>();
    try {
      hidden = await hiddenReviewIds();
    } catch {
      hidden = new Set();
    }
    return reply.send({
      reviews: rows.map((row) => ({
        ...row,
        moderationStatus: hidden.has(row.id) ? "HIDDEN" : "VISIBLE",
      })),
    });
  });

  // POST /api/reviews — Create a review
  fastify.post("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const parse = CreateReviewSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.issues[0]?.message || "Validation failed" });
    }

    const result = await createReview(session.userId, parse.data);

    if (result.error) {
      return reply.status(result.status).send({ error: result.error });
    }

    return reply.status(201).send({
      success: true,
      message: "Review submitted successfully. Thank you for your feedback!",
      review: result.review,
    });
  });

  // GET /api/reviews/property/:propertyId — Get reviews for a property
  fastify.get("/property/:propertyId", async (request, reply) => {
    const { propertyId } = request.params as { propertyId: string };
    const pagination = parsePagination(request.query as Record<string, any>);

    const result = await getPropertyReviews(propertyId, pagination);

    return reply.send({
      reviews: result.data,
      pagination: result.pagination,
    });
  });

  // POST /api/reviews/:id/respond — Host responds to a review
  fastify.post("/:id/respond", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const parse = HostResponseSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.issues[0]?.message || "Validation failed" });
    }

    const db = getDb();

    // Verify review exists and host owns the property
    const [review] = await db
      .select({
        id: schema.reviews.id,
        propertyId: schema.reviews.propertyId,
        hostResponse: schema.reviews.hostResponse,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({ error: "Review not found" });
    }

    if (review.hostResponse) {
      return reply.status(409).send({ error: "You have already responded to this review." });
    }

    // Verify host owns the property
    const [property] = await db
      .select({ hostId: schema.properties.hostId })
      .from(schema.properties)
      .where(eq(schema.properties.id, review.propertyId))
      .limit(1);

    if (!property || property.hostId !== session.userId) {
      return reply.status(403).send({ error: "You can only respond to reviews on your own properties." });
    }

    const responseText = toPlainText(parse.data.response, 1000);
    if (!responseText) {
      return reply.status(400).send({ error: "Response is empty." });
    }

    const [updated] = await db
      .update(schema.reviews)
      .set({
        hostResponse: responseText,
        hostRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.reviews.id, id))
      .returning();

    return reply.send({
      success: true,
      message: "Response posted successfully.",
      review: updated,
    });
  });

  fastify.post("/:id/moderate", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { status?: string; reason?: string };
    const status = (body.status || "").toUpperCase();
    if (status !== "VISIBLE" && status !== "HIDDEN") {
      return reply.status(400).send({ error: "status must be VISIBLE or HIDDEN." });
    }
    const reason = toPlainText(body.reason || "", 1000);
    if (status === "HIDDEN" && !reason) {
      return reply.status(400).send({ error: "A reason is required to hide a review." });
    }
    const db = getDb();
    const [review] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
    if (!review) return reply.status(404).send({ error: "Review not found" });
    try {
      await db
        .insert(schema.reviewModeration)
        .values({
          reviewId: id,
          status,
          reason,
          moderatedBy: session.userId,
          moderatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.reviewModeration.reviewId,
          set: { status, reason, moderatedBy: session.userId, moderatedAt: new Date() },
        });
    } catch (err: any) {
      return reply.status(503).send({
        error: "Review moderation storage is not available. Apply migration 0010_phase3_platform.sql.",
      });
    }
    await recalculatePropertyRating(review.propertyId);
    await db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      userId: session.userId,
      action: status === "HIDDEN" ? "REVIEW_HIDDEN" : "REVIEW_RESTORED",
      entityType: "review",
      entityId: id,
      details: JSON.stringify({
        reason,
        old: { moderationStatus: status === "HIDDEN" ? "VISIBLE" : "HIDDEN" },
        new: { moderationStatus: status },
      }),
      ipAddress: request.ip,
    });
    return reply.send({ success: true, reviewId: id, moderationStatus: status });
  });
}
