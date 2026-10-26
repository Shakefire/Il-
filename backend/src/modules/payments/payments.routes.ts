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
      accessToken?: string;
    };

    const targetRef = body?.bookingId || body?.referenceCode;
    const accessToken = body?.accessToken || (request.headers["x-booking-access-token"] as string) || undefined;
    if (!targetRef) {
      return reply.status(400).send({
        error: "Missing booking identifier (bookingId or referenceCode).",
      });
    }

    try {
      const result = await initializeBookingPayment(targetRef, accessToken);
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
        if (result.status === "failed") {
          return reply.status(400).send({
            verified: false,
            status: "failed",
            error: result.error || "Payment was declined by financial institution.",
          });
        }
        return reply.status(200).send({
          verified: false,
          status: result.status || "pending",
          pending: true,
          error: result.error || "Payment verification is pending or incomplete.",
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
    const rawBody =
      (request as any).rawBody ||
      (typeof request.body === "string" ? request.body : JSON.stringify(request.body));

    try {
      const res = await handlePaystackWebhook(rawBody, signature);
      return reply.status(200).send({ received: true, message: res.message });
    } catch (err: any) {
      console.error("[Paystack Webhook] Verification error:", err.message);
      return reply.status(400).send({ error: err.message || "Webhook processing error." });
    }
  });
}
