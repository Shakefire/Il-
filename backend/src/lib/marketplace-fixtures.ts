/**
 * Marketplace fixture isolation.
 *
 * Root cause: phase integration tests insert PUBLISHED properties owned by
 * `@test.ile.ng` users into the shared Neon database (often via
 * onConflictDoNothing) and leave them visible on the guest marketplace.
 *
 * Real host listings never use that mailbox domain. Exclude them from public
 * browse/search so production-facing UIs only show genuine published stays.
 */

export const MARKETPLACE_FIXTURE_EMAIL_DOMAIN = "@test.ile.ng"

/** True when a host email belongs to automated test fixtures. */
export function isMarketplaceFixtureHostEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false
  const lower = email.trim().toLowerCase()
  return (
    lower.endsWith(MARKETPLACE_FIXTURE_EMAIL_DOMAIN) ||
    lower.endsWith("@ile.test")
  )
}
