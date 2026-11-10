# Mock Data Removal Report

**Date:** 2026-11-10

---

## Production UI/API paths cleaned

| Path | Before | After |
|---|---|---|
| `src/app/api/properties/route.ts` | Fallback to static `PROPERTIES` | Empty list / 503 on error |
| `src/app/api/properties/[slug]/route.ts` | Static slug fallback | 404/503 from DB only |
| `src/app/api/search/route.ts` | Static filter fallback | Empty + 503 |
| `src/app/page.tsx` | Merged static stays into homepage | DB published stays only |
| `src/app/search/page.tsx` | Initial state = `PROPERTIES` | `[]` + error empty state |
| `src/app/stay/[slug]/page.tsx` | Metadata from static | Slug-derived metadata |
| `src/app/stay/[slug]/StayDetailClient.tsx` | Prefill from static | Load from API; real empty/error |

## Retained (non-marketplace)

- `src/data/properties.ts` — seed catalog + `DESTINATIONS` for homepage destination tiles.
- `backend/src/db/seed.ts` imports `PROPERTIES` for optional seeding.
- Flutter design-system preview `demo` route — UI kit only.
- Deprecated `mock_auth.dart` constants — not used in production auth UI.

## Marketplace fixture filter

Verified: Fastify `getPublishedProperties` / search still exclude hosts with `@test.ile.ng` / `@ile.test` via `excludeMarketplaceFixtureHosts`. Web + Flutter marketplace paths call those APIs.

## DB fixture cleanup (NOT executed on production)

- Script: `scripts/cleanup-marketplace-fixtures.ts`
- Dry-run lists fixture host emails + published property IDs.
- `--execute` soft-archives (`ARCHIVED` / suspended moderation) only.
- Refuses `--execute` when `NEON_BRANCH`/`DATABASE_URL` looks like production.
- **Never deletes** bookings, payments, payouts, refunds, or ledger rows.

### How to review fixture IDs (dry run)

```bash
npx tsx scripts/cleanup-marketplace-fixtures.ts
```

**Dry run (2026-11-10, not executed):** 116 `@test.ile.ng` / `@ile.test` users; **47** published fixture properties listed for soft-archive candidates. Financial history untouched. `--execute` refused/not used against production.

Do not pass `--execute` against production Neon without explicit PO approval.
