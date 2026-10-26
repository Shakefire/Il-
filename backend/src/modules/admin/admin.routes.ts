import { FastifyInstance } from "fastify";
import { adminService } from "./admin.service";
import { requireRole } from "../../lib/security";
import { parsePagination } from "../../lib/pagination";
import { FinanceService } from "../finance/finance.service";
import { LedgerService } from "../finance/ledger.service";
import { PaystackTransferService } from "../payments/paystack-transfer.service";

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

  // POST /api/admin/finance/settlements/process-due — Automated check-in revenue recognition
  fastify.post("/finance/settlements/process-due", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    try {
      const result = await FinanceService.processDueSettlements();
      return reply.send({
        success: true,
        message: `Processed ${result.processedCount} check-in settlements.`,
        ...result,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/transfers/balance — Paystack transfer balance query
  fastify.get("/finance/transfers/balance", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;

    try {
      const balance = await PaystackTransferService.checkTransferBalance();
      return reply.send({ success: true, ...balance });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/admin/finance/refunds/:id/approve
  fastify.post("/finance/refunds/:id/approve", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const result = await FinanceService.approveRefund(session.userId, id);
      return reply.send({ success: true, message: "Refund approved.", refund: result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/admin/finance/refunds/:id/reject
  fastify.post("/finance/refunds/:id/reject", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { adminNotes?: string };
    try {
      const result = await FinanceService.rejectRefund(session.userId, id, body.adminNotes);
      return reply.send({ success: true, message: "Refund rejected.", refund: result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/admin/finance/refunds/:id/process
  fastify.post("/finance/refunds/:id/process", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { paystackRefundId?: string };
    try {
      const result = await FinanceService.processApprovedRefund(session.userId, id, { paystackRefundId: body.paystackRefundId });
      return reply.send({ success: true, message: "Refund processed.", refundId: result.refundId, paystackRefundId: result.paystackRefundId });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/reports/:type — Financial reports (collections, payouts, refunds, settlements) with CSV
  fastify.get("/finance/reports/:type", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const { type } = request.params as { type: string };
    const q = request.query as Record<string, string>;
    const from = q.from || undefined;
    const to = q.to || undefined;
    const limit = q.limit ? parseInt(q.limit, 10) : 200;
    const offset = q.offset ? parseInt(q.offset, 10) : 0;
    const format = q.format;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
      const esc = (v: string | number | null | undefined) => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      return [[...headers].map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
    }
    const naira = (k: number | null | undefined) => ((k ?? 0) / 100).toFixed(2);

    try {
      switch (type) {
        case "collections": {
          const result = await FinanceService.getCollectionsReport({ from, to, limit, offset });
          if (format === "csv") {
            const headers = ["Booking Ref","Property","Guest Email","Gross (NGN)","Paystack Fee (NGN)","Net (NGN)","Paid At","Currency"];
            const rows = result.rows.map((r: any) => [r.bookingRef,r.propertyName,r.guestEmail,naira(r.amount),naira(r.paystackFeeAmount),naira(r.netAmount),r.paidAt?new Date(r.paidAt).toISOString():"",r.currency]);
            rows.push(["TOTAL","","",naira(result.totals.totalGross),naira(result.totals.totalFees),naira(result.totals.totalNet),"",""]);
            reply.header("Content-Type","text/csv").header("Content-Disposition",`attachment; filename="ile-collections-${today}.csv"`);
            return reply.send(toCSV(headers,rows));
          }
          return reply.send(result);
        }
        case "payouts": {
          const result = await FinanceService.getPayoutsReport({ from, to, status: q.status, limit, offset });
          if (format === "csv") {
            const headers = ["Booking Ref","Property","Host Name","Host Email","Amount (NGN)","Status","Disbursed At","Transfer Ref"];
            const rows = result.rows.map((r: any) => [r.bookingRef,r.propertyName,r.hostName,r.hostEmail,naira(r.amount),r.status,r.disbursedAt?new Date(r.disbursedAt).toISOString():"",r.paystackTransferRef||""]);
            rows.push(["TOTAL","","","",naira(result.totals.totalDisbursed),"","",""]);
            reply.header("Content-Type","text/csv").header("Content-Disposition",`attachment; filename="ile-payouts-${today}.csv"`);
            return reply.send(toCSV(headers,rows));
          }
          return reply.send(result);
        }
        case "refunds": {
          const result = await FinanceService.getRefundsReport({ from, to, limit, offset });
          if (format === "csv") {
            const headers = ["Booking Ref","Property","Guest Email","Gross Paid (NGN)","Fee Retained (NGN)","Refunded (NGN)","Status","Processed At","Reason"];
            const rows = result.rows.map((r: any) => [r.bookingRef,r.propertyName,r.guestEmail,naira(r.grossPaid),naira(r.nonRefundableProcessingFee),naira(r.refundableAmount),r.status,r.processedAt?new Date(r.processedAt).toISOString():"",r.reason||""]);
            rows.push(["TOTAL","","","",naira(result.totals.totalFeeRetained),naira(result.totals.totalRefunded),"","",""]);
            reply.header("Content-Type","text/csv").header("Content-Disposition",`attachment; filename="ile-refunds-${today}.csv"`);
            return reply.send(toCSV(headers,rows));
          }
          return reply.send(result);
        }
        case "settlements": {
          const result = await FinanceService.getSettlementsReport({ limit, offset });
          if (format === "csv") {
            const headers = ["Booking Ref","Property","Host Name","Host Email","Check-In","Check-Out","Total Amount (NGN)","Accommodation (NGN)","Commission (NGN)","Host Net (NGN)","Payout Status"];
            const rows = result.settlements.map((r: any) => [r.bookingRef,r.propertyName,r.hostName,r.hostEmail,r.checkInDate||"",r.checkOutDate||"",naira(r.totalAmount),naira(r.accommodationSubtotal),naira(r.hostCommissionAmount),naira(r.hostNetAmount),r.payoutStatus]);
            reply.header("Content-Type","text/csv").header("Content-Disposition",`attachment; filename="ile-settlements-${today}.csv"`);
            return reply.send(toCSV(headers,rows));
          }
          return reply.send(result);
        }
        default:
          return reply.status(400).send({ error: `Unknown report type: ${type}` });
      }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/audit-log — Financial audit trail
  fastify.get("/finance/audit-log", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    const q = request.query as Record<string, string>;
    try {
      const result = await FinanceService.getFinancialAuditLog({
        limit: q.limit ? parseInt(q.limit, 10) : 100,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        entityType: q.entityType,
        action: q.action,
      });
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/admin/finance/reconciliation — Reconciliation summary
  fastify.get("/finance/reconciliation", async (request, reply) => {
    const session = await requireRole(request, reply, ["admin"]);
    if (!session) return;
    try {
      const result = await FinanceService.getReconciliationSummary();
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
