# Host Platform — Environment setup (migration 0005)

**Date:** 2026-11-10  
**Rule:** Do not pretend migrations applied. Do not edit migration history files.

## Connected workspace DATABASE_URL (this session)

| Field | Value |
|------|--------|
| Provider | Neon (`*.neon.tech`) |
| Database name | `neondb` |
| Neon project metadata (`.neon`) | `projectId=dark-brook-21910964`, **branch label=`production`** |
| Paystack in this workspace | TEST keys only (`docs/CORE_PLATFORM_ENV.md`) |
| **0005 applied this session?** | **NO** |

### Why 0005 was not applied

`.neon` labels the connected branch as **production**. Autonomous remediation must not mutate a production-labeled Neon schema without explicit ops approval. Additive DDL was prepared at `scratch/apply-0005-additive.mjs` but **blocked / not run**.

### Drift verified (INSPECTION + AUTOMATED)

Before any apply attempt:

- `users.phone_verification_attempts` — **missing**
- `users.phone_verification_sent_at` — **missing**
- `notification_preferences` — **missing** (`to_regclass` null)
- `drizzle.__drizzle_migrations` — only genesis hash present (0001–0005 journal tags exist in repo but are not fully reflected in the live migration table)

Drizzle schema already declares the 0005 columns → ORM inserts into `users` fail until DDL lands.

## Production / staging migrate instructions (do not run from agent)

1. Confirm target branch (staging first, then production) in Neon console.
2. Backup / branch snapshot if required by ops policy.
3. From repo root with the **target** `DATABASE_URL`:

```bash
# Preferred: drizzle migrator (records journal correctly)
npx drizzle-kit migrate
```

4. Or apply only the additive SQL (idempotent):

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/0005_notification_prefs_phone_otp.sql
```

5. Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('phone_verification_attempts','phone_verification_sent_at');

SELECT to_regclass('public.notification_preferences');
```

6. Re-run DB-backed suites:

```bash
npx tsx --test tests/phase3-reservation-lifecycle.test.ts
npx tsx --test tests/phase7-checkin-wallet-settlement.test.ts
npx tsx --test tests/bank-account-resolution.test.ts
npx tsx --test tests/host-platform-p0-delete-archive.test.ts
npx tsx --test tests/host-platform-dashboard-earnings.test.ts
```

## Local/dev workaround used by new host tests

`tests/host-platform-*.test.ts` insert users via **raw SQL column lists** that omit drifted OTP columns so archive/earnings regressions can still run against the drifted DB.

## Safety

- No production deploy
- No git commit/push
- No live Paystack transfers (`PAYSTACK_MOCK_TRANSFERS` for tests)
