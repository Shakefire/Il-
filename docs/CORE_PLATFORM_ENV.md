# Ilé Core Platform — Environment variables (names only)

Never commit secret values. Set these in Railway / local `.env`.

## Core

| Name | Purpose |
|------|---------|
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | Fastify port (default `4000`) |
| `DATABASE_URL` | Neon Postgres connection string |
| `SESSION_SECRET` | Session HMAC secret (≥32 chars) |
| `SESSION_MAX_AGE_DAYS` | Cookie/session lifetime |
| `FRONTEND_URL` | Canonical web origin for reset links |

## Email (Resend)

| Name | Purpose |
|------|---------|
| `EMAIL_PROVIDER` | `resend` \| `sendgrid` \| `console` |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_API_KEY` | Alias for Resend key |
| `EMAIL_FROM` | From identity |
| `EMAIL_SUPPORT` | Support address |
| `EMAIL_ENQUIRIES` | Enquiries address |
| `RESEND_DOMAIN` | Sending domain |

Without a key (or `EMAIL_PROVIDER=console`) emails are logged only.

## SMS (Termii)

| Name | Purpose |
|------|---------|
| `SMS_PROVIDER` | `termii` \| `console` (default `console`) |
| `TERMII_API_KEY` | Termii API key |
| `TERMII_SENDER_ID` | Sender ID (default `IleStays`) |
| `TERMII_BASE_URL` | API base (default NG Termii URL) |

## Push (FCM)

| Name | Purpose |
|------|---------|
| `PUSH_PROVIDER` | `fcm` \| `console` (default `console`) |
| `FIREBASE_PROJECT_ID` | Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (escaped `\n` OK) |

## Web Push (VAPID)

| Name | Purpose |
|------|---------|
| `WEB_PUSH_PROVIDER` | `webpush` \| `console` (default `console`) |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | VAPID public key |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | VAPID private key |
| `WEB_PUSH_SUBJECT` | `mailto:` contact for VAPID |

With `WEB_PUSH_PROVIDER=webpush` and VAPID keys present, the backend sends encrypted payloads via the `web-push` package. Without them, sends are honest console mocks.

Also used by clients: `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (web checkout public key; same value as `PAYSTACK_PUBLIC_KEY`).

## Paystack

| Name | Purpose |
|------|---------|
| `PAYSTACK_SECRET_KEY` | Secret key (TEST `sk_test_…` only in this environment) |
| `PAYSTACK_PUBLIC_KEY` | Public key (`pk_test_…`) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Browser-exposed public key (same as public key) |
| `PAYSTACK_MOCK_TRANSFERS` | `true` to avoid live transfers in tests/dev |

## Storage / geo

| Name | Purpose |
|------|---------|
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `R2_BUCKET_NAME` / `R2_PUBLIC_URL` / `R2_FOLDER_PREFIX` | Bucket + public CDN |
| `GEOCODING_API_URL` | Nominatim (default OSM) |

## Flutter

| Name | Purpose |
|------|---------|
| `API_BASE_URL` (dart-define) | Fastify base URL for mobile |
| `FIREBASE_API_KEY` (dart-define) | Optional FCM; omit → push SDK no-op |
| `FIREBASE_APP_ID` (dart-define) | Optional FCM app id |
| `FIREBASE_MESSAGING_SENDER_ID` (dart-define) | Optional FCM sender |
| `FIREBASE_PROJECT_ID` (dart-define) | Optional FCM project |
| `FIREBASE_STORAGE_BUCKET` (dart-define) | Optional storage bucket |

Android `google-services.json` / iOS `GoogleService-Info.plist` remain the preferred console path. Without either dart-defines or native Firebase files, push stays idle and the in-app inbox still works.

## Web push client

Browser registration uses `GET /api/notifications/web-push/public-key`. When `configured: false`, the client skips without crashing. Service worker: `public/sw.js`.
