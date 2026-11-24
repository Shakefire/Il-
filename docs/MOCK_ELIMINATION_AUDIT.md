# Mock / Placeholder / Simulation Elimination Audit

**Date:** 2026-11-13  
**Scope:** `apps/mobile` (Flutter), `src/` (Next.js), `backend/` (Fastify)  
**Prior art:** [MOCK_DATA_REMOVAL_REPORT.md](./MOCK_DATA_REMOVAL_REPORT.md), [MARKETPLACE_FIXTURE_FILTER.md](./MARKETPLACE_FIXTURE_FILTER.md)

---

## Summary

| Area | Findings (approx.) | Fixed this pass | Retained |
|---|---|---|---|
| Backend Fastify | 22 high-risk | Payment/SMS/email/push fail-closed; `/test-email` gated; transfer mocks env-gated | Seed, ledger enums, notification `mock_mode` column, test-time mocks |
| Next.js `src/` | 8 residual | None required beyond prior empty-state work | Input `placeholder=` attrs, image fallback SVG, `DESTINATIONS`, seed `PROPERTIES` |
| Flutter mobile | 12 residual | Guest shells empty states; mock Paystack return URL host-gated | Skeletons, design-system `demo` route, unit `MockClient` under `test/` |
| Tests / docs | — | `tests/production-mock-safety.test.ts` | All `tests/*` HTTP mocks, marketplace fixture unit tests |

**Production DB:** not touched. Fixture cleanup script remains dry-run only.

---

## Inventory

### Backend — payments / finance

| Location | Classification | Status |
|---|---|---|
| `payments.service.ts` init → `payment=mock` + `MOCK_DEV` | Production mock (was) | **REPLACED** — fail-closed via `canUsePaystackDevMocks()`; mock URL only in non-prod |
| `payments.service.ts` `verifyPayment` auto-success without key | Production mock (was) | **REPLACED** — fail-closed in production; mock verify retained for test/dev |
| `paystack-transfer.service.ts` recipient/transfer/verify mocks | Production mock (was, when key missing) | **REPLACED** — uses `canUsePaystackDevMocks()`; production returns error |
| `finance.service.ts` `PAYSTACK_MOCK_TRANSFERS` refund skip | Env-gated sim | **HARDENED** — `isPaystackMockTransfersEnabled()` always false in production |
| `config/env.ts` `PAYSTACK_MOCK_TRANSFERS` in production | Env risk | **BLOCKED** — forced `false` + loud error (no silent mock); call sites also fail-closed |
| `bank-resolution.service.ts` “MOCK VERIFIED ACCOUNT” | Dev-only sim | **RETAINED AS DEV FALLBACK** — already refused outside development/test |
| `bookings` direct payment bypass routes | Dead attack surface | **RETAINED AS DISABLED** — permanently decommissioned responses |
| `db/schema/payments.ts` default `MOCK_NIGERIAN_GATEWAY` | Schema default | **RETAINED** — column default; live rows use `PAYSTACK` |
| `server.ts` “Mock (dev)” log | Logging | **REPLACED** — production shows `UNCONFIGURED (fail-closed)` |

### Backend — auth / notifications / debug

| Location | Classification | Status |
|---|---|---|
| Email `EMAIL_PROVIDER=console` / missing key → pretend success | Production mock (was) | **REPLACED** — production fail-closed (`sendOk=false`) |
| Termii SMS console mock success | Production mock (was) | **REPLACED** — production fail-closed |
| FCM / Web Push console mock success | Production mock (was) | **REPLACED** — production fail-closed |
| Auth OTP generation | Real crypto OTP | **RETAINED AS REAL** — no fixed `000000` bypass in Fastify |
| `health.routes.ts` `POST /test-email` | Debug route | **HARDENED** — 404 in production |
| Notifications ledger `mock_mode` column | Delivery metadata | **RETAINED** — records whether a send was mock |

### Backend — marketplace / seed

| Location | Classification | Status |
|---|---|---|
| `marketplace-fixtures.ts` + SQL exclude | Fixture filter | **RETAINED** — `@test.ile.ng` / `@ile.test` hidden from public browse/search |
| `db/seed.ts` + `src/data/properties.ts` | Seed catalog | **RETAINED AS SEED** — not served by marketplace APIs |
| `scripts/cleanup-marketplace-fixtures.ts` | Ops tool | **RETAINED** — dry-run; no production execute in this pass |

### Next.js

| Location | Classification | Status |
|---|---|---|
| Homepage / search / stay / API property routes | Prior static fallbacks | **ALREADY REMOVED** (see MOCK_DATA_REMOVAL_REPORT) — empty/error states |
| `src/data/properties.ts` `PROPERTIES` | Seed / design catalog | **RETAINED AS SEED** — not imported by marketplace pages |
| `DESTINATIONS` on homepage | Marketing tiles | **RETAINED** — destination chips, not listing inventory |
| `src/lib/placeholders.ts` SVG fallback | Image skeleton | **RETAINED AS SKELETON** |
| Form `placeholder="…"` attributes | UX hints | **RETAINED** — not business data |
| `/images/placeholder-property.jpg` cover fallback | Missing-media fallback | **RETAINED** — not a demo listing |

### Flutter mobile

| Location | Classification | Status |
|---|---|---|
| `SampleStayPass` / `SampleConciergeThread` on bookings/inbox | Demo UI | **REMOVED** from guest shells — empty-state `GuestSignInGate` |
| Deprecated sample widgets | Dead demo | **RETAINED AS DEPRECATED STUBS** (`SizedBox.shrink`) for compile safety |
| `mock_auth.dart` | Legacy constants | **RETAINED AS DEPRECATED** — unused by production auth UI |
| Design-system `propertyDetailsPath('demo')` | Design kit | **RETAINED AS DESIGN REFERENCE** |
| Loading skeletons | UX | **RETAINED AS SKELETON** |
| `PaystackCheckout` `payment=mock` | Client sim | **HARDENED** — accepted only on localhost / local tunnel hosts |
| `test/**` `MockClient` HTTP | Unit fixtures | **RETAINED AS TEST FIXTURE** |

---

## Code introduced this pass

- `backend/src/lib/payment-mocks.ts` — shared gates
- `tests/production-mock-safety.test.ts` — mock-mode + empty-API ≠ demo catalog contracts
- This document

---

## What was intentionally not done

- No production Neon wipe / soft-archive of leftover `@test.ile.ng` rows (ops script exists; requires explicit approval).
- No deletion of `PROPERTIES` seed catalog or Flutter design-system preview.
- No indiscriminate removal of strings matching `placeholder` in form fields.
- No full Flutter release build (disk constrained).

---

## Verification (2026-11-13)

| Suite | Result |
|---|---|
| `tsx --test tests/production-mock-safety.test.ts tests/marketplace-fixtures.test.ts` | **10/10 pass** |
| `flutter test test/core/paystack_checkout_test.dart test/features/editorial_guest_ui_test.dart` | **8/8 pass** |
| Full Flutter build / wide backend DB suites | **Not run** (disk + scope) |

```bash
node ./node_modules/tsx/dist/cli.mjs --test tests/production-mock-safety.test.ts tests/marketplace-fixtures.test.ts
cmd /c "C:\src\flutter\bin\flutter.bat test test\core\paystack_checkout_test.dart test\features\editorial_guest_ui_test.dart"
```

### Blocker note

Local `.env` may set `NODE_ENV=production` while also enabling mock-oriented flags (`PAYSTACK_MOCK_TRANSFERS`, `SMS_PROVIDER=console`). Boot no longer crashes; Paystack/email/SMS mocks stay forced off / fail-closed until real credentials and non-console providers are configured. Confirm production deploy env does **not** rely on console/mock providers.
