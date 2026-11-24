# Ilé Platform — Phase 4/5 Remediation & Production Acceptance Report

**Date:** 2026-11-23  
**Workspace:** `C:\Users\user\Desktop\NEXT_HOME`  
**Primary deliverable:** code + tests + builds (this document is supporting evidence only)  
**Status legend:** `PASS` | `PARTIAL` | `FAIL` | `BLOCKED` | `NOT RUN`

---

## House Pass — Complete Feature Removal

**Status: PASS**

Owner decision: Ilé no longer has a House Pass / digital access-pass product. No QR, access-token pass, or smart-lock replacement was added.

### Removed / retired
| Surface | Change |
|---|---|
| Backend module | Deleted `backend/src/modules/bookings/house-pass.ts` |
| Stay details | Added `stay-details.ts` — ordinary confirmed-stay summary (dates, neighborhood/city, stored arrival notes only) |
| Fastify | `GET /:id/house-pass` removed entirely in Phase 5; `GET /:id/contact` → stay details |
| Next.js | `house-pass` API route deleted in Phase 5; contact route kept |
| Payments | Removed `bookingAccessPassEmail` / “House Pass & Arrival Guide” dispatch; payment verify still → `CONFIRMED` independently |
| Web Trips | Access Pass / gate clearance UI replaced with stay details (check-in/out + arrival notes) |
| Flutter | `getStayDetails` + “Stay details” sheet; House Pass CTA removed |
| Host onboarding | Cleared default `Solar + Inverter with Generator Backup` preselect |
| Public listing copy | Stay detail no longer promises a house pass |
| Defaults | `defaultThingsToKnow` no longer invents check-in times, smart lock, Solar+Inverter, CCTV, or caution fee |

### Preserved
- Booking lifecycle, confirmation, history, refunds, reviews, support
- Check-in/out dates and legitimate stored arrival notes
- `property_private_details` host-side fields (not exposed as a guest House Pass product)
- Phase 1 timers (120s host / 10m payment) and Phase 2 finance rules

### Post-removal search
Repo TypeScript/Dart product code is clean after Phase 5 (no 410 stubs, no Flutter alias). Only audit/tests/migration history may mention House Pass.

**No exclusive `house_pass` tables existed.** Migration `0011` records removal + adds `rate_limit_buckets` only.

---

## Phase 4 — Refund contradiction

**Status: PASS (code) / PASS (tests on local PGlite)**

### Fix
`admin-refund.service.ts` no longer blanket-rejects `CANCELLED` / `EXPIRED` bookings.  
Admin refunds require a verified SUCCESS payment, reserve from commission account **1040**, never revive the booking, never create host earnings, never debit host wallet.

Preview now surfaces `latePaymentReconciliation` and blocks when 1040 has no funds.

### Regression coverage (`tests/phase4-remediation.test.ts`)
Runner forced to local PGlite only (`scripts/run_phase4_tests.ps1` + `tests/force-phase4-db.mjs`; `DATABASE_URL` empty; `ILE_PGLITE_DIR=.data/phase4-test-db`). **No Neon.** Exit **0** — **11 pass / 0 fail**.

| Case | Intent | Result |
|---|---|---|
| Payment before deadline | Confirmed stay refundable | **PASS** |
| Late payment after cancel/expire | Refundable recon; no revival; no host earnings | **PASS** |
| Duplicate payment | Terminal booking refundable from 1040 | **PASS** |
| Duplicate webhook / idempotency | Consumed ≤ paid | **PASS** (concurrent case) |
| Normal cancel without payment | Not refundable | **PASS** |
| Late-payment recon refund | Allowed when verified payment exists | **PASS** |
| Partial then full | Refundable shrinks correctly | **PASS** |
| Concurrent execute | Consumed ≤ payment | **PASS** |
| Failed / unverified provider | FAILED / RECONCILIATION_REQUIRED | **PASS** |
| No host earnings from late/dup | Asserted | **PASS** |
| No revival | bookingStatus stays CANCELLED/CONFIRMED unchanged | **PASS** |
| Accounting / fundingAccount 1040 | Asserted | **PASS** |
| Expiration targeting | Targeted expire cannot sweep globally; CONFIRMED untouched | **PASS** |

---

## Phase 4 — Commission funding (account 1040)

**Status: PASS (safety) / BLOCKED (live cash proof)**

**What 1040 is:** ledger ASSET `Platform Commission Funds` — reconcilable **ledger** cash for admin guest refunds, **not** assumed to be Paystack settlement float or bank cash.

**Implemented:** reserve on 1040 → mock/live Paystack refund → settle or release; host payable untouched; insufficient 1040 → `INSUFFICIENT_COMMISSION` block.

**Owner decision needed (BLOCKED):** prove real available commission cash before enabling live Paystack refunds in production. Live refund execution remains safe-blocked when 1040 balance is insufficient. Tests use Paystack mocks only.

---

## Phase 4 — Expiration incident (`expireDueBookings` without id)

**Status: PASS (code + PGlite test) / BLOCKED (restore)**

### Investigation
- Configured `DATABASE_URL` host: `ep-winter-bonus-b46e0tna-pooler.c-6.us-east-2.aws.neon.tech` db: `neondb` (**shared/Neon**).
- Local logs under `.data/` contained no durable expire worker dump of affected booking IDs.
- Prior risk: guest/host list reads called **global** `expireDueBookings(50)` as a side effect.

### Code fix
- Split API: `expireDueBookingsTargeted(id)` vs `expireDueBookingsGlobal(limit)`.
- Targeted path cannot sweep other IDs; confirms CONFIRMED never matches expire predicates.
- Removed global expire side-effects from `getUserBookings` and `getHostBookings`.
- Global scope remains worker (`server.ts`) + secured cron route only.

### Evidence list of affected records
**BLOCKED / incomplete:** no safe local log artifact listing production booking IDs. No PII dump performed.  
**Owner decision BLOCKED:** do **not** auto-restore bookings cancelled by a global expire sweep; prepare recovery proposal only after owner approval (no financial reverses / compensating notifications without approval).

---

## Phase 4 — Migrations 0008 / 0009 / 0010 / 0011

**Status: PASS (PGlite apply) / BLOCKED (Neon/production apply)**

| Migration | Purpose | Apply result |
|---|---|---|
| 0008 | Financial retention FKs + unique indexes (guarded) | OK on PGlite |
| 0009 | Commission accounts 1040/1050/5030 + host_base_price | OK on PGlite |
| 0010 | Support / favourites / review_moderation + restrict FKs | OK on PGlite |
| 0011 | House Pass removal marker + `rate_limit_buckets` | OK on PGlite |

**Apply targets (verified safe, Neon untouched):**  
- `.data/phase4-migration-apply/ile_phase4.db` via `npx tsx scripts/apply_migrations_pglite.ts`  
- `.data/phase4-test-db/ile_dev.db` (seeded from phase2 PGlite + 0008–0011) for the forced local test suite  

Tables present on test DB include: `favourites`, `rate_limit_buckets`, `review_moderation`, `support_cases`, `ledger_accounts`, `bookings`, `payments`.

**Production/shared Neon apply: BLOCKED** pending owner approval (host matches shared Neon pooler).

Historical migrations were not rewritten. No history deleted to force indexes.

---

## Phase 4 — Notifications (5 channels)

**Status: PASS**

- All 5 channels remain (inbox, Resend email, Termii SMS, FCM, Web Push).
- Support case open/reply now dispatches via `notifyUserEvent` with **inbox + email + push** (idempotent orchestrator). SMS is **not** required for every support message; Termii remains SMS-only for transactional SMS events.
- Recipient mapping uses requester/admin user email from `users` (no cross-substitution).

---

## Phase 4 — Distributed rate limiting

**Status: PASS** (hardened further in Phase 5 — strict buckets no longer fail-open unlimited)

- `rate-limit.ts` uses Postgres/PGlite `rate_limit_buckets` + bounded memory fallback.
- Webhooks + health remain exempt (`isGlobalRateLimitExempt`).
- Covers auth/booking/payment/global paths already wired in Fastify.

---

## Phase 4 — Workflows & misleading defaults

**Status: PASS**

- House Pass removed from guest/host/admin workflows as above.
- Reviews / favourites / support retained.
- `defaultThingsToKnow` stripped of invented check-in, Solar+Inverter preselect, CCTV, caution fee.
- Flutter host onboarding power type default cleared.
- `/messages` remains coming-soon (no guest-host messaging implemented).

---

## Phase 4 — Next.js build DB connection

**Status: PASS**

- Removed eager `export const db = getDb()` side effect; `db` is now a lazy Proxy so `next build` route analysis does not open Neon at import time.

---

## Builds & APK

**Disk reclaim (this pass):** `C:` FreeGB **0.61 → ~4.67** after clearing `apps/mobile/build` intermediates (APK kept), npm/pip caches, temp leftovers, CrashDumps, and disposable `.data/phase1-*` copies. Did not hit a sustained ≥5 GB free (peak ~4.67 before builds). After Next + Flutter builds FreeGB dipped (~1.3) then recovered to ~2.3 after trimming intermediates.

| Check | Command | Exit | Status |
|---|---|---:|---|
| Migrations 0008–0011 (PGlite) | `npx tsx scripts/apply_migrations_pglite.ts` (+ re-apply onto `.data/phase4-test-db`) | **0** | **PASS** |
| Phase 4 tests (forced PGlite) | `powershell -File scripts/run_phase4_tests.ps1` | **0** | **PASS** — 11 pass / 0 fail / 0 skipped (~6.3s); Neon not used |
| Root `tsc --noEmit` | `npx tsc --noEmit` | **0** | **PASS** (`ignoreBuildErrors: false` in `next.config.mjs`) |
| Next lint | `npx next lint` | — | **NOT RUN** this pass (prior: ESLint not preconfigured / interactive) |
| Next build | `npm run build` with `DATABASE_URL=""` | **0** | **PASS** |
| Flutter analyze / test | — | — | **NOT RUN** this pass (disk budget used for release APK) |
| Flutter release APK | `flutter build apk --release` (`GRADLE_USER_HOME=C:\Users\user\.gradle`) | **0** | **PASS** — fresh APK produced |
| Device install | — | — | **BLOCKED** (no emulator/device attached this pass) |

Fresh release APK: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (60.4 MB, rebuilt this pass). Debug/local signing ≠ Play Store; no production keystore invented.

---

## Owner decisions (material blocks)

1. **Restore bookings** cancelled by accidental global expire → **BLOCKED** (proposal only; no auto-restore).
2. **Apply migrations 0008–0011 to shared Neon/production** → **BLOCKED** (applied only to disposable PGlite).
3. **Enable live Paystack refunds** without proven 1040/real cash → **BLOCKED** (insufficient funds path already refuses execute).

---

## Summary verdict

| Workstream | Status |
|---|---|
| House Pass complete removal | **PASS** |
| Refund contradiction fix | **PASS** (code + PGlite suite) |
| Commission funding safety | **PASS** / live cash **BLOCKED** |
| Expiration targeting fix | **PASS** (code + PGlite suite) / restore **BLOCKED** |
| Migrations | **PASS** on PGlite / **BLOCKED** on Neon |
| Notifications | **PASS** |
| Distributed rate limit | **PASS** |
| Defaults / workflows | **PASS** |
| Builds / APK | **PASS** (`tsc`, `next build`, fresh release APK); device install **BLOCKED** |

Prior forensic audit content from earlier revisions remains historically useful in `docs/audits/phase-1-booking-payments-notifications.md` and git history; this file is the Phase 4 + House Pass removal evidence report.

---

## Phase 5 — Final Remediation and Production Acceptance

**Date:** 2026-11-23  
**Primary deliverable:** code + tests + builds (this section is supporting evidence only)  
**Status legend:** `PASS` | `PARTIAL` | `FAIL` | `BLOCKED` | `NOT RUN`

### 1. Final House Pass cleanup — **PASS**
Deleted residual Fastify `GET /:id/house-pass` (410), Next `src/app/api/bookings/[id]/house-pass`, Flutter `getHousePass` alias, and guest copy promising a digital House Pass. Stay details (`GET /:id/contact` / `getStayDetails`) remain. Repo TypeScript/Dart product search is clean; only audit/tests/migration history mention House Pass.

### 2. Distributed rate limiting — **PASS**
- Shared Postgres/PGlite `rate_limit_buckets` with atomic `INSERT … ON CONFLICT … RETURNING`.
- Critical buckets (login/register/OTP/password-reset/pay-init/refund/admin/booking-create): **never fail-open unlimited** — bounded in-memory fallback, or temporary retryable 503 reject if memory also fails.
- Auth/payment/booking/admin routes await `consumeRateLimitAsync(..., "strict")`.
- Global middleware uses durable async consume; Fastify `trustProxy: true` + leftmost `X-Forwarded-For`.
- Paystack webhooks remain exempt from ordinary user limits (signature + idempotency unchanged).
- Suite: `tests/phase5-production-acceptance.test.ts` via `scripts/run_phase5_tests.ps1` (forced PGlite; Neon not used).

### 3. Notifications (5 channels) — **PASS** (mocked / config-verified)
| Channel | Destination | Verification | Status |
|---|---|---|---|
| In-app inbox | user id | Mocked upsert in Phase 5 suite | **Mocked** |
| Resend email | email | Console provider in test; support open/reply includes email | **Mocked** / config via env |
| Termii SMS | phone (E.164) | Mocked OTP path; not required for every support reply | **Mocked** |
| FCM | device token | Distinct from `web_push`; deepLink data supported | **Mocked** |
| VAPID Web Push | browser endpoint | Distinct provider registration / expiry handling | **Mocked** |

Support case open/reply: inbox + email + push; SMS not for every reply. Channel failures remain independent. **Delivery verified:** not claimed (accept ≠ delivery; no live credentials exercised).

### 4. Flutter — **PASS** / device **BLOCKED**
- `flutter analyze`: **0 errors**; remaining items are infos (+ unused-field warnings fixed by surfacing validation/loading UI on date picker).
- `flutter test`: **72 pass / 0 fail**; House Pass alias absent.
- Fresh release APK: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` — **60.4 MB**, package `ng.ilestays.ile_mobile`, version `1.0.0+1`, **debug signing** (≠ Play Store).
- Device/emulator install: **BLOCKED** (no Android device; only windows/chrome/edge present).

### 5. Cross-platform regression — **PARTIAL**
Backend + DB invariants covered by Phase 4/5 PGlite suites (booking/refund/expire/stay details/rate-limit/notifications). Browser critical-flow walkthrough: **NOT RUN**. Guest-host messaging not implemented (`/messages` coming-soon; House Pass not reintroduced).

### 6. Expiration forensics — **PASS** (code) / restore **BLOCKED**
Confirmed permanent fix: list reads do not global-expire; worker (`server.ts` 15s interval) + secured cron route own global sweep; advisory lock `99281` prevents double-sweep; CONFIRMED protected (PGlite targeted expire). No safe local artifact listing production booking IDs. **No auto-restore.** Recovery proposal only after owner approval.

### 7. Neon migrations 0008–0011 — **PASS** (PGlite) / apply **BLOCKED**
Validated on disposable PGlite in Phase 4; Phase 5 reconfirmed files present. Shared Neon (`ep-winter-bonus-…`) apply: **BLOCKED** pending owner approval. Prepare plan: apply 0008→0011 in order on a Neon branch first, verify `rate_limit_buckets` + ledger 1040/1050/5030 + support/favourites tables, then production — only with explicit owner approval.

### 8. Account 1040 funding — **PASS** (safety) / live cash **BLOCKED**
1040 is ledger ASSET “Platform Commission Funds” — reconcilable **ledger** cash, not assumed Paystack settlement float or bank cash. Live refunds stay blocked when funding unverified/insufficient; host wallets never debited/funded for guest refunds. Evidence still required before enabling production refunds.

### 9. Infra — **PASS**
- `getDb()` skips `DATABASE_URL` during `NEXT_PHASE=phase-production-build` (Next injects `.env`); lazy `db` Proxy retained. Prior Phase 5 build logged a Neon connect before this guard; guard added and verified in source.
- Expire: in-process worker + secured cron (advisory-locked) — not an accidental double-writer.
- Health does not embed secret values; `trustProxy` enabled; CORS allow-list unchanged (no invented production URLs).

### 10. Final verification matrix

| Check | Result | Status |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | **PASS** |
| Phase 4 tests (forced PGlite) | 11 pass / 0 fail | **PASS** |
| Phase 5 tests (forced PGlite) | 16 pass / 0 fail | **PASS** |
| `flutter analyze` | 0 errors | **PASS** |
| `flutter test` | 72 pass / 0 fail | **PASS** |
| `flutter build apk --release` (`GRADLE_USER_HOME=C:\Users\user\.gradle`) | `app-release.apk` 60.4 MB | **PASS** |
| `npm run build` | exit 0 (compiled successfully) | **PASS** |
| Neon apply | owner approval required | **BLOCKED** |
| Live Paystack refunds / booking restore | owner decisions | **BLOCKED** |
| Device install | no Android emulator/device | **BLOCKED** |
| Browser critical flows | not exercised this pass | **NOT RUN** |

### Owner decisions (still material)
1. Restore bookings cancelled by accidental global expire → **BLOCKED** (proposal only; no mutations).
2. Apply migrations 0008–0011 to shared Neon → **BLOCKED**.
3. Enable live Paystack refunds without proven 1040/real cash → **BLOCKED**.

