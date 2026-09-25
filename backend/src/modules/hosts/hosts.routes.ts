import { FastifyInstance } from "fastify";
import { hostsService } from "./hosts.service";
import { authenticateRequest } from "../../lib/security";

export async function hostsRoutes(fastify: FastifyInstance) {
  // GET /api/host/profile — Get host profile and onboarding status
  fastify.get("/profile", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.getHostProfile(session.userId);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // PUT /api/host/profile — Update host profile / complete onboarding
  fastify.put("/profile", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.updateHostProfile(session.userId, request.body || {});
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /api/host/properties — Create new listing
  fastify.post("/properties", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.createProperty(session.userId, request.body);
      return reply.status(201).send(result);
    } catch (error: any) {
      if (error.issues) {
        return reply.status(400).send({ error: error.issues[0]?.message || "Validation failed" });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/host/properties — List host's properties
  fastify.get("/properties", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const result = await hostsService.getHostProperties(session.userId);
    return reply.send(result);
  });

  // GET /api/host/properties/:id — Get host's property with private details
  fastify.get("/properties/:id", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.getHostProperty(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // PUT /api/host/properties/:id — Update property
  fastify.put("/properties/:id", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.updateProperty(session.userId, id, request.body);
      return reply.send(result);
    } catch (error: any) {
      if (error.issues) {
        return reply.status(400).send({ error: error.issues[0]?.message || "Validation failed" });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // DELETE /api/host/properties/:id — Delete draft/unbooked property
  fastify.delete("/properties/:id", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.deleteProperty(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message });
    }
  });

  // GET /api/host/properties/:id/availability — Get property availability blocks
  fastify.get("/properties/:id/availability", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.getPropertyAvailability(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 404).send({ error: error.message });
    }
  });

  // POST /api/host/properties/:id/availability/block — Manually block date range
  fastify.post("/properties/:id/availability/block", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { startDate, endDate, notes } = (request.body || {}) as {
      startDate?: string;
      endDate?: string;
      notes?: string;
    };

    if (!startDate || !endDate) {
      return reply.status(400).send({ error: "Missing required fields: startDate and endDate." });
    }

    try {
      const result = await hostsService.blockPropertyDates(session.userId, id, startDate, endDate, notes);
      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message, code: error.code });
    }
  });

  // DELETE /api/host/properties/:id/availability/block/:blockId — Unblock date range
  fastify.delete("/properties/:id/availability/block/:blockId", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id, blockId } = request.params as { id: string; blockId: string };
    try {
      const result = await hostsService.unblockPropertyDates(session.userId, id, blockId);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message });
    }
  });

  // POST /api/host/properties/:id/submit — Submit for review
  fastify.post("/properties/:id/submit", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.submitPropertyForReview(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({
        error: error.message,
        missingFields: error.missingFields || [],
      });
    }
  });

  // POST /api/host/properties/:id/relist — Relist property
  fastify.post("/properties/:id/relist", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.relistProperty(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message });
    }
  });

  // GET /api/host/dashboard — Host dashboard
  fastify.get("/dashboard", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const result = await hostsService.getDashboard(session.userId);
    return reply.send(result);
  });

  // GET /api/host/bookings — Host's bookings ledger
  fastify.get("/bookings", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const result = await hostsService.getHostBookings(session.userId);
    return reply.send(result);
  });
}
