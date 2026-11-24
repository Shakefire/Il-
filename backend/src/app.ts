import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env";
import { closeDb } from "./db/client";

// Module route registrations
import { authRoutes } from "./modules/auth/auth.routes";
import { propertiesRoutes } from "./modules/properties/properties.routes";
import { searchRoutes } from "./modules/search/search.routes";
import { bookingsRoutes } from "./modules/bookings/bookings.routes";
import { hostsRoutes } from "./modules/hosts/hosts.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { reviewsRoutes } from "./modules/reviews/reviews.routes";
import { locationsRoutes } from "./modules/locations/locations.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { healthRoutes } from "./modules/health/health.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { supportRoutes } from "./modules/support/support.routes";
import { favouritesRoutes } from "./modules/favourites/favourites.routes";
import { clientIp, consumeRateLimitAsync, isGlobalRateLimitExempt } from "./lib/rate-limit";

/**
 * Build and configure the Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    bodyLimit: 25 * 1024 * 1024, // 25 MB to accommodate 15MB binary files encoded in base64
    // Honor X-Forwarded-For / X-Real-IP from the trusted reverse proxy edge.
    trustProxy: true,
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // ─── Raw Body Capture for Webhooks & HMAC Verification ───
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        (req as any).rawBody = body;
        const json = body ? JSON.parse(body as string) : {};
        done(null, json);
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  // ─── CORS ───
  // Flutter web often runs on 127.0.0.1 (not localhost). Local NODE_ENV may be
  // "production", so do not rely on the development permissive fallback alone.
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowedOrigins = [
        env.FRONTEND_URL,
        "https://ilestays.ng",
        "https://www.ilestays.ng",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
      ];
      const isLocalDevOrigin =
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:");
      if (allowedOrigins.includes(origin) || isLocalDevOrigin) {
        return cb(null, true);
      }
      // Permissive in dev, strict in prod
      return cb(null, env.NODE_ENV === "development");
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Access-Token",
      "x-paystack-signature",
      "Accept",
    ],
  });

  // ─── Cookies ───
  await fastify.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest",
  });

  // ─── Fastify Rate Limiting ───
  await fastify.register(rateLimit, {
    global: false,
  });

  fastify.addHook("onRequest", async (request, reply) => {
    if (isGlobalRateLimitExempt(request.url, request.method)) return;
    const decision = await consumeRateLimitAsync(
      `global:${clientIp(request)}`,
      240,
      60_000,
      "standard"
    );
    if (!decision.ok) {
      reply.header("Retry-After", String(decision.retryAfterSec));
      return reply.status(429).send({
        error: "Too many requests. Try again shortly.",
        retryAfterSec: decision.retryAfterSec,
        retryable: true,
      });
    }
  });

  // ─── Health Checks ───
  fastify.get("/health", async () => ({
    status: "ok",
    service: "ile-backend-api",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    templateVersion: "2.0.0-boutique",
  }));
  await fastify.register(healthRoutes, { prefix: "/api/health" });

  // ─── API Modules ───
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(propertiesRoutes, { prefix: "/api/properties" });
  await fastify.register(searchRoutes, { prefix: "/api/search" });
  await fastify.register(bookingsRoutes, { prefix: "/api/bookings" });
  await fastify.register(hostsRoutes, { prefix: "/api/host" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });
  await fastify.register(reviewsRoutes, { prefix: "/api/reviews" });
  await fastify.register(locationsRoutes, { prefix: "/api/locations" });
  await fastify.register(uploadsRoutes, { prefix: "/api/uploads" });
  await fastify.register(paymentsRoutes, { prefix: "/api/payments" });
  // Public bank list & resolution — parity with Next `/api/banks` for Flutter when Fastify is sole origin
  fastify.get("/api/banks", async (_request, reply) => {
    try {
      const { BankResolutionService } = await import("./modules/payments/bank-resolution.service");
      const banks = await BankResolutionService.getNigerianBanks();
      return reply.send({ banks });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to retrieve Nigerian banks" });
    }
  });

  fastify.post("/api/bank-accounts/resolve", async (request, reply) => {
    try {
      const { BankResolutionService } = await import("./modules/payments/bank-resolution.service");
      const body = request.body as any;
      const accountNumber = body?.accountNumber || body?.account_number;
      const bankCode = body?.bankCode || body?.bank_code;
      if (!accountNumber || !bankCode) {
        return reply.status(400).send({ resolved: false, error: "Both accountNumber and bankCode are required." });
      }
      const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || request.ip || "unknown-ip";
      const result = await BankResolutionService.resolveBankAccount(String(accountNumber), String(bankCode), ip);
      if (!result.resolved) {
        return reply.status(422).send(result);
      }
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ resolved: false, error: err.message || "Failed to resolve bank account" });
    }
  });

  fastify.all("/api/banks/resolve", async (request, reply) => {
    try {
      const { BankResolutionService } = await import("./modules/payments/bank-resolution.service");
      const query = (request.query || {}) as any;
      const body = (request.body || {}) as any;
      const accountNumber = query.account_number || query.accountNumber || body.account_number || body.accountNumber;
      const bankCode = query.bank_code || query.bankCode || body.bank_code || body.bankCode;
      if (!accountNumber || !bankCode) {
        return reply.status(400).send({ resolved: false, error: "Both accountNumber and bankCode are required." });
      }
      const ip = (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || request.ip || "unknown-ip";
      const result = await BankResolutionService.resolveBankAccount(String(accountNumber), String(bankCode), ip);
      if (!result.resolved) {
        return reply.status(422).send(result);
      }
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ resolved: false, error: err.message || "Failed to resolve bank account" });
    }
  });
  await fastify.register(notificationsRoutes, { prefix: "/api/notifications" });
  await fastify.register(supportRoutes, { prefix: "/api/support" });
  await fastify.register(favouritesRoutes, { prefix: "/api/favourites" });

  // ─── Graceful Shutdown ───
  const shutdown = async () => {
    console.log("\n🛑 [Ilé] Shutting down gracefully...");
    await fastify.close();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return fastify;
}
