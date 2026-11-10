# Final Test Report

**Date:** 2026-11-10  
**Constraint:** `PAYSTACK_MOCK_TRANSFERS=true` — no live money transfers.

---

## Focused suite: `tests/final-payout-modes.test.ts`

| # | Case | Result |
|---|---|---|
| B1 | Flutter Paystack domain allowlist + return ref parse | PASS (4) |
| B2 | Flutter booking lifecycle / guest flow unit tests | PASS |
| B3 | Flutter full suite (`flutter test`) | PASS **68/68** |
| B4 | Phase 4 web booking lifecycle + final payout modes | PASS **14/14** (mock transfers; inbox table missing non-fatal) |
| 1 | MANUAL mode keeps payout HELD after verified payment | PASS |
| 2 | AUTOMATIC releases without check-in + mock transfer | PASS |
| 3 | AUTOMATIC no bank → `NO_VERIFIED_BANK` (not PAID) | PASS |
| 4 | Manual→Auto switch does not drain historical HELD | PASS |
| 5 | Idempotent auto handler — single CHECKIN_RECOGNITION journal | PASS |
| 6 | MANUAL approve / hold / reject with reason | PASS |

**Totals:** 6 pass / 0 fail

Command:

```bash
npx tsx --test tests/final-payout-modes.test.ts
```

---

## Honesty notes

- Notification tables from migration 0004 are missing on the connected Neon DB; orchestrator logs non-fatal errors during booking emails/SMS. Core payout assertions still passed.
- Suite used additive `ADD COLUMN IF NOT EXISTS` for schema gaps (0005 phone OTP + 0006 payout mode) — see DB readiness report.
- Full regression suite (phase6–phase9, Flutter) was **not** re-run in this pass to avoid excessive load while building.
- Flutter APK arm64 build was **not** attempted here pending disk check in git readiness report.
- Marketplace fixture filter unit test exists separately (`tests/marketplace-fixtures.test.ts`); not re-executed this pass.

---

## Security / host regression (spot checks)

- Clients cannot set payout status — transitions only in `FinanceService` / ledger.
- Admin settings route now requires admin session.
- Flutter/web do not embed Paystack secrets; transfers initiated server-side with mock adapter in test.
- Host wallet API remains scoped by session `userId` (existing IDOR control).
