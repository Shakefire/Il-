/**
 * Apply SQL migrations to a disposable local PGlite directory only.
 * Never targets Neon / DATABASE_URL.
 */
import fs from "fs"
import path from "path"
import { PGlite } from "@electric-sql/pglite"

async function main() {
  delete process.env.DATABASE_URL
  const targetDir = path.resolve(".data", "phase4-migration-apply")
  fs.mkdirSync(targetDir, { recursive: true })
  const dbPath = path.join(targetDir, "ile_phase4.db")
  console.log(`Applying migrations to PGlite: ${dbPath}`)
  console.log(`DATABASE_URL unset: ${!process.env.DATABASE_URL}`)

  const client = new PGlite(dbPath)
  await client.waitReady

  // Minimal base tables so IF EXISTS / FK guards in later migrations succeed.
  await client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      role VARCHAR(30)
    );
    CREATE TABLE IF NOT EXISTS properties (
      id VARCHAR(100) PRIMARY KEY,
      host_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(100) PRIMARY KEY,
      property_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100),
      property_id VARCHAR(100),
      guest_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS host_earnings (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100),
      host_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS payouts (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100),
      host_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id VARCHAR(100) PRIMARY KEY,
      booking_id VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id VARCHAR(100) PRIMARY KEY,
      gateway_provider VARCHAR(50),
      event_id VARCHAR(200)
    );
    CREATE TABLE IF NOT EXISTS ledger_journals (
      id VARCHAR(100) PRIMARY KEY,
      reference VARCHAR(200),
      event_type VARCHAR(80)
    );
    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id VARCHAR(100) PRIMARY KEY,
      code VARCHAR(20),
      name VARCHAR(200),
      type VARCHAR(30),
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id VARCHAR(100) PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY
    );
  `)

  const migrationsDir = path.resolve("backend/src/db/migrations")
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && /^(0008|0009|0010|0011)/.test(f))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    console.log(`→ ${file}`)
    try {
      await client.exec(sql)
      console.log(`  OK`)
    } catch (err: any) {
      console.error(`  FAIL: ${err?.message || err}`)
      process.exitCode = 1
    }
  }

  const check = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('rate_limit_buckets','support_cases','favourites','review_moderation') ORDER BY 1`
  )
  console.log("Tables present:", check.rows.map((r: any) => r.table_name).join(", "))
  await client.close()
  console.log("Done. Production Neon was not touched.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
