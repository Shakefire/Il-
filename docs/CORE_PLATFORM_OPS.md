# Ilé Core Platform — Ops notes

**Explicit:** No production deploy was performed in this implementation run. No git commit/push. No live Paystack transfers were initiated.

## Migrations

Apply via existing Drizzle workflow from repo root:

```bash
npm run db:migrate
# or: npx drizzle-kit migrate
```

Migrations:
- `0004_core_notifications.sql` — `device_tokens`, `notification_inbox`, `notification_deliveries`
- `0005_notification_prefs_phone_otp.sql` — phone OTP cooldown columns + `notification_preferences`

**Status (2026-11-10):** `0004` + `0005` applied successfully against local/dev `DATABASE_URL`.

Do **not** mutate schema ad-hoc at process startup.

## Notification failure policy

- Email / SMS / FCM / web push / inbox writes are **best-effort**.
- Failures are logged on delivery ledgers; they **must never** roll back booking or payment transactions.
- Resend HTTP 429 (quota) is non-fatal.
- Idempotency keys: `booking:{id}:{EVENT}:{role}` (+ `:email` / `:sms` / `:inbox` / `:push:{deviceId}`).
- Critical preference categories cannot be muted (`security`, `auth`, `password_reset`, `email_otp`, `phone_otp`).

## Provider modes

| Channel | Safe default without credentials |
|---------|----------------------------------|
| Email | `EMAIL_PROVIDER=console` or missing key → log mock |
| SMS | `SMS_PROVIDER=console` → log mock |
| FCM | `PUSH_PROVIDER=console` → log mock |
| Web push | `WEB_PUSH_PROVIDER=console` → log mock; encrypted when `webpush` + VAPID |

## Paystack safety

- Use **TEST** keys in non-prod (configured in local `.env` only this run).
- Set `PAYSTACK_MOCK_TRANSFERS=true` for settlement tests.
- Do not auto-retry uncertain transfer states; keep HELD→READY→PROCESSING→PAID.

## Auth / OTP

- Email OTP: 6 digits, 15 min expiry, 60s resend cooldown.
- Phone OTP: Termii when configured; otherwise console mock. **No hardcoded `123456` bypass.** 60s resend cooldown + attempt limit.
- Forgot password always returns the same success-shaped message (no email existence leak).

## Flutter

- Hits Fastify directly (`API_BASE_URL` dart-define).
- Auth stores Bearer token in **`flutter_secure_storage`** (`ile_token`), with one-time migration from SharedPreferences.
- `firebase_messaging` is wired behind optional Firebase dart-defines / `google-services.json`. Missing config → no-op; inbox API still works.
- Permission is requested only from Notifications → **Enable push** (not on cold start).
- Profile dock shows unread notification badge.
- Logout revokes the registered device token best-effort.

## Web

- Next.js API routes import backend services in-process (same Neon DB).
- Routes: `PATCH /api/auth/profile`, `/api/notifications*`, `/notifications` UI, preferences API.
- Navbar bell links to inbox with live unread count.
- Web push client: `src/lib/web-push-client.ts` + `public/sw.js`. Encrypted send uses `web-push` when `WEB_PUSH_PROVIDER=webpush` + VAPID.

## Suggested smoke checks (manual)

1. Register → verify email OTP → login → `/api/auth/me`.
2. Create booking as guest → host inbox + guest inbox rows.
3. Register device token → accept booking → mock FCM log line.
4. Forgot password with unknown email → same success copy.
5. Confirm no currency preference / host wallet on guest Profile.
6. Confirm phone OTP rejects arbitrary `123456` without a real code.
