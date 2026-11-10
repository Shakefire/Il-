# Ilé Core Platform Audit — Phase 1

**Date:** 2026-11-10  
**Scope:** Auth, notifications (Resend / Termii / FCM / web push / in-app inbox), device tokens, orchestration, Flutter vs web client wiring.  
**Constraint:** Do not rebuild working money/booking paths. No production deploy. No live Paystack.

---

## 1. Stack reality

| Layer | Location | Status |
|-------|----------|--------|
| API | `backend/` Fastify 5 + Drizzle + Neon | Live module surface |
| Web | Next.js 14 at repo root (`src/`) | Auth + booking + host/admin |
| Mobile | `apps/mobile` Flutter | Marketplace/booking wired; **auth still mock** |
| Migrations | `backend/src/db/migrations` via Drizzle | `0000`–`0003` present |
| Email | Resend via `notifications.service` + `email_deliveries` | Implemented; quota 429 non-fatal |
| Payments | Paystack init/verify/webhooks + mock transfers flag | Implemented (Phases 3–9) |

---

## 2. Auth — what exists

### Backend (`/api/auth/*`) — **IMPLEMENTED**

| Endpoint | Behavior |
|----------|----------|
| `POST /register` | Guest create + email OTP (6-digit), no session until verify |
| `POST /register-owner` | Host create + email OTP |
| `POST /verify-email` | OTP verify → session cookie + token |
| `POST /resend-email-otp` | 60s cooldown |
| `POST /login` | Session + token |
| `POST /logout` | Clears cookie |
| `GET /me` | Current user + profile |
| `POST /forgot-password` | Always success-shaped; email only if account exists |
| `POST /reset-password` | Token + new password |
| `POST /send-phone-otp` | **Console mock SMS only** (logs code) |
| `POST /verify-phone` | Accepts real code **or** hardcoded `123456` |

**Gaps:** No guest `PATCH /profile` (or equivalent). Phone OTP has no Termii. Forgot-password success copy still echoes the submitted email (existence not leaked by branching, but copy is not fully neutral).

### Web — **MOSTLY WIRED**

Login, signup, forgot/reset, verify-email API routes proxy to Fastify. Guest web auth is real against the backend.

### Flutter — **MOCK / GAP**

| Screen | Current behavior |
|--------|------------------|
| Login | `MockAuth.mockLatency` then success dialog — **no API, no token** |
| Register | Mock latency → OTP route — **no `POST /register`** |
| OTP | Accepts only `MockAuth.mockOtp` (`67501`, **5 digits**) — backend uses **6 digits** |
| Forgot / reset | Mock latency only |
| Profile `/me` | Real API when a token exists (rarely set from auth screens) |
| Edit profile | Hydrates from `/me`; save disabled (“coming soon”) |

`IleApi` has `getCurrentUser` but **no** register/login/verify/forgot/reset helpers.

---

## 3. Notifications — what exists

### Email (Resend) — **IMPLEMENTED**

- Templates + `sendEmail` / `sendTransactionalEmail` with durable `email_deliveries` idempotency.
- Lifecycle dispatcher: `lifecycle-notify.ts` (`dispatchLifecycleEmail`) wired from bookings/payments/finance.
- Provider failure is non-fatal (never rolls back booking/payment).
- `EMAIL_PROVIDER=console` / missing key → mock log mode.

### SMS (Termii) — **NOT IMPLEMENTED**

- Phone OTP logs to console (`[SMS Mock]`).
- No Termii client, env flags, delivery ledger, or booking SMS events.

### Push (FCM / APNs) — **NOT IMPLEMENTED**

- No `firebase-admin`, no `device_tokens` table, no register-token API.
- Flutter has no FCM plugin wiring for production tokens.
- `mobile.md` describes intended push architecture only.

### Web push — **NOT IMPLEMENTED**

- No VAPID keys, service worker push subscription, or backend send path.

### In-app notification inbox — **NOT IMPLEMENTED**

- Schema only has `email_deliveries`.
- Flutter **Notifications** screen is an honest empty placeholder.
- Flutter **Inbox** tab is guest–host **messaging** “coming soon”, not a notification feed.

### Orchestrator — **PARTIAL (email-only)**

- Booking lifecycle → email only.
- No multi-channel fan-out (email + SMS + push + inbox) with shared idempotency keys.

---

## 4. Booking / finance (verify only — do not rebuild)

Documented complete in Phases 3–9 / 10–15 reports:

- `PENDING_HOST` → host accept/decline (120s) → `PAYMENT_PENDING` → Paystack → `CONFIRMED`
- Late pay → admin `REQUESTED` refund queue (not silent confirm)
- Transfer fee interim ₦0 (Ilé absorbs); admin-only refunds; ledger double-entry
- Payout `HELD` → `READY` → `PROCESSING` → `PAID`; no auto-retry uncertain transfers
- Marketplace fixture filter excludes `@test.ile.ng` hosts from public browse
- Guest UX: Book Now, confirming-your-stay, GuestMessages, skeletons/errors

**Status:** Treat as **implemented + tested** unless a regression appears. Out of scope for rewrite.

---

## 5. Device tokens / clients

| Concern | Status |
|---------|--------|
| `device_tokens` table | Missing |
| Mobile token register/unregister API | Missing |
| Web push subscription storage | Missing |
| Flutter auth session persistence after login | Broken (mock never calls `ApiClient.setToken`) |

---

## 6. Priority implementation order (remaining)

1. **Flutter auth → real backend** (register, login, 6-digit email OTP, resend rate-limit UX, forgot/reset, profile update).
2. **Guest profile PATCH** on backend + Flutter/web save.
3. **Notification schema:** `device_tokens`, `notification_inbox`, channel delivery ledger / outbox pattern.
4. **Termii SMS adapter** + env mock mode; wire phone OTP.
5. **FCM Admin adapter** (mock without credentials) + Flutter token register stub/safe path.
6. **Web push** adapter stubs + subscription API (needs console VAPID config to go live).
7. **In-app inbox API + Flutter notifications UI**.
8. **Central orchestrator** on booking lifecycle (idempotent; provider failures non-fatal).
9. **API consistency / ownership** spot-check (IDOR already partially tested).
10. **Focused tests** + env/ops docs + `CORE_PLATFORM_COMPLETION_REPORT.md` (26 deliverables).

---

## 7. Credential / console gates (do not block coding)

| Integration | Required vars (names only) | Without credentials |
|-------------|----------------------------|---------------------|
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER` | Console mock |
| Termii | `TERMII_API_KEY`, `TERMII_SENDER_ID`, `SMS_PROVIDER` | Console mock |
| FCM | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Mock log send |
| Web push | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | Stub / no send |
| Paystack | Existing keys; `PAYSTACK_MOCK_TRANSFERS=true` for tests | Do not initiate live transfers |

---

## 8. Explicit non-goals for this run

- No production deploy, no git commit/push, no live Paystack payments/transfers.
- No ledger rewrite, no invented fees/commissions/refund rules.
- No fake production properties/bookings.
- Guest Profile: no host wallet, no currency preference.
- Book Now guest-facing copy; backend status names unchanged.
