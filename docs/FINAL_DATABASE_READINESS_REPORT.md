# Final Database Readiness Report

**Date:** 2026-11-10  
**Environment classified:** Neon `NEON_BRANCH=production` — treat as production.

---

## Migration status

| Migration | Intent | Prod status |
|---|---|---|
| 0000–0003 | Core + reservation + reliability | Assumed present (app functions) |
| 0004 | Core notifications tables | **Missing on prod** (`notification_deliveries`, `device_tokens`, `notification_inbox` absent — observed during tests as non-fatal) |
| 0005 | Phone OTP columns + notification preferences | **Still not on prod** (prior reports; `phone_verification_attempts` missing until test additive alter) |
| **0006** | `host_payout_mode` + payout mode/exception columns | **Artifact only** — `backend/src/db/migrations/0006_host_payout_mode.sql` |

---

## 0006 contents (non-prod apply first)

- `platform_settings.host_payout_mode` DEFAULT `'MANUAL'`
- `payouts.payout_mode` DEFAULT `'MANUAL'`
- `payouts.exception_code` / `exception_reason`

Additive / safe. Default MANUAL preserves existing check-in settlement behavior until admin opts into AUTOMATIC.

---

## What was NOT done

- No `drizzle-kit migrate` / formal migration apply against production.
- No fixture soft-archive `--execute` against production.
- No financial history deletes.

## Note on test additive alters

`tests/final-payout-modes.test.ts` used `ADD COLUMN IF NOT EXISTS` for payout-mode columns (and phone OTP columns required by Drizzle schema) so the suite could run against the shared Neon URL. That is **not** a substitute for reviewed migration apply of 0005 + 0006. Formal rollout should still apply SQL artifacts through the normal change process.

## Recommended next ops steps (human)

1. Apply 0004 → 0005 → 0006 on a **non-prod** Neon branch; verify.
2. Apply to production only with PO sign-off.
3. Dry-run `scripts/cleanup-marketplace-fixtures.ts`; review IDs; execute only on approved non-prod or after PO approval for prod soft-archive.
