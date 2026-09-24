import { FastifyInstance } from "fastify";
import { getDb, schema } from "../../db/client";
import { eq, and, desc, avg, count, sql } from "drizzle-orm";
import { authenticateRequest } from "../../lib/security";
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

async function createReview(
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

  // 2. Must be CONFIRMED or COMPLETED
  if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.COMPLETED) {
    return { error: "You can only review confirmed or completed bookings.", status: 400 };
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
      title: data.title ?? null,
      body: data.body ?? null,
    })
    .returning();

  // 5. Recalculate property average rating
  await recalculatePropertyRating(booking.propertyId);

  return { review, status: 201 };
}

async function recalculatePropertyRating(propertyId: string) {
  const db = getDb();

  const [stats] = await db
    .select({
      avgRating: avg(schema.reviews.overallRating),
      totalReviews: count(schema.reviews.id),
    })
    .from(schema.reviews)
    .where(eq(schema.reviews.propertyId, propertyId));

  if (stats) {
    const newRating = stats.avgRating ? parseFloat(String(stats.avgRating)) : 5.0;
    const reviewCount = Number(stats.totalReviews) || 0;

    await db
      .update(schema.properties)
      .set({
        rating: Math.round(newRating * 10) / 10,
        reviewCount,
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, propertyId));
  }
}

async function getPropertyReviews(propertyId: string, pagination: ReturnType<typeof parsePagination>) {
  const db = getDb();

  // Count total
  const [countResult] = await db
    .select({ total: count(schema.reviews.id) })
    .from(schema.reviews)
    .where(eq(schema.reviews.propertyId, propertyId));

  const total = Number(countResult?.total) || 0;

  // Fetch page
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
    .orderBy(desc(schema.reviews.createdAt))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return paginatedResponse(reviews, total, pagination);
}

// ─── Routes ───

export async function reviewsRoutes(fastify: FastifyInstance) {
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

    const [updated] = await db
      .update(schema.reviews)
      .set({
        hostResponse: parse.data.response,
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
}
