# Flutter Host App — Test report

**Date:** 2026-11-10 (re-run)

## Flutter (focused)

Command:

```bash
cd apps/mobile
flutter test test/features/host_flow_test.dart test/core/phase7_checkin_wallet_test.dart test/core/booking_lifecycle_test.dart
```

| Suite | Tests | Result |
|-------|------:|--------|
| `test/features/host_flow_test.dart` | 13 | Pass |
| `test/core/phase7_checkin_wallet_test.dart` | 8 | Pass |
| `test/core/booking_lifecycle_test.dart` | 6 | Pass |
| **Total** | **27** | **All passed** |

Coverage intent:

- Role gate (guest vs host/admin)
- Dashboard / accept / decline / block-unblock / publish-unpublish-relist
- Onboarding status + submit
- Banks + payout-account update
- Withdraw submit (amount only)
- Notifications inbox + prefs
- Media-order payload
- Host payouts ledger mapping
- Guest check-in + wallet regression (phase 7)
- Booking lifecycle invariants (phase 5)

**Secure storage:** focused suites inject `MemorySessionTokenStore` — no `FlutterSecureStorage` / `MissingPluginException`.

## Backend

Command:

```bash
node --test tests/flutter-host-api-parity.test.ts tests/host-platform-api-parity.test.ts
```

| Suite | Tests | Result |
|-------|------:|--------|
| `tests/flutter-host-api-parity.test.ts` | 3 | Pass |
| `tests/host-platform-api-parity.test.ts` | 3 | Pass |
| **Total** | **6** | **All passed** |

## Analyze

`flutter analyze` on host + related profile sources: **no errors**; remaining items are info-level `use_null_aware_elements` hints in existing `ile_api.dart` map literals.

## Device E2E

**UNVERIFIED** — no physical/emulator device run this session.

## Remaining limits

- Production Neon migrate: not applied (document only)
- Paystack / R2 / FCM credentials may be absent in local env
- No deploy / no commit / no live money transfer from client
