import { FastifyInstance } from "fastify";
import { authorizeBookingView, bookingsService, presentGuestCreateResult } from "./bookings.service";
import { authenticateRequest, extractSession } from "../../lib/security";
import { clientIp, consumeRateLimitAsync } from "../../lib/rate-limit";

const assertCronOrAdmin = async (request: any, reply: any): Promise<boolean> => {
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_JOB_SECRET;
  const provided =
    (request.headers["x-cron-secret"] as string | undefined) ||
    (request.headers["x-internal-job-secret"] as string | undefined) ||
    (request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : undefined);

  if (cronSecret && provided && provided === cronSecret) {
    return true;
  }

  const session = extractSession(request);
  if (session?.role === "admin") {
    return true;
  }

  reply.status(401).send({ error: "Unauthorized: admin session or CRON_SECRET required." });
  return false;
};

export async function bookingsRoutes(fastify: FastifyInstance) {
  // POST /api/bookings — Create reservation request (PENDING_HOST; no Paystack)
  fastify.post("/", async (request, reply) => {
    const limit = await consumeRateLimitAsync(
      `booking-create:${clientIp(request)}`,
      12,
      10 * 60 * 1000,
      "strict"
    );
    if (!limit.ok) {
      const status = limit.backend === "reject" ? 503 : 429;
      reply.header("Retry-After", String(limit.retryAfterSec || 30));
      return reply.status(status).send({
        error:
          status === 503
            ? "Security checks temporarily unavailable. Try again shortly."
            : "Too many booking requests. Try again shortly.",
        retryAfterSec: limit.retryAfterSec,
        retryable: true,
      });
    }
    try {
      const session = extractSession(request);
      const result = await bookingsService.createBooking(request.body, session);
      return reply.status(201).send(presentGuestCreateResult(result));
    } catch (error: any) {
      if (error.issues) {
        return reply.status(400).send({ error: error.issues[0]?.message || "Validation failed" });
      }
      const status = error.statusCode || (
        error.message.includes("not found") ? 404
        : error.message.includes("available") ? 409
        : 400
      );
      return reply.status(status).send({ error: error.message, code: error.code });
    }
  });

  // POST /api/bookings/:id/accept — Host accept → PAYMENT_PENDING
  fastify.post("/:id/accept", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };

    try {
      const result = await bookingsService.acceptBooking(id, session.userId);
      return reply.send({
        success: true,
        booking: result.booking,
        paymentDeadlineAt: result.paymentDeadlineAt,
        idempotent: result.idempotent,
      });
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message, code: error.code });
    }
  });

  // POST /api/bookings/:id/decline — Host decline → CANCELLED
  fastify.post("/:id/decline", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    try {
      const result = await bookingsService.declineBooking(id, session.userId, reason);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message, code: error.code });
    }
  });

  // POST /api/bookings/expire-due — Secured cron/admin expiration
  fastify.post("/expire-due", async (request, reply) => {
    const ok = await assertCronOrAdmin(request, reply);
    if (!ok) return;

    try {
      const { limit } = (request.body || {}) as { limit?: number };
      const result = await bookingsService.expireDueBookings(limit || 100);
      return reply.send({ success: true, ...result });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/bookings/availability — Check date range availability for a property
  fastify.get("/availability", async (request, reply) => {
    const query = request.query as {
      propertyId?: string;
      checkIn?: string;
      checkOut?: string;
    };

    if (!query.propertyId || !query.checkIn || !query.checkOut) {
      return reply.status(400).send({ error: "Missing required query parameters: propertyId, checkIn, checkOut." });
    }

    try {
      const result = await bookingsService.checkAvailability(
        query.propertyId,
        query.checkIn,
        query.checkOut
      );
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /api/bookings/reminders/process — Process upcoming arrival reminders
  fastify.post("/reminders/process", async (request, reply) => {
    const ok = await assertCronOrAdmin(request, reply);
    if (!ok) return;
    try {
      const { date } = (request.body || {}) as { date?: string };
      const result = await bookingsService.processUpcomingArrivalReminders(date);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST /api/bookings/:id/confirm-check-in — Guest confirms arrival (Phase 7)
  fastify.post("/:id/confirm-check-in", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { accessToken?: string };
    const headerToken = request.headers["x-access-token"] as string | undefined;
    const session = extractSession(request);
    const accessToken = body.accessToken || headerToken;

    if (!session?.userId && !accessToken) {
      return reply.status(401).send({ error: "Authentication or booking access token required." });
    }

    try {
      const result = await bookingsService.confirmGuestCheckIn(
        id,
        { userId: session?.userId || null, accessToken: accessToken || null },
        { ipAddress: request.ip }
      );
      return reply.send(result);
    } catch (error: any) {
      return reply
        .status(error.statusCode || 400)
        .send({ error: error.message, code: error.code });
    }
  });

  // POST /api/bookings/:id/cancel — Cancel booking & release date lock
  fastify.post("/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { accessToken, reason } = (request.body || {}) as { accessToken?: string; reason?: string };
    const headerToken = request.headers["x-access-token"] as string | undefined;
    const session = extractSession(request);

    const tokenOrUserId = accessToken || headerToken || session?.userId;
    if (!tokenOrUserId) {
      return reply.status(401).send({ error: "Authentication or booking access token required." });
    }

    try {
      const result = await bookingsService.cancelBooking(id, tokenOrUserId, reason);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({
        error: error.message,
        code: error.code,
        refund: error.refund || undefined,
        bookingStatus: error.bookingStatus || undefined,
      });
    }
  });

  // POST /api/bookings/:id/pay — DECOMMISSIONED (P0 Security Remediation)
  // Direct payment bypass is permanently disabled. Payments must be initialized via /api/payments/initialize
  // and authoritatively verified through Paystack gateway / webhooks.
  fastify.post("/:id/pay", async (_request, reply) => {
    return reply.status(410).send({
      error: "Endpoint decommissioned. Direct payment bypassing Paystack is forbidden. All payments must be verified via Paystack gateway.",
    });
  });

  // GET /api/bookings/:id/similar — Similar stays after decline/expire (never auto-book)
  fastify.get("/:id/similar", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    try {
      const result = await bookingsService.findSimilarProperties(
        id,
        query.limit ? Number(query.limit) : 8
      );
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 404).send({ error: error.message });
    }
  });

  // GET /api/bookings/:id — Get booking details (+ recovery metadata)
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { token?: string; accessToken?: string; email?: string };
    const headerToken = request.headers["x-access-token"] as string | undefined;
    const session = extractSession(request);
    try {
      const result = await bookingsService.getBooking(id);
      const safe = authorizeBookingView(result, {
        userId: session?.userId || null,
        role: session?.role || null,
        accessToken: query.token || query.accessToken || headerToken || null,
        email: query.email || null,
      });
      return reply.send(safe);
    } catch (error: any) {
      return reply.status(error.statusCode || 404).send({ error: error.message });
    }
  });

  // GET /api/bookings — List authenticated user's bookings
  fastify.get("/", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await bookingsService.getUserBookings(session.userId, request.query as any);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/bookings/:id/contact — ordinary stay details / arrival notes
  fastify.get("/:id/contact", async (request: any, reply: any) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const result = await bookingsService.getBookingContact(id, session.userId);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 404).send({ error: error.message });
    }
  });
}
