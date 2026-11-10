import { sql, type SQL } from "drizzle-orm"
import { schema } from "../db/client"
import { MARKETPLACE_FIXTURE_EMAIL_DOMAIN } from "./marketplace-fixtures"

/** Host is not an automated test fixture account. */
export function excludeMarketplaceFixtureHosts(): SQL {
  return sql`(
    ${schema.users.email} IS NULL
    OR (
      ${schema.users.email} NOT ILIKE ${"%" + MARKETPLACE_FIXTURE_EMAIL_DOMAIN}
      AND ${schema.users.email} NOT ILIKE ${"%@ile.test"}
    )
  )`
}
