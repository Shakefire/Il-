# FINAL PLATFORM INTEGRITY — Audit (Phase 1)

**Date:** 2026-11-10  
**Scope:** Host payout AUTOMATIC|MANUAL, cross-platform consistency, mock apartments, DB readiness.  
**Hard constraints observed:** no deploy, no commit/push, no live Paystack transfers (mock/test adapters only), no production Neon mutations.

---

## 1. Environment classification

| Signal | Observed |
|---|---|
| `NEON_BRANCH` | `production` |
| `DATABASE_URL` | Neon-hosted Postgres (`*.neon.tech`) |
| `PAYSTACK_MOCK_TRANSFERS` | `true` (safe for transfer tests) |
| Migration 0005 on prod | Still **not** confirmed applied (prior reports); treat as pending |

**Decision:** Treat DATABASE_URL as production. Do **not** run new migrations, fixture deletes, or data cleanup against this URL. Ship SQL + scripts as reviewed artifacts only; tests may use `ADD COLUMN IF NOT EXISTS` for local/shared-branch safety when columns are additive.

---

## 2. Booking / money flow (canonical — Fastify)

1. Guest books → `PENDING_HOST`
2. Host accepts → `PAYMENT_PENDING` + Paystack init
3. Backend-verified guest payment (`verifyPayment` / signed webhook → `processSuccessfulPayment`) → payment `SUCCESS`, booking `CONFIRMED`
4. Idempotent: `host_earnings` PENDING + ledger `BOOKING_PAYMENT_RECEIVED` + payout row `HELD` (commission **snapshot** on booking at create time)
5. Settlement today: guest check-in + calendar + hold → `CHECKIN_RECOGNITION` → payout `READY_FOR_PAYOUT`
6. Disburse: admin `disbursePayout` or host `requestHostWithdrawal` → Paystack transfer (mock in test) → `PROCESSING`/`PAID`; uncertain = reconcile, not blind retry

**Preserved invariants:** double-entry ledger, commission snapshots (never retrocalc), wallet = payout status projection, no invented fees.

---

## 3. Gap vs PO — payout modes

| Requirement | Current state | Action |
|---|---|---|
| Platform setting `AUTOMATIC` \| `MANUAL` | Missing on `platform_settings` | Add `host_payout_mode` (default `MANUAL`) |
| Stamp mode on payout / audit | Missing | Add `payouts.payout_mode` at creation |
| AUTOMATIC: pay after verified payment, **check-in must NOT block** | Settlement always requires check-in | New post-payment AUTOMATIC release + transfer path |
| MANUAL: payable/pending + admin approve/hold/reject | HELD→check-in→READY→admin disburse; no hold/reject | Keep gates; add hold/reject with reason |
| Mode switch does not drain history / reverse in-flight | N/A | Settings update only; stamp per-payout |
| No bank → admin-visible exception, not fake success | Missing | `exception_code` / `exception_reason` |
| Admin UI: mode + commission + actor + confirm | Commission edit only; settings Next route lacks admin auth | Host Payout Configuration panel + secure settings route |
| Tests both modes + switch + idempotency | Phase 7 covers check-in path only | New focused tests (mock transfers) |

### AUTOMATIC vs HELD→READY (explicit PO alignment)

Under **AUTOMATIC**, on backend-verified payment:

1. Create payout stamped `payout_mode=AUTOMATIC` (still starts as HELD briefly inside the payment tx for ledger create order).
2. Immediately post `CHECKIN_RECOGNITION` (escrow → host payable + commission) **without** guest check-in — keeps ledger balanced for subsequent `HOST_PAYOUT_DISBURSED`.
3. Move payout → `READY_FOR_PAYOUT`, then initiate host transfer if verified bank exists.
4. If no verified bank → leave payable ready with `exception_code=NO_VERIFIED_BANK` (admin-visible); **never** mark PAID.

Under **MANUAL**, keep existing check-in / hold / settlement gates. Mode switch Manual→Auto must **not** auto-drain historical HELD/READY rows. Auto→Manual must not reverse or duplicate PROCESSING/PAID.

---

## 4. Mock / demo apartments

| Path | Issue |
|---|---|
| `src/data/properties.ts` | Curated static catalog — OK for seed/design; **not** OK as live marketplace fill |
| `src/app/api/properties/route.ts` | Falls back to static PROPERTIES when DB empty/error |
| `src/app/api/properties/[slug]/route.ts` | Static fallback after DB miss |
| `src/app/api/search/route.ts` | Static filter fallback on search error |
| `src/app/page.tsx` | Merges remaining static into homepage stays |
| `src/app/search/page.tsx` | Initial state = PROPERTIES |
| `src/app/stay/[slug]/StayDetailClient.tsx` | Prefills from static match |
| Marketplace fixture filter | Already excludes `@test.ile.ng` / `@ile.test` hosts in Fastify search/list — verify web+Flutter still hit those APIs |

**Action:** Remove production UI/API fallbacks to static apartments; empty/error states instead. Keep `PROPERTIES` for `seed.ts` only. Soft-archive script for fixture hosts — **do not execute on prod**.

---

## 5. Cross-platform consistency

| Domain | Canonical | Web | Flutter |
|---|---|---|---|
| Auth / KYC / properties / bookings | Fastify | Next BFF → Fastify / shared services | `IleApi` → Fastify |
| Finance / payouts | Fastify `FinanceService` | Admin + host dashboard call finance APIs | Host wallet / withdraw |
| Risk | Next admin settings route mutates DB without `requireAdminSession` | Fix | N/A |
| Risk | Client must never set payout status or hold Paystack secrets | Verify | Verify |

---

## 6. Security notes (Phases 5–6)

- Flutter/web must not embed Paystack secret keys.
- Payout status transitions only on server.
- IDOR: host wallet/payouts scoped by session `userId`; admin routes require admin session.
- Do not expose full account numbers to clients (masking already present).

---

## 7. Implementation order (this workstream)

1. Schema + migration artifact `0006` (not applied to prod)
2. AUTOMATIC/MANUAL finance paths + admin settings/UI + hold/reject
3. Mock apartment path cleanup + fixture cleanup script (not executed)
4. Consistency + host copy updates
5. Focused tests + honesty reports
6. Git push readiness report only (no commit/push)

---

## 8. Out of scope / non-goals

- Production deploy or Neon migration apply
- Live Paystack transfers
- Retroactive commission recalculation
- Invented withdrawal fees
- Deleting financial history for fixture cleanup
