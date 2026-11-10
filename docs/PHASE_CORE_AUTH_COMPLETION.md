# Core Auth wiring — completion

## Backend (already present; hardened)

- Register / login / verify-email / resend OTP / forgot / reset — verified intact.
- Forgot-password success message neutralized (no email echo).
- Phone OTP routed through Termii adapter (console mock without keys).
- Dev-only `123456` phone bypass gated to non-production.
- `PATCH /api/auth/profile` for guest name/phone.

## Flutter

- Login, register, OTP (6-digit), forgot, reset wired to `IleApi` + token persistence.
- Edit profile saves via `PATCH /api/auth/profile`.
- Logout clears server cookie attempt + local token.

## Web

- Existing auth pages remain real against backend; forgot copy updated.
- Profile PATCH route added for Next.

## Tests

- `apps/mobile/test/features/auth_flow_test.dart` updated for API mocks.
- `tests/core-platform-auth-profile.test.ts` schema checks.
