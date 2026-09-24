import { FastifyInstance } from "fastify";
import {
  initializeBookingPayment,
  verifyPayment,
  handlePaystackWebhook,
} from "./payments.service";

export async function paymentsRoutes(fastify: FastifyInstance) {
  // ─── POST /api/payments/initialize ───
  fastify.post("/initialize", async (request, reply) => {
    const body = request.body as {
      bookingId?: string;
      referenceCode?: string;
    };

    const targetRef = body?.bookingId || body?.referenceCode;
    if (!targetRef) {
      return reply.status(400).send({
        error: "Missing booking identifier (bookingId or referenceCode).",
      });
    }

    try {
      const result = await initializeBookingPayment(targetRef);
      if (!result.success) {
        return reply.status(400).send({ error: result.error || "Payment initialization failed." });
      }
      return reply.send(result);
    } catch (err: any) {
      console.error("[Payments] Init route error:", err);
      return reply.status(500).send({ error: err.message || "Failed to initialize payment." });
    }
  });

  // ─── GET /api/payments/verify/:reference ───
  fastify.get("/verify/:reference", async (request, reply) => {
    const params = request.params as { reference: string };
    if (!params.reference) {
      return reply.status(400).send({ error: "Missing transaction reference." });
    }

    try {
      const result = await verifyPayment(params.reference);
      if (!result.verified) {
        return reply.status(400).send({
          verified: false,
          error: result.error || "Payment could not be verified.",
        });
      }
      return reply.send(result);
    } catch (err: any) {
      console.error("[Payments] Verify route error:", err);
      return reply.status(500).send({ error: err.message || "Payment verification failed." });
    }
  });

  // ─── POST /api/payments/webhook ───
  fastify.post("/webhook", async (request, reply) => {
    const signature = request.headers["x-paystack-signature"] as string;

    if (!signature) {
      console.warn("[Paystack Webhook] Missing x-paystack-signature header");
      return reply.status(400).send({ error: "Missing signature header." });
    }

    // Handle raw string or JSON parsed body
    const rawBody = typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body);

    try {
      const res = await handlePaystackWebhook(rawBody, signature);
      return reply.status(200).send({ received: true, message: res.message });
    } catch (err: any) {
      console.error("[Paystack Webhook] Verification error:", err.message);
      return reply.status(400).send({ error: err.message || "Webhook processing error." });
    }
  });
}
