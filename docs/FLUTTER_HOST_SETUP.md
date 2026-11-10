# Flutter Host App — Setup

## Prerequisites

- Flutter SDK matching `apps/mobile/pubspec.yaml` (`sdk: ^3.12.2`)
- Running Fastify backend (`backend/`) with valid `DATABASE_URL` (non-production for local mutate tests)
- Auth user with `role=host` (or `admin`) for shell access; guests can open `/host/onboarding` to start KYC

## Mobile env

`apps/mobile` uses `ApiConfig.baseUrl` (same origin pattern as guest). Point it at local Fastify (e.g. `http://10.0.2.2:4000` on Android emulator, `http://127.0.0.1:4000` on iOS sim / desktop).

## Host entry

1. Sign in → Profile → **Host dashboard** (hosts) or **Become a host** (guests)
2. Complete KYC at `/host/onboarding` (uploads via `/api/uploads`, bank resolve via `/api/host/onboarding/authority` + `/api/banks`)
3. Admin approves KYC → user can publish listings (server-enforced)

## Optional credentials

| Concern | Behavior if missing |
|---------|---------------------|
| Paystack secret | Bank list falls back to curated NUBAN codes; resolve may fail |
| R2 / uploads | Local `/uploads` storage path used |
| FCM / SMS | Existing mock adapters OK; inbox rows still persist in DB |

## Migrations

If schema gaps appear, add SQL under `backend/src/db/migrations/` and **document** apply steps. Do **not** run migrations against Neon labeled production without explicit authorization.

## No deploy / no commit

This workstream does not deploy, commit, push, or initiate live Paystack transfers from the Flutter client. Withdraw only calls `POST /api/host/wallet/withdraw`.
