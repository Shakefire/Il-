import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { env, isDev } from "../config/env";

export type DbClient = ReturnType<typeof drizzlePg> | ReturnType<typeof drizzlePglite>;

let dbInstance: DbClient | null = null;
let pgPool: Pool | null = null;

/**
 * Get or create the database connection.
 * Uses real PostgreSQL when DATABASE_URL is set, otherwise falls back to PGlite.
 */
function isNextProductionBuild(): boolean {
  const phase = String(process.env.NEXT_PHASE || "")
  return (
    phase === "phase-production-build" ||
    phase === "phase-export" ||
    process.env.NEXT_PRIVATE_BUILD_WORKER === "1"
  )
}

export function getDb(): DbClient {
  if (dbInstance) return dbInstance;

  const databaseUrl = (env.DATABASE_URL || process.env.DATABASE_URL || "").trim();
  // Next.js injects .env during `next build`; never open shared Neon from the build worker.
  if (databaseUrl && !isNextProductionBuild()) {
    console.log("📦 [DB] Connecting to PostgreSQL via DATABASE_URL...");
    pgPool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    });
    dbInstance = drizzlePg(pgPool, { schema }) as unknown as DbClient;
    return dbInstance;
  }
  if (databaseUrl && isNextProductionBuild()) {
    console.log("📦 [DB] Skipping DATABASE_URL during Next.js build — using ephemeral PGlite");
  }

  // Embedded PGlite for zero-dependency local development
  console.log("📦 [DB] Using embedded PGlite (development mode)...");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dataDir = process.env.ILE_PGLITE_DIR
    ? path.resolve(process.env.ILE_PGLITE_DIR)
    : isServerless
      ? path.join("/tmp", ".data")
      : path.resolve(process.cwd(), ".data");
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch {}

  const pglite = new PGlite(path.join(dataDir, "ile_dev.db"));
  dbInstance = drizzlePglite(pglite, { schema }) as unknown as DbClient;
  return dbInstance;
}

/**
 * Gracefully close the database connection pool.
 */
export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  dbInstance = null;
}

/**
 * Lazy singleton — do not call getDb() at module load.
 * Eager connect opened Neon during `next build` SSG / route analysis.
 */
export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const instance = getDb() as any
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === "function" ? value.bind(instance) : value
  },
})

/** Re-export schema for convenience */
export { schema };
