import { FastifyInstance } from "fastify";
import { adminService } from "./admin.service";
import { requireRole } from "../../lib/security";
import { parsePagination } from "../../lib/pagination";

export async function adminRoutes(fastify: FastifyInstance) {
  // GET /api/admin/stats
  fastify.get("/stats", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const stats = await adminService.getStats();
    return reply.send({ success: true, stats });
  });

  // GET /api/admin/properties
  fastify.get("/properties", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const pagination = parsePagination(request.query as Record<string, any>);
    const result = await adminService.getProperties(pagination);
    return reply.send({ success: true, ...result });
  });

  // POST /api/admin/properties/:id/approve
  fastify.post("/properties/:id/approve", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const property = await adminService.updatePropertyStatus(id, "PUBLISHED", null, session.userId, request.ip);
      return reply.send({ success: true, message: "Property approved and published.", property });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // POST /api/admin/properties/:id/reject
  fastify.post("/properties/:id/reject", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    try {
      const property = await adminService.updatePropertyStatus(id, "REJECTED", reason || "Does not meet listing standards.", session.userId, request.ip);
      return reply.send({ success: true, message: "Property rejected.", property });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // POST /api/admin/properties/:id/suspend
  fastify.post("/properties/:id/suspend", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    try {
      const property = await adminService.updatePropertyStatus(id, "SUSPENDED", reason || "Property suspended by admin.", session.userId, request.ip);
      return reply.send({ success: true, message: "Property suspended.", property });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // GET /api/admin/bookings
  fastify.get("/bookings", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const pagination = parsePagination(request.query as Record<string, any>);
    const result = await adminService.getBookings(pagination);
    return reply.send({ success: true, ...result });
  });

  // GET /api/admin/audit-logs
  fastify.get("/audit-logs", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const pagination = parsePagination(request.query as Record<string, any>);
    const result = await adminService.getAuditLogs(pagination);
    return reply.send({ success: true, ...result });
  });
}
