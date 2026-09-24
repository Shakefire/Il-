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
export function getDb(): DbClient {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL) {
    console.log("📦 [DB] Connecting to PostgreSQL via DATABASE_URL...");
    pgPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    dbInstance = drizzlePg(pgPool, { schema }) as unknown as DbClient;
    return dbInstance;
  }

  // Embedded PGlite for zero-dependency local development
  console.log("📦 [DB] Using embedded PGlite (development mode)...");
  const dataDir = path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

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

/** Singleton database instance */
export const db = getDb();

/** Re-export schema for convenience */
export { schema };
