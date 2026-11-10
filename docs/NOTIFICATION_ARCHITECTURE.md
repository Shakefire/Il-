# Ilé Notification Architecture

## Source of truth

Fastify backend owns delivery. Clients (Next.js, Flutter) register devices and read the in-app inbox.

## Channels

| Channel | Adapter | Ledger |
|---------|---------|--------|
| Email | Resend / SendGrid / console | `email_deliveries` |
| SMS | Termii / console | `notification_deliveries` (`sms`) |
| Push | FCM HTTP v1 / console | `notification_deliveries` (`push`) |
| Web push | `web-push` + VAPID / console | `notification_deliveries` (`web_push`) |
| In-app | DB upsert | `notification_inbox` + delivery row |

## Orchestrator

- Booking events: `dispatchLifecycleEmail` → `notifyLifecycleEvent`
- Auth/finance user events: `notifyUserEvent`
- Idempotency keys per channel; duplicate sends short-circuit
- Provider failures are logged and **never** roll back booking/payment mutations
- Preference checks skip optional channels; **critical** categories (`security`, `auth`, `password_reset`, `email_otp`, `phone_otp`) always allow delivery

## Device tokens

`POST/DELETE /api/notifications/devices` — authenticated; revoke filters by `userId` + token.

## Preferences

`GET/PATCH /api/notifications/preferences` — non-critical categories only; attempts to mute critical categories return 400.

## Client surfaces

- Flutter: `NotificationsScreen` + Profile dock unread badge  
- Web: `/notifications` + Navbar bell unread badge  
- Web push registration: `src/lib/web-push-client.ts` + `public/sw.js`
