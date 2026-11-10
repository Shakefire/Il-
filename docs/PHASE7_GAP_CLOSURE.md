# Ilé Phase 7 — Gap Closure Report

**Date:** 2026-11-08  
**Scope:** Close HIGH-PRIORITY testing gaps from `PHASE7_COMPLETION_REPORT.md`.  
**STOP:** Phase 8/9 not started. No production deploy. Awaiting approval.

---

## Results table

| # | Gap | Action | Result |
|---|---|---|---|
| 1 | Flutter analyze + focused tests | `flutter analyze` on Phase 7 paths; added `test/core/phase7_checkin_wallet_test.dart` (check-in UI rules, mocked confirm/wallet/withdraw) | **Pass** — 8/8 new + 5/5 booking lifecycle. Targeted analyze: **0 errors/warnings** (1 pre-existing-style `info` cleared). Full-app analyze still reports **pre-existing** infos/warnings outside Phase 7 (unused imports in screenshot test, underscores in UI files). |
| 2 | Web check-in + withdraw UI tests | No Playwright/Vitest/Jest in repo. Added pure helpers `src/lib/phase7-guest-host-ui.ts` + `tests/phase7-web-checkin-withdraw.test.ts` (CTA eligibility, bank/held/insufficient gates, mocked `api.confirmCheckIn` / `requestHostWithdrawal`) | **Pass** — 5/5 |
| 3 | Paystack webhook HMAC + replay | Added `tests/phase7-paystack-webhook.test.ts`; updated outdated remediation expectation (`FAILED` → `READY_FOR_PAYOUT`) | **Pass** — 5/5 webhook suite. Covers invalid sig rejection, fail restore, success pay-once, replay idempotency, late-fail does not demote `PAID` |
| 4 | Imbalanced settlement log noise | Root cause: **fixture/corrupt booking snapshots** where `accommodation ≠ hostNet + commission`, not a new Phase 7 settlement math bug. Guard added in `evaluateSettlementEligibility` to skip (not throw) imbalanced snapshots. Test `3b` proves HELD stays HELD. Trial balance test still balanced | **Closed** — real integrity guard + docs; leftover historic rows may still appear in `skipped[]` as fixture noise only |
| 5 | Whole-payout withdrawal limit | Documented (below); no redesign | **Documented** |
| 6 | Host transfer fee policy | Left ₦0; PO options listed (below) | **Documented / Deferred** |

### Backend Phase 7 re-run

```
npx tsx --test tests/phase7-checkin-wallet-settlement.test.ts \
  tests/phase7-paystack-webhook.test.ts \
  tests/phase7-web-checkin-withdraw.test.ts
```

| Suite | Result |
|---|---|
| `phase7-checkin-wallet-settlement.test.ts` | **12/12 pass** (was 11; added `3b` imbalance guard) |
| `phase7-paystack-webhook.test.ts` | **5/5 pass** |
| `phase7-web-checkin-withdraw.test.ts` | **5/5 pass** |
| **Total** | **22/22 pass** |

Honest note: Node may leave the process open after pass due to DB pool (pre-existing); suites themselves report `fail 0`.

### Flutter

| Command | Result |
|---|---|
| `flutter test test/core/phase7_checkin_wallet_test.dart test/core/booking_lifecycle_test.dart` | **13/13 pass** |
| Targeted `flutter analyze` on Phase 7 lib paths | Clean (no errors/warnings after unused-import cleanup in `app_router.dart`) |
| Full `flutter analyze` | Pre-existing project infos/warnings remain (auth screenshot unused imports, underscore style infos). **No Phase 7 functional failures.** |

---

## 4. Imbalanced fixture rows — findings

**What Phase 7 logged:** During `processDueSettlements` (test 3), cron can visit leftover DB candidates. When a booking’s financial snapshot does not zero-sum (`accommodationSubtotal !== hostNetAmount + hostCommissionAmount`), `LedgerService.postJournalEntry` throws `Double-entry imbalance detected…`.

**Verdict:** Fixture / historic corrupt snapshot artifact — **not** a bug in current Phase 7 release math. New Phase 7 helpers always set balanced legs (`amount + commission = accommodation`).

**Fix shipped:** Eligibility now returns `eligible: false` with reason `Settlement snapshot imbalanced…` before posting a journal. Job records these in `skipped` instead of exploding. New fixtures remain balanced; trial balance after Phase 7 journals stays balanced.

---

## 5. Whole-payout withdrawal limitation (medium)

**Current behavior:** `FinanceService.requestHostWithdrawal` reserves **whole** `READY_FOR_PAYOUT` rows only (FIFO). If requested amount cannot be filled by summing whole rows without exceeding the request, reserve fails with `RESERVE_FAILED` (“Withdraw exact available booking totals…”).

**Can hosts withdraw arbitrary amounts?** No — only combinations of whole payout rows ≤ requested amount (UI typically sends full `available`).

**Smallest change if PO wants partial amounts (recommendation only — not implemented):**
1. Add optional `payout_withdrawal_allocations` (or split column on `payouts`) for remainder after partial withdraw, **or**
2. Allow splitting one READY row into two rows (READY remainder + PROCESSING slice) inside the same transaction.

Recommend keeping whole-row semantics until product needs partial withdraw UX.

---

## 6. Fee policy (medium — no unilateral decision)

**Current:** Host withdrawal fee = **₦0**. Ledger account `5020` unused. UI/API `feePolicy.withdrawalFeeNaira = 0`.

**PO options (do not invent a flat fee in code):**
1. **Ilé absorbs** Paystack transfer fees → keep host net intact; expense via `5020` from operating accounts when fee is known.
2. **Deduct actual Paystack transfer fee** from host available amount at initiation (requires real fee from Paystack response / schedule — not a guessed flat fee).
3. **Keep ₦0** until volume justifies either (1) or (2).

---

## Files touched this gap closure

| Area | Paths |
|---|---|
| Docs | `docs/PHASE7_GAP_CLOSURE.md` |
| Settlement guard | `backend/src/modules/finance/finance.service.ts` |
| Web helpers + wiring | `src/lib/phase7-guest-host-ui.ts`, `src/app/trips/page.tsx`, `src/app/host/dashboard/page.tsx` |
| Tests | `tests/phase7-checkin-wallet-settlement.test.ts`, `tests/phase7-paystack-webhook.test.ts`, `tests/phase7-web-checkin-withdraw.test.ts`, `tests/paystack-remediation.test.ts` |
| Flutter | `apps/mobile/test/core/phase7_checkin_wallet_test.dart`, `apps/mobile/lib/app/app_router.dart`, `apps/mobile/lib/core/api/ile_api.dart` |

---

## Explicit non-goals (honored)

- No Phase 8 / Phase 9 work
- No invented host transfer fees
- No auto-retry of uncertain Paystack transfers (remain `PROCESSING`)
- No production deploy

---

**STOP. Await approval before Phase 8/9.**
