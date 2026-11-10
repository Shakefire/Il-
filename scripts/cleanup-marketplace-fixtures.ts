/**
 * Marketplace fixture soft-archive helper (REVIEW ARTIFACT).
 *
 * Identifies hosts with @test.ile.ng / @ile.test emails and their PUBLISHED
 * properties. Soft-archives disposable listings WITHOUT deleting financial
 * history (bookings, payments, payouts, refunds, ledger).
 *
 * HARD RULES:
 * - Do NOT run against production Neon without explicit PO approval.
 * - Default mode is DRY RUN (list only).
 * - Pass --execute only on a reviewed non-prod branch after confirming DATABASE_URL.
 *
 * Usage:
 *   npx tsx scripts/cleanup-marketplace-fixtures.ts
 *   npx tsx scripts/cleanup-marketplace-fixtures.ts --execute
 */

import "dotenv/config"
import { and, eq, or, sql, like } from "drizzle-orm"
import { getDb, schema } from "../backend/src/db/client"

const EXECUTE = process.argv.includes("--execute")

const isLikelyProduction = (): boolean => {
  const branch = (process.env.NEON_BRANCH || "").toLowerCase()
  const url = process.env.DATABASE_URL || ""
  if (branch.includes("prod")) return true
  if (/neon\.tech/i.test(url) && !/dev|test|preview|staging/i.test(branch)) return true
  return false
}

async function main() {
  if (EXECUTE && isLikelyProduction()) {
    console.error(
      "REFUSED: DATABASE_URL / NEON_BRANCH looks like production. Refusing --execute."
    )
    console.error("List IDs with a dry run, then apply on a reviewed non-prod branch only.")
    process.exit(2)
  }

  const db = getDb()

  const fixtureHosts = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(
      or(
        like(schema.users.email, "%@test.ile.ng"),
        like(schema.users.email, "%@ile.test")
      )
    )

  console.log(`Found ${fixtureHosts.length} fixture host/user emails`)

  const hostIds = fixtureHosts.map((h) => h.userId)
  if (hostIds.length === 0) {
    console.log("Nothing to soft-archive.")
    return
  }

  const properties = await db
    .select({
      id: schema.properties.id,
      slug: schema.properties.slug,
      title: schema.properties.title,
      status: schema.properties.status,
      hostId: schema.properties.hostId,
    })
    .from(schema.properties)
    .where(
      and(
        sql`${schema.properties.hostId} IN (${sql.join(
          hostIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(schema.properties.status, "PUBLISHED")
      )
    )

  console.log(`Published fixture properties: ${properties.length}`)
  for (const p of properties) {
    console.log(`  - ${p.id} | ${p.slug} | ${p.title}`)
  }

  if (!EXECUTE) {
    console.log("\nDRY RUN only. Re-run with --execute on non-prod to soft-archive.")
    console.log("Financial rows (bookings/payments/payouts/refunds/ledger) are never deleted.")
    return
  }

  let archived = 0
  for (const p of properties) {
    await db
      .update(schema.properties)
      .set({
        status: "ARCHIVED",
        moderationStatus: "SUSPENDED",
        updatedAt: new Date(),
      })
      .where(eq(schema.properties.id, p.id))
    archived += 1
  }

  console.log(`Soft-archived ${archived} published fixture properties.`)
  console.log("Financial history preserved.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
