# Ilé Notification Setup

Local defaults favor **console mock** until credentials exist.

## SMS (Termii)

1. Set `TERMII_API_KEY`, `TERMII_SENDER_ID`
2. Set `SMS_PROVIDER=termii`
3. Without key (or `SMS_PROVIDER=console`) OTP codes are logged only — still stored hashed/in DB for verify

## FCM

1. Create Firebase project; download Android `google-services.json` / iOS plist
2. Set server: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
3. Set `PUSH_PROVIDER=fcm`
4. Flutter: native configs and/or dart-defines listed in `CORE_PLATFORM_ENV.md`
5. Without configs: backend mocks; Flutter push SDK no-ops; inbox still works

## Web Push (VAPID)

1. Generate VAPID key pair
2. Set `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`
3. Set `WEB_PUSH_PROVIDER=webpush`
4. Browser registers via `/api/notifications/web-push/public-key` → device token API
5. Without keys: honest mock send; client skips registration cleanly

## Email

- Live: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`
- Local/CI: `EMAIL_PROVIDER=console`

## Paystack (payments, not notifications)

- TEST keys only in local `.env`
- Keep `PAYSTACK_MOCK_TRANSFERS=true` for non-charge transfer paths
