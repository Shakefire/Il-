import { FastifyInstance } from "fastify";
import { bookingsService } from "./bookings.service";
import { authenticateRequest, extractSession } from "../../lib/security";

export async function bookingsRoutes(fastify: FastifyInstance) {
  // POST /api/bookings — Create booking (guest checkout supported)
  fastify.post("/", async (request, reply) => {
    try {
      const session = extractSession(request);
      const result = await bookingsService.createBooking(request.body, session);
      return reply.status(201).send(result);
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

  // POST /api/bookings/:id/cancel — Cancel booking & release date lock
  fastify.post("/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { accessToken } = (request.body || {}) as { accessToken?: string };
    const headerToken = request.headers["x-access-token"] as string | undefined;
    const session = extractSession(request);

    const tokenOrUserId = accessToken || headerToken || session?.userId;
    if (!tokenOrUserId) {
      return reply.status(401).send({ error: "Authentication or booking access token required." });
    }

    try {
      const result = await bookingsService.cancelBooking(id, tokenOrUserId);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message });
    }
  });

  // POST /api/bookings/:id/pay — Process payment (legacy / fallback)
  fastify.post("/:id/pay", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { method, accessToken } = (request.body || {}) as { method?: string; accessToken?: string };

    const headerToken = request.headers["x-access-token"] as string | undefined;
    const providedAccessToken = accessToken || headerToken;

    let isAuthorized = false;

    if (providedAccessToken) {
      try {
        const bookingData = await bookingsService.getBooking(id);
        if (bookingData.booking.accessToken === providedAccessToken) {
          isAuthorized = true;
        }
      } catch { /* booking not found */ }
    }

    if (!isAuthorized) {
      const session = extractSession(request);
      if (session) {
        try {
          const bookingData = await bookingsService.getBooking(id);
          if (session.userId === bookingData.booking.guestId || session.role === "admin") {
            isAuthorized = true;
          }
        } catch { /* booking not found */ }
      }
    }

    if (!isAuthorized) {
      return reply.status(401).send({ error: "Unauthorized: Provide a valid access token or log in." });
    }

    try {
      const result = await bookingsService.processPayment(id, method || "CARD", providedAccessToken || "");
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/bookings/:id — Get booking details
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await bookingsService.getBooking(id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
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

  // GET /api/bookings/:id/contact — Get quarantined private details (Access Pass)
  fastify.get("/:id/contact", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { token: queryToken, accessToken: queryAccessToken } = request.query as { token?: string; accessToken?: string };
    const headerToken = request.headers["x-access-token"] as string | undefined;
    const providedToken = queryToken || queryAccessToken || headerToken;

    let isAuthorized = false;
    let booking: any;

    try {
      const bookingData = await bookingsService.getBooking(id);
      booking = bookingData.booking;
    } catch {
      return reply.status(404).send({ error: "Booking not found" });
    }

    // Check access token
    if (providedToken && providedToken === booking.accessToken) {
      isAuthorized = true;
    }

    // Check session
    if (!isAuthorized) {
      const session = extractSession(request);
      if (session && (session.userId === booking.guestId || session.role === "admin")) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return reply.status(401).send({ error: "Unauthorized: You do not have permission to view private details." });
    }

    // Strictly quarantined until payment is CONFIRMED
    if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
      return reply.status(403).send({
        error: "Payment required: Property address and check-in instructions are strictly quarantined until booking is CONFIRMED.",
        status: booking.status,
      });
    }

    try {
      const result = await bookingsService.getBookingContact(id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });
}
