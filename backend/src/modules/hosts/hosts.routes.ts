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

  // GET /api/host/onboarding/status — Get current onboarding step, completion %, and missing requirements
  fastify.get("/onboarding/status", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.getOnboardingStatus(session.userId);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // PUT /api/host/onboarding/profile — Step 2: Update personal profile & contact details
  fastify.put("/onboarding/profile", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.updateOnboardingProfile(session.userId, request.body || {});
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // PUT /api/host/onboarding/identity — Step 3: KYC Government ID and Selfie
  fastify.put("/onboarding/identity", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.updateOnboardingIdentity(session.userId, request.body || {});
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // PUT /api/host/onboarding/authority — Step 4: Ownership / Authority Proof & Bank Payout Details
  fastify.put("/onboarding/authority", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.updateOnboardingAuthority(session.userId, request.body || {});
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // PUT /api/host/onboarding/property-draft — Step 5: Preliminary Property Details
  fastify.put("/onboarding/property-draft", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.savePropertyDraft(session.userId, request.body || {});
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /api/host/onboarding/submit — Step 6: Submit application for admin review
  fastify.post("/onboarding/submit", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.submitOnboardingForReview(session.userId);
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
      return reply.status(error.statusCode || 400).send({ error: error.message });
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

  // DELETE /api/host/properties/:id — Archive (with history) or delete empty listing
  fastify.delete("/properties/:id", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const query = request.query as { confirm?: string; mode?: string };
    const confirmWithReservations = query.confirm === "true";
    const mode = query.mode === "delete" ? "delete" : query.mode === "archive" ? "archive" : undefined;
    try {
      const result = await hostsService.deleteProperty(session.userId, id, confirmWithReservations, {
        ipAddress: request.ip,
        mode,
      });
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({
        error: error.message,
        requiresConfirmation: !!error.requiresConfirmation,
        upcomingCount: error.upcomingCount || 0,
        action: error.action || "archive",
        hasFinancialHistory: !!error.hasFinancialHistory,
      });
    }
  });

  // POST /api/host/properties/:id/unpublish — Hide published listing (Draft)
  fastify.post("/properties/:id/unpublish", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.unpublishProperty(session.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(error.statusCode || 400).send({ error: error.message });
    }
  });

  // PUT /api/host/properties/:id/media-order — Persist gallery order + cover
  fastify.put("/properties/:id/media-order", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    const body = (request.body || {}) as { orderedImageIds?: string[]; coverImageId?: string };
    if (!Array.isArray(body.orderedImageIds) || body.orderedImageIds.length === 0) {
      return reply.status(400).send({ error: "orderedImageIds array is required" });
    }

    try {
      const result = await hostsService.reorderPropertyMedia(
        session.userId,
        id,
        body.orderedImageIds,
        body.coverImageId
      );
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

  // POST /api/host/properties/:id/submit — Submit / publish listing
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

  // POST /api/host/properties/:id/publish — Direct publication for verified hosts
  fastify.post("/properties/:id/publish", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { id } = request.params as { id: string };
    try {
      const result = await hostsService.publishProperty(session.userId, id);
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

  // GET /api/host/payouts — Host's payout queue and settlement ledger
  fastify.get("/payouts", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const result = await hostsService.getHostPayouts(session.userId);
    return reply.send(result);
  });

  // GET /api/host/wallet — Pending / available / processing / paid projection
  fastify.get("/wallet", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const { FinanceService } = await import("../finance/finance.service");
      const wallet = await FinanceService.getHostWallet(session.userId);
      return reply.send({ success: true, wallet });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/host/wallet/withdraw — Atomic reserve + Paystack transfer
  fastify.post("/wallet/withdraw", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const body = (request.body || {}) as { amountNaira?: number; payoutIds?: string[] };

    try {
      const { FinanceService } = await import("../finance/finance.service");
      const result = await FinanceService.requestHostWithdrawal(session.userId, {
        amountNaira: body.amountNaira,
        payoutIds: body.payoutIds,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply
        .status(err.statusCode || 400)
        .send({ error: err.message, code: err.code });
    }
  });

  // GET /api/host/payout-account — Masked verified bank account
  fastify.get("/payout-account", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await hostsService.getPayoutAccount(session.userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/host/payout-account — Resolve + save Paystack-verified account
  fastify.put("/payout-account", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const body = (request.body || {}) as { bankCode?: string; accountNumber?: string };
    if (!body.bankCode || !body.accountNumber) {
      return reply.status(400).send({ error: "Both bankCode and accountNumber are required." });
    }

    try {
      const result = await hostsService.updatePayoutAccount(
        session.userId,
        { bankCode: body.bankCode, accountNumber: body.accountNumber },
        request.ip
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 400).send({ error: err.message });
    }
  });
}
