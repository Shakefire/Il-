import { FastifyInstance } from "fastify";
import { checkSystemHealth } from "./health.service";
import { sendEmail } from "../notifications/notifications.service";

export async function healthRoutes(fastify: FastifyInstance) {
  // Public ping
  fastify.get("/", async () => {
    return {
      status: "ok",
      service: "ile-accommodation-api",
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed integration health status
  fastify.get("/detailed", async (_request, reply) => {
    try {
      const health = await checkSystemHealth();
      return reply.send(health);
    } catch (err: any) {
      return reply.status(500).send({
        status: "error",
        error: err.message || "Failed to inspect system health",
      });
    }
  });

  // Safe developer email verification endpoint (does NOT leak API keys)
  fastify.post("/test-email", async (request, reply) => {
    const body = request.body as { to?: string };
    const to = body?.to || "delivered@resend.dev";

    try {
      const sent = await sendEmail({
        to,
        subject: "Ilé Integration Test — Resend Delivery",
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #FAFAF8;">
            <h2 style="color: #0B5D45;">Resend Integration Verified</h2>
            <p>This email confirms that Resend transactional email delivery is functioning properly from Ilé.</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
        `,
        text: `Resend Integration Verified on Ilé. Timestamp: ${new Date().toISOString()}`,
      });

      if (!sent) {
        return reply.status(500).send({ success: false, error: "Resend failed to deliver the test email." });
      }

      return reply.send({
        success: true,
        message: `Test email dispatched to ${to}`,
        provider: "resend",
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || "Email dispatch failed." });
    }
  });
}
