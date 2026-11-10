# Ilé Core Platform — Implementation Audit (verified)

**Date:** 2026-11-10  
**Method:** Code inspection + migrations + focused tests. Prior completion claims were **not** trusted blindly.

---

## Verified state (post this run)

| Area | Status | Notes |
|------|--------|-------|
| Flutter auth → Fastify | **Implemented** | Register/login/6-digit OTP/resend/forgot/reset/logout/`/me` |
| Session storage | **Implemented** | `flutter_secure_storage` + one-time SharedPreferences migration |
| Guest `PATCH /api/auth/profile` | **Implemented** | Backend + Flutter + **web save UI** |
| Notification schema | **Implemented** | `device_tokens`, `notification_inbox`, `notification_deliveries`, `notification_preferences` |
| Migrations | **Applied** | `0000`–`0005` via drizzle-kit migrate |
| Termii SMS | **Implemented (console without key)** | Phone OTP; **123456 bypass removed**; 60s cooldown + attempt limit |
| FCM | **Implemented (console without creds)** | HTTP v1 adapter; Flutter optional no-op |
| Device token APIs | **Implemented** | Register/revoke with user ownership |
| Web push | **Implemented** | Encrypted send via `web-push` when VAPID + `WEB_PUSH_PROVIDER=webpush`; mock otherwise; `public/sw.js` |
| In-app inbox | **Implemented** | APIs + Flutter UI + **web `/notifications`** + unread badges |
| Orchestrator | **Implemented** | Booking lifecycle + auth password-reset + finance payout; prefs-aware; non-fatal |
| Resend templates | **Implemented** | `EMAIL_PROVIDER=console` fallback |
| Notification preferences | **Implemented** | Critical security categories cannot be disabled |
| Host accept / guest poll | **Implemented** (prior) | Verified intact |
| Paystack | **Test keys in local `.env` only** | `PAYSTACK_MOCK_TRANSFERS=true`; no live charges this run |
| Production deploy | **Not done** | Explicitly excluded |
| Git commit/push | **Not done** | Explicitly excluded |

---

## Gaps closed in this run

1. Plaintext Flutter session token → secure storage  
2. Phone OTP `123456` bypass removed + cooldown/attempts  
3. Encrypted web-push send path (`web-push` package)  
4. Notification preferences table + API + critical lock  
5. Web guest profile save  
6. Web inbox page + Navbar unread badge  
7. Flutter Profile tab unread badge  
8. Finance payout + auth password-reset routed through orchestrator  
9. Migration `0005_notification_prefs_phone_otp.sql` applied  

---

## Remaining credential / console gates

| Integration | Without credentials |
|-------------|---------------------|
| Termii | `SMS_PROVIDER=console` logs OTP |
| FCM | Mock log; Flutter no-op without Firebase configs |
| Web push encrypted | Needs VAPID + `WEB_PUSH_PROVIDER=webpush` |
| Resend live | Needs `RESEND_API_KEY`; else console/mock |
| Paystack live money | **Do not** — TEST keys + mock transfers only |

---

## Explicit non-claims

- No live Termii / FCM / Resend / encrypted web-push delivery verified without provider credentials.  
- No live Paystack charge or transfer executed.  
- No production deploy. No git commit/push.  
- Booking/ledger engines were **not** rebuilt — integration only.
