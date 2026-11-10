# Cross-Platform Consistency Report

**Date:** 2026-11-10  
**Canonical API:** Fastify (`backend/src`)  
**Clients:** Next.js web (`src/`), Flutter (`apps/mobile/`)

---

## Domain parity

| Domain | Fastify | Web | Flutter | Notes |
|---|---|---|---|---|
| Auth / session | Yes | Cookie/BFF + shared auth | `IleApi` auth | Aligned |
| KYC / host onboarding | Yes | Host dashboard | Host onboarding screens | Aligned |
| Properties / marketplace | Yes + fixture email filter | API routes → services (no static fill) | Explore → `/api/properties` | Mock fallbacks removed from web paths |
| Booking lifecycle | PENDING_HOST→PAYMENT_PENDING→CONFIRMED | BookingModal / trips (same-tab Paystack + verify) | In-app WebView Paystack + Fastify verify; wait UI polls SoT only | Preserved; no fake accept |
| Finance / payouts | `FinanceService` + ledger | Admin finance + host earnings | Host wallet / withdraw | Mode labels added; clients do not set status |
| Notifications | Orchestrator | Web push/inbox where wired | FCM registration | Non-fatal when 0004/0005 tables missing on prod |

---

## Finance divergence closed this pass

- Next `/api/admin/settings` now requires `requireAdminSession` and routes through audited `adminService.updateSettings` (includes `hostPayoutMode`).
- Host payout AUTOMATIC/MANUAL is server-stamped on payout rows; web admin configures mode; Flutter/web only display wallet projections.
- Commission remains snapshot-on-booking; clients never invent fees.

---

## Remaining intentional differences

- Web admin has full finance ops UI; Flutter host app is host-facing only (wallet, bank, withdraw submit).
- Design-system preview routes may reference a `demo` slug for UI kit — not marketplace data.
- `src/data/properties.ts` retained for **seed only**, not live marketplace fill.

---

## Tests

- `tests/final-payout-modes.test.ts` — 6/6 pass (mock transfers).
- Existing marketplace fixture filter tests remain the gate for `@test.ile.ng` exclusion.
