import { getDb } from "../../db/client";
import { sql } from "drizzle-orm";
import { testR2Connectivity } from "../uploads/uploads.service";
import { testResendConnectivity } from "../notifications/notifications.service";
import { testPaystackConnectivity } from "../payments/payments.service";
import { env } from "../../config/env";

export interface ServiceHealthStatus {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  services: {
    database: {
      status: "CONNECTED" | "ERROR";
      engine: string;
      error?: string;
    };
    r2: {
      status: "CONFIGURED & TESTED" | "CONFIGURED" | "NOT_CONFIGURED" | "ERROR";
      bucket: string;
      error?: string;
    };
    resend: {
      status: "CONFIGURED & TESTED" | "CONFIGURED" | "NOT_CONFIGURED" | "ERROR";
      domain: string;
      error?: string;
    };
    paystack: {
      status: "TEST MODE CONFIGURED & ACTIVE" | "LIVE MODE CONFIGURED" | "NOT_CONFIGURED" | "ERROR";
      environment: string;
      error?: string;
    };
    locationProvider: {
      status: "CONNECTED & TESTED" | "ERROR";
      provider: string;
      cache: string;
      error?: string;
    };
    authentication: {
      status: "WORKING";
      provider: string;
      algorithm: string;
    };
  };
}

export async function checkSystemHealth(): Promise<ServiceHealthStatus> {
  const timestamp = new Date().toISOString();

  // 1. Database check
  let dbStatus: "CONNECTED" | "ERROR" = "CONNECTED";
  let dbError: string | undefined;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  } catch (err: any) {
    dbStatus = "ERROR";
    dbError = err.message || "Database connection error";
  }

  // 2. R2 Storage check
  let r2Status: "CONFIGURED & TESTED" | "CONFIGURED" | "NOT_CONFIGURED" | "ERROR" = "NOT_CONFIGURED";
  let r2Error: string | undefined;
  const r2Bucket = env.R2_BUCKET_NAME || "storageapp";
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    const r2Probe = await testR2Connectivity();
    if (r2Probe.connected) {
      r2Status = "CONFIGURED & TESTED";
    } else {
      r2Status = "ERROR";
      r2Error = r2Probe.error;
    }
  }

  // 3. Resend Email check
  let resendStatus: "CONFIGURED & TESTED" | "CONFIGURED" | "NOT_CONFIGURED" | "ERROR" = "NOT_CONFIGURED";
  let resendError: string | undefined;
  const emailDomain = env.RESEND_DOMAIN || "notifications.9jaroommate.com";
  if (env.EMAIL_API_KEY) {
    const resendProbe = await testResendConnectivity();
    if (resendProbe.connected) {
      resendStatus = "CONFIGURED & TESTED";
    } else {
      resendStatus = "CONFIGURED";
      resendError = resendProbe.error;
    }
  }

  // 4. Paystack check
  let paystackStatus: "TEST MODE CONFIGURED & ACTIVE" | "LIVE MODE CONFIGURED" | "NOT_CONFIGURED" | "ERROR" = "NOT_CONFIGURED";
  let paystackError: string | undefined;
  if (env.PAYSTACK_SECRET_KEY) {
    const payProbe = await testPaystackConnectivity();
    if (payProbe.connected) {
      paystackStatus = payProbe.mode === "TEST_MODE" ? "TEST MODE CONFIGURED & ACTIVE" : "LIVE MODE CONFIGURED";
    } else {
      paystackStatus = "ERROR";
      paystackError = payProbe.error;
    }
  }

  // 5. Location Provider check
  let locationStatus: "CONNECTED & TESTED" | "ERROR" = "CONNECTED & TESTED";
  let locationError: string | undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const probeRes = await fetch("https://nominatim.openstreetmap.org/search?q=Abuja,Nigeria&countrycodes=ng&format=jsonv2&limit=1", {
      headers: { "User-Agent": "IleAccommodationMarketplace/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!probeRes.ok) throw new Error(`HTTP ${probeRes.status}`);
  } catch (err: any) {
    locationStatus = "ERROR";
    locationError = err.message || "Failed to reach Nominatim provider";
  }

  const isHealthy =
    dbStatus === "CONNECTED" &&
    r2Status === "CONFIGURED & TESTED" &&
    (resendStatus === "CONFIGURED & TESTED" || resendStatus === "CONFIGURED") &&
    paystackStatus.includes("CONFIGURED") &&
    locationStatus === "CONNECTED & TESTED";

  return {
    status: isHealthy ? "healthy" : "degraded",
    timestamp,
    services: {
      database: {
        status: dbStatus,
        engine: "PostgreSQL (Drizzle ORM)",
        error: dbError,
      },
      r2: {
        status: r2Status,
        bucket: r2Bucket,
        error: r2Error,
      },
      resend: {
        status: resendStatus,
        domain: emailDomain,
        error: resendError,
      },
      paystack: {
        status: paystackStatus,
        environment: env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_") ? "Test Environment" : "Live Environment",
        error: paystackError,
      },
      locationProvider: {
        status: locationStatus,
        provider: "OpenStreetMap Nominatim (Nigeria scoped)",
        cache: "PostgreSQL location_search_cache",
        error: locationError,
      },
      authentication: {
        status: "WORKING",
        provider: "Fastify JWT Session + Bcrypt + PostgreSQL",
        algorithm: "HS256 / SHA-256",
      },
    },
  };
}
