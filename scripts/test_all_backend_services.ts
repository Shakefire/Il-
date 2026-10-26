import { env } from "../backend/src/config/env";
import { getDb } from "../backend/src/db/client";
import { sql } from "drizzle-orm";
import { testR2Connectivity } from "../backend/src/modules/uploads/uploads.service";
import { testResendConnectivity } from "../backend/src/modules/notifications/notifications.service";
import { testPaystackConnectivity } from "../backend/src/modules/payments/payments.service";
import { buildApp } from "../backend/src/app";

interface TestReport {
  name: string;
  category: string;
  status: "ONLINE" | "DEGRADED" | "OFFLINE" | "SKIPPED";
  latencyMs?: number;
  details?: Record<string, any>;
  error?: string;
}

async function run() {
  console.log("=================================================================");
  console.log("🔍 ILÉ BACKEND & INTEGRATION SERVICES HEALTH DIAGNOSTIC REPORT");
  console.log("=================================================================\n");

  const reports: TestReport[] = [];

  // 1. Neon PostgreSQL Database
  const startDb = Date.now();
  try {
    const db = getDb();
    const rawResult: any = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM users) as users_count,
        (SELECT count(*) FROM properties) as properties_count,
        (SELECT count(*) FROM bookings) as bookings_count,
        version() as pg_version
    `);
    const rows = rawResult.rows || rawResult;
    const dbResult = rows[0] || {};
    const latency = Date.now() - startDb;
    reports.push({
      name: "Neon PostgreSQL Database",
      category: "Database & Storage",
      status: "ONLINE",
      latencyMs: latency,
      details: {
        engine: env.DATABASE_URL ? "PostgreSQL (Neon Cloud)" : "PGlite (Embedded)",
        usersCount: Number(dbResult?.users_count ?? 0),
        propertiesCount: Number(dbResult?.properties_count ?? 0),
        bookingsCount: Number(dbResult?.bookings_count ?? 0),
        pgVersion: dbResult?.pg_version ? String(dbResult.pg_version).split(" ")[0] : "PostgreSQL",
      },
    });
  } catch (err: any) {
    reports.push({
      name: "Neon PostgreSQL Database",
      category: "Database & Storage",
      status: "OFFLINE",
      latencyMs: Date.now() - startDb,
      error: err.message || String(err),
    });
  }

  // 2. Cloudflare R2 Object Storage
  const startR2 = Date.now();
  try {
    const r2Probe = await testR2Connectivity();
    const latency = Date.now() - startR2;
    if (r2Probe.connected) {
      reports.push({
        name: "Cloudflare R2 Object Storage",
        category: "Database & Storage",
        status: "ONLINE",
        latencyMs: latency,
        details: {
          bucket: env.R2_BUCKET_NAME || "storageapp",
          folderPrefix: env.R2_FOLDER_PREFIX,
          accountId: env.R2_ACCOUNT_ID ? `${env.R2_ACCOUNT_ID.slice(0, 6)}...` : undefined,
        },
      });
    } else {
      reports.push({
        name: "Cloudflare R2 Object Storage",
        category: "Database & Storage",
        status: "OFFLINE",
        latencyMs: latency,
        error: r2Probe.error || "R2 bucket unreachable",
      });
    }
  } catch (err: any) {
    reports.push({
      name: "Cloudflare R2 Object Storage",
      category: "Database & Storage",
      status: "OFFLINE",
      latencyMs: Date.now() - startR2,
      error: err.message,
    });
  }

  // 3. Paystack Payments API
  const startPaystack = Date.now();
  try {
    const payProbe = await testPaystackConnectivity();
    const bankRes = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=5", {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    });
    const bankData = await bankRes.json();
    const latency = Date.now() - startPaystack;
    if (payProbe.connected && bankRes.ok) {
      reports.push({
        name: "Paystack Payment Gateway",
        category: "External APIs",
        status: "ONLINE",
        latencyMs: latency,
        details: {
          mode: payProbe.mode,
          bankResolutionApi: bankData.status ? "WORKING" : "DEGRADED",
          sampleBanksAvailable: bankData.data?.length ?? 0,
        },
      });
    } else {
      reports.push({
        name: "Paystack Payment Gateway",
        category: "External APIs",
        status: "DEGRADED",
        latencyMs: latency,
        error: payProbe.error || `Bank API status: ${bankRes.status}`,
      });
    }
  } catch (err: any) {
    reports.push({
      name: "Paystack Payment Gateway",
      category: "External APIs",
      status: "OFFLINE",
      latencyMs: Date.now() - startPaystack,
      error: err.message,
    });
  }

  // 4. Resend Transactional Email Service
  const startResend = Date.now();
  try {
    const resendProbe = await testResendConnectivity();
    const latency = Date.now() - startResend;
    if (resendProbe.connected) {
      reports.push({
        name: "Resend Transactional Email",
        category: "External APIs",
        status: "ONLINE",
        latencyMs: latency,
        details: {
          domain: resendProbe.domain,
          senderAddress: env.EMAIL_FROM,
        },
      });
    } else {
      reports.push({
        name: "Resend Transactional Email",
        category: "External APIs",
        status: "OFFLINE",
        latencyMs: latency,
        error: resendProbe.error || "Resend connection failed",
      });
    }
  } catch (err: any) {
    reports.push({
      name: "Resend Transactional Email",
      category: "External APIs",
      status: "OFFLINE",
      latencyMs: Date.now() - startResend,
      error: err.message,
    });
  }

  // 5. Supabase
  const startSupabase = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wnyxhryusexjswypopni.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    const latency = Date.now() - startSupabase;
    reports.push({
      name: "Supabase Service",
      category: "External APIs",
      status: res.status < 500 ? "ONLINE" : "OFFLINE",
      latencyMs: latency,
      details: {
        url: supabaseUrl,
        httpStatus: res.status,
      },
    });
  } catch (err: any) {
    reports.push({
      name: "Supabase Service",
      category: "External APIs",
      status: "OFFLINE",
      latencyMs: Date.now() - startSupabase,
      error: err.message,
    });
  }

  // 6. Geocoding Service (OpenStreetMap Nominatim)
  const startGeo = Date.now();
  try {
    const geoUrl = `${env.GEOCODING_API_URL || "https://nominatim.openstreetmap.org"}/search?format=json&q=Maitama%20Abuja&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { "User-Agent": "Ile-Accommodation-Marketplace-HealthCheck/1.0" },
    });
    const geoData = await geoRes.json();
    const latency = Date.now() - startGeo;
    reports.push({
      name: "Nominatim Geocoding API",
      category: "External APIs",
      status: geoRes.ok && Array.isArray(geoData) && geoData.length > 0 ? "ONLINE" : "DEGRADED",
      latencyMs: latency,
      details: {
        resolvedCoordinate: geoData[0] ? `${geoData[0].lat}, ${geoData[0].lon}` : undefined,
      },
    });
  } catch (err: any) {
    reports.push({
      name: "Nominatim Geocoding API",
      category: "External APIs",
      status: "OFFLINE",
      latencyMs: Date.now() - startGeo,
      error: err.message,
    });
  }

  // 7. Hosted Railway Backend
  const startRailway = Date.now();
  const railwayUrl = (process.env as any).BACKEND_URL || "https://il-production.up.railway.app";
  try {
    const railRes = await fetch(`${railwayUrl}/health`);
    const railJson = await railRes.json().catch(() => null);
    const latency = Date.now() - startRailway;
    if (railRes.ok) {
      reports.push({
        name: "Hosted Railway Fastify API",
        category: "Hosting & Servers",
        status: "ONLINE",
        latencyMs: latency,
        details: { url: railwayUrl, response: railJson },
      });
    } else {
      reports.push({
        name: "Hosted Railway Fastify API",
        category: "Hosting & Servers",
        status: "OFFLINE",
        latencyMs: latency,
        details: { url: railwayUrl, httpStatus: railRes.status, response: railJson },
        error: `HTTP ${railRes.status}: ${JSON.stringify(railJson)}`,
      });
    }
  } catch (err: any) {
    reports.push({
      name: "Hosted Railway Fastify API",
      category: "Hosting & Servers",
      status: "OFFLINE",
      latencyMs: Date.now() - startRailway,
      error: err.message,
    });
  }

  // 8. Hosted Vercel Production App & Next.js Backend Routes
  const startVercel = Date.now();
  const vercelUrl = env.FRONTEND_URL || "https://ille-theta.vercel.app";
  try {
    const vRes = await fetch(`${vercelUrl}/api/properties?limit=1`);
    const vJson = await vRes.json().catch(() => null);
    const latency = Date.now() - startVercel;
    if (vRes.ok && vJson?.properties) {
      reports.push({
        name: "Vercel Next.js Fullstack API",
        category: "Hosting & Servers",
        status: "ONLINE",
        latencyMs: latency,
        details: {
          url: vercelUrl,
          totalPropertiesReturned: vJson.total,
          firstPropertyTitle: vJson.properties[0]?.title,
        },
      });
    } else {
      reports.push({
        name: "Vercel Next.js Fullstack API",
        category: "Hosting & Servers",
        status: "DEGRADED",
        latencyMs: latency,
        error: `HTTP ${vRes.status}`,
      });
    }
  } catch (err: any) {
    reports.push({
      name: "Vercel Next.js Fullstack API",
      category: "Hosting & Servers",
      status: "OFFLINE",
      latencyMs: Date.now() - startVercel,
      error: err.message,
    });
  }

  // 9. Local Fastify Application Factory
  const startLocalFastify = Date.now();
  try {
    const fastifyApp = await buildApp();
    const injectRes = await fastifyApp.inject({ method: "GET", url: "/health" });
    await fastifyApp.close();
    const latency = Date.now() - startLocalFastify;
    reports.push({
      name: "Local Fastify Backend Stack",
      category: "Hosting & Servers",
      status: injectRes.statusCode === 200 ? "ONLINE" : "OFFLINE",
      latencyMs: latency,
      details: {
        statusCode: injectRes.statusCode,
        body: JSON.parse(injectRes.body),
      },
    });
  } catch (err: any) {
    reports.push({
      name: "Local Fastify Backend Stack",
      category: "Hosting & Servers",
      status: "OFFLINE",
      latencyMs: Date.now() - startLocalFastify,
      error: err.message,
    });
  }

  // Output formatting
  for (const report of reports) {
    const badge =
      report.status === "ONLINE"
        ? "🟢 [ONLINE] "
        : report.status === "DEGRADED"
        ? "🟡 [DEGRADED]"
        : "🔴 [OFFLINE]";
    console.log(`${badge} ${report.name} (${report.latencyMs}ms)`);
    if (report.details) {
      for (const [k, v] of Object.entries(report.details)) {
        console.log(`          • ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
      }
    }
    if (report.error) {
      console.log(`          ⚠️  Error: ${report.error}`);
    }
    console.log("");
  }

  console.log("=================================================================");
  console.log("Summary:");
  const onlineCount = reports.filter(r => r.status === "ONLINE").length;
  const degradedCount = reports.filter(r => r.status === "DEGRADED").length;
  const offlineCount = reports.filter(r => r.status === "OFFLINE").length;
  console.log(`Total Services: ${reports.length} | Online: ${onlineCount} | Degraded: ${degradedCount} | Offline: ${offlineCount}`);
  console.log("=================================================================");
  
  process.exit(0);
}

run().catch((e) => {
  console.error("FATAL RUNNER ERROR:", e);
  process.exit(1);
});
