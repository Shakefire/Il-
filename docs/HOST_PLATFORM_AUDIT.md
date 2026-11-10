# Ilé Host Platform — Audit pointer

**Canonical evidence audit:** [`HOST_PLATFORM_AUDIT_REPORT.md`](./HOST_PLATFORM_AUDIT_REPORT.md) (2026-11-10).

This file is the stable entrypoint for host-platform audit status. Implementation outcomes live in:

- [`HOST_PLATFORM_IMPLEMENTATION_REPORT.md`](./HOST_PLATFORM_IMPLEMENTATION_REPORT.md)
- [`HOST_PLATFORM_TEST_REPORT.md`](./HOST_PLATFORM_TEST_REPORT.md)
- [`HOST_PLATFORM_ENV_SETUP.md`](./HOST_PLATFORM_ENV_SETUP.md)
- [`HOST_PLATFORM_API_REFERENCE.md`](./HOST_PLATFORM_API_REFERENCE.md)

## Finding ID map (audit → remediation)

| ID | Fix summary | Primary files | Tests | Remaining limits |
|---|---|---|---|---|
| H-P0-1 | Soft-archive when booking/finance history exists; never cascade delete bookings/payments/payouts/refunds/ledger | `backend/src/modules/hosts/hosts.service.ts` (`deleteProperty`), `admin.service.ts`, dashboard archive UX, `src/lib/api.ts` | `tests/host-platform-p0-delete-archive.test.ts`, `tests/host-platform-api-parity.test.ts` | Admin empty-listing hard delete still allowed when no history |
| H-P0-2 | Inspect Neon vs repo 0005; **not applied** — connected DB labeled production in `.neon` | `backend/src/db/migrations/0005_*.sql`, `docs/HOST_PLATFORM_ENV_SETUP.md` | DB suites still blocked for drizzle user inserts unless raw SQL / migrate | Ops must run 0005 on each Neon env; do not pretend applied |
| H-P1-1 | `getDashboard` full aggregation + wallet reconcile + property breakdown | `hosts.service.ts` `getDashboard` | `tests/host-platform-dashboard-earnings.test.ts` (>10 bookings) | Period = month-to-date only |
| H-P1-2 | Flutter host ops shell (dashboard, listings, requests, calendar, earnings, bank, alerts, profile) | `apps/mobile/lib/features/host/*`, `ile_api.dart`, `app_router.dart` | `flutter analyze` on touched files | Device E2E UNVERIFIED; KYC forms remain web-primary |
| H-P1-3 | Fastify parity: unpublish, payout-account, media-order | `hosts.routes.ts`, Next proxies share `hostsService` | `tests/host-platform-api-parity.test.ts` | Live HTTP integration against running Fastify UNVERIFIED this session |
| H-P2-1 | Occupancy metrics + host alerts + media order API | `getOccupancyMetrics`, `getHostAlerts`, `reorderPropertyMedia` | `tests/host-platform-occupancy-media.test.ts` | Dedicated alerts center beyond dashboard strip is partial |
| H-P2-2 | Removed “100% net payout”; accurate host rate vs guest list price language | dashboard create copy + overview/earnings labels | Manual/UNVERIFIED browser | Broader copy sweep may remain in marketing pages |
| H-P3-1 | Dashboard modular tabs (overview/properties/reservations/calendar/earnings/alerts/settings) | `src/components/host-dashboard/*`, `src/app/host/dashboard/page.tsx` | Static + existing suites | Full file still large; further route-segment split optional |

Guest booking lifecycle `PENDING_HOST → PAYMENT_PENDING → CONFIRMED`, ledger double-entry, wallet=payout projection, no invented fees, and no uncertain transfer auto-retry were preserved.
