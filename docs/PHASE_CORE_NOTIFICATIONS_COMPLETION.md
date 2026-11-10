# Core Notifications (Phases 8–13 gap closure) — completion

## Implemented

| Piece | Location |
|-------|----------|
| Schema + migration `0004` | `device_tokens`, `notification_inbox`, `notification_deliveries` |
| Termii SMS adapter | `termii.service.ts` + phone OTP |
| FCM Admin HTTP v1 adapter | `fcm.service.ts` (mock without creds) |
| Web push stub | `web-push.service.ts` |
| Delivery ledger | `delivery-ledger.ts` |
| In-app inbox service + routes | Fastify `/api/notifications` + Next proxies |
| Device token register/revoke | `POST/DELETE /api/notifications/devices` |
| Orchestrator | `orchestrator.ts` via enhanced `dispatchLifecycleEmail` |
| Booking wiring | create / accept / decline fan-out to inbox (+ SMS when phone present) |
| Flutter notifications UI | Real feed, mark read, skeletons, auth gate |

## Credential gates

- Termii, Firebase, VAPID — adapters ready; live delivery needs secrets + console.
- Encrypted web-push send not fully enabled without additional package/config (documented).

## Safety

Provider failures never roll back booking/payment. Idempotent channel keys.
