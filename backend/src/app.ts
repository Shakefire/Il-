import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
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

/**
 * Build and configure the Fastify application instance.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    bodyLimit: 15 * 1024 * 1024, // 15 MB for image uploads
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // ─── CORS ───
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowedOrigins = [
        env.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
      ];
      if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
        return cb(null, true);
      }
      // Permissive in dev, strict in prod
      return cb(null, env.NODE_ENV === "development");
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Access-Token", "x-paystack-signature"],
  });

  // ─── Cookies ───
  await fastify.register(cookie, {
    secret: env.SESSION_SECRET,
    hook: "onRequest",
  });

  // ─── Health Checks ───
  fastify.get("/health", async () => ({
    status: "ok",
    service: "ile-backend-api",
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
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
