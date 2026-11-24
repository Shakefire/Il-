/**
 * Apply 0008–0011 onto .data/phase4-test-db/ile_dev.db (local PGlite only).
 * Never touches Neon / DATABASE_URL.
 */
import fs from "fs"
import path from "path"
import { PGlite } from "@electric-sql/pglite"

async function main() {
  delete process.env.DATABASE_URL
  process.env.DATABASE_URL = ""
  const dbPath = path.resolve(".data/phase4-test-db/ile_dev.db")
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Missing PGlite db at ${dbPath}`)
  }
  console.log(`Applying 0008–0011 to ${dbPath}`)
  const client = new PGlite(dbPath)
  await client.waitReady
  const migrationsDir = path.resolve("backend/src/db/migrations")
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && /^(0008|0009|0010|0011)/.test(f))
    .sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8")
    process.stdout.write(`→ ${file} `)
    try {
      await client.exec(sql)
      console.log("OK")
    } catch (err: any) {
      const msg = err?.message || String(err)
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`SKIP (exists): ${msg.slice(0, 100)}`)
      } else {
        console.log(`FAIL: ${msg}`)
        process.exitCode = 1
      }
    }
  }
  const check = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('rate_limit_buckets','support_cases','favourites','review_moderation','bookings','payments','users','ledger_accounts') ORDER BY 1`
  )
  console.log(
    "Tables:",
    check.rows.map((r: any) => r.table_name).join(", ")
  )
  await client.close()
  console.log("Done. Neon was not touched.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
