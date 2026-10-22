import { FastifyInstance } from "fastify";
import { adminService } from "./admin.service";
import { requireRole } from "../../lib/security";
import { parsePagination } from "../../lib/pagination";
import { FinanceService } from "../finance/finance.service";
import { LedgerService } from "../finance/ledger.service";

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

  // DELETE /api/admin/properties/:id — Delete property permanently
  fastify.delete("/properties/:id", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await adminService.deleteProperty(id, session.userId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
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

  // GET /api/admin/hosts — List host applications with optional status filter
  fastify.get("/hosts", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const query = request.query as Record<string, any>;
    const pagination = parsePagination(query);
    const result = await adminService.getHostApplications(query.status, pagination);
    return reply.send({ success: true, ...result });
  });

  // GET /api/admin/hosts/:id — Detailed host KYC and ownership inspection
  fastify.get("/hosts/:id", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await adminService.getHostApplication(id);
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // POST /api/admin/hosts/:id/approve — Approve host verification
  fastify.post("/hosts/:id/approve", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await adminService.approveHostApplication(id, session.userId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/admin/hosts/:id/reject — Reject host application
  fastify.post("/hosts/:id/reject", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    try {
      const result = await adminService.rejectHostApplication(
        id,
        reason || "Documentation submitted could not be verified.",
        session.userId,
        request.ip
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/admin/hosts/:id/request-info — Request info / revised documents
  fastify.post("/hosts/:id/request-info", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { instructions } = (request.body || {}) as { instructions?: string };

    if (!instructions || typeof instructions !== "string" || instructions.trim().length < 5) {
      return reply.status(400).send({ error: "Please provide clear instructions for the host." });
    }

    try {
      const result = await adminService.requestHostInfo(id, instructions.trim(), session.userId, request.ip);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/admin/hosts/:id/suspend — Suspend host partner account
  fastify.post("/hosts/:id/suspend", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    try {
      const result = await adminService.suspendHostApplication(
        id,
        reason || "Account suspended due to policy violation.",
        session.userId,
        request.ip
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/admin/settings — Get global platform settings (commission rate, payout hold)
  fastify.get("/settings", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const settings = await adminService.getSettings();
    return reply.send({ success: true, settings });
  });

  // PATCH /api/admin/settings — Update default commission rate and payout hold
  fastify.patch("/settings", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    try {
      const settings = await adminService.updateSettings(
        request.body as { defaultHostCommissionPct?: number; payoutHoldHours?: number },
        session.userId,
        request.ip
      );
      return reply.send({ success: true, message: "Platform settings updated successfully.", settings });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ==========================================
  // Phase 2: Double-Entry Financial Center API
  // ==========================================

  // GET /api/admin/finance/summary — Key metrics + Trial Balance status
  fastify.get("/finance/summary", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    try {
      const summary = await FinanceService.getFinancialSummary();
      return reply.send({ success: true, ...summary });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/trial-balance — Strict zero-sum balance sheet
  fastify.get("/finance/trial-balance", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    try {
      const tb = await LedgerService.getTrialBalance();
      return reply.send({ success: true, trialBalance: tb });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/journals — Audit journal feed
  fastify.get("/finance/journals", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    try {
      const journals = await LedgerService.getJournals(limit, offset);
      return reply.send({ success: true, journals });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/payouts — Host payout queue
  fastify.get("/finance/payouts", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const query = request.query as { status?: string; limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    try {
      const queue = await FinanceService.getPayoutQueue({
        status: query.status,
        limit,
        offset,
      });
      return reply.send({ success: true, payouts: queue });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/admin/finance/payouts/:id/disburse — Admin manual payout execution
  fastify.post("/finance/payouts/:id/disburse", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = (request.body as { transferRef?: string; receiptUrl?: string; notes?: string }) || {};

    try {
      const result = await FinanceService.disbursePayout(session.userId, {
        payoutId: id,
        transferRef: body.transferRef,
        receiptUrl: body.receiptUrl,
        notes: body.notes,
      });
      return reply.send({ message: "Payout successfully marked as disbursed.", ...result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/refunds — Refund audit history
  fastify.get("/finance/refunds", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const query = request.query as { status?: string; limit?: string; offset?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    try {
      const queue = await FinanceService.getRefundQueue({
        status: query.status,
        limit,
        offset,
      });
      return reply.send({ success: true, refunds: queue });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/admin/finance/refunds — Admin process booking refund
  fastify.post("/finance/refunds", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    const body = request.body as {
      bookingId: string;
      reason?: string;
      adminNotes?: string;
      paystackRefundId?: string;
    };

    if (!body?.bookingId) {
      return reply.status(400).send({ error: "bookingId is required" });
    }

    try {
      const result = await FinanceService.processRefund(session.userId, body);
      return reply.send({ message: "Booking refund successfully executed.", ...result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
