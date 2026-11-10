# Host Platform — Test report

**Date:** 2026-11-10  
**Runner:** `npx tsx --test` (no PowerShell pipes)  
**Flutter:** `flutter analyze` on touched host files

## AUTOMATED (this session)

| Suite | Result | Notes |
|-------|--------|-------|
| `tests/host-platform-api-parity.test.ts` | **3/3 pass** | Unpublish, payout-account, media-order, soft-archive invariants |
| `tests/host-platform-occupancy-media.test.ts` | **3/3 pass** | Occupancy formula, media order, countdown helper |
| `tests/host-platform-p0-delete-archive.test.ts` | **3/3 pass** | Archive preserves booking/payment/payout/refund; empty hard-delete; ownership |
| `tests/host-platform-dashboard-earnings.test.ts` | **2/2 pass** | 15 bookings lifetime aggregation + wallet reconcile |
| `tests/phase10-host-confirmation-audit.test.ts` | prior session pass | Lifecycle constants intact |

**Host-platform focused total this session:** **11/11 pass** (api parity + occupancy + p0 + earnings).

### DB drift caveat

Connected Neon missing 0005 columns. New host DB tests use raw SQL user inserts to avoid drizzle schema drift. Suites that insert via drizzle `schema.users` (phase3/phase7/bank) remain **blocked** until ops applies 0005 (`HOST_PLATFORM_ENV_SETUP.md`).

## Flutter analyze

Touched paths:

- `lib/features/host/**`
- `lib/core/api/ile_api.dart`
- `lib/core/api/api_client.dart`
- `lib/app/app_router.dart`
- `lib/core/constants/app_routes.dart`

Result: **0 errors**. `dart analyze` on touched host files reported only info-level lints (null-aware style / deprecations), cleaned where practical.

## MANUAL / UNVERIFIED

- Browser walkthrough of `/host/dashboard` tabs, archive confirm UX, bank modal.
- Flutter device/emulator against staging Fastify.
- Live Resend/Termii/FCM delivery.
- Live Paystack transfer (intentionally not initiated).
- Production `drizzle-kit migrate` for 0005 (documented only).

## Safety checks

- No deploy
- No commit/push
- No live money movement
- Booking lifecycle unchanged
- Wallet remains payout projection
