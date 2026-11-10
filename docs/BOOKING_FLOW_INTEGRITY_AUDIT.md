# Booking Flow Integrity Audit

**Date:** 2026-11-10  
**Scope:** Flutter (`apps/mobile`) + Next.js (`src/`) + Fastify (`backend/`)  
**Constraint:** No simulated host acceptance/payment; backend is sole source of truth.

---

## Root cause of “fake accept”

The guest experience historically **looked like** host acceptance even when the host had not acted, for three stacked reasons:

1. **Pre–Phase 3 backend:** `POST /api/bookings` inserted `PAYMENT_PENDING` immediately and unlocked Paystack without a host gate. Guest UI therefore advanced to pay as if the host had already accepted.
2. **Client copy / model drift:** Mobile audits and help text still described create → pay, while Phase 3 introduced `PENDING_HOST` + 120s `host_response_deadline_at`. Guests saw “progress” language without a real host event.
3. **External Paystack hand-off (Flutter):** Checkout used `url_launcher` + `LaunchMode.externalApplication`, so return/verify was easy to misread as “accepted & paid” without a reliable in-app verify loop.

**What was not found in the current tree:** no `Future.delayed` that advances booking status to accepted/confirmed; no timer that invents `PAYMENT_PENDING`/`CONFIRMED`; no client write of booking status to the API.

---

## Fake / risk inventory (locate → disposition)

| Location | Pattern | Disposition |
|---|---|---|
| Historical `bookings.service` create path | Insert `PAYMENT_PENDING` on create | **Already fixed** — create inserts `PENDING_HOST` + server deadline; no Paystack init |
| `apps/mobile/docs/BOOKING_LIFECYCLE_AUDIT.md` | Documents create → `PAYMENT_PENDING` | **Superseded** (banner + Phase 5 audit); code uses `PENDING_HOST` |
| `ReservationStatusScreen` countdown | Timer tick | **OK** — display-only; at `0` re-fetches SoT, never local expire/accept |
| `BookingModal` / trips countdowns | `setInterval` | **OK** — display-only; refresh on zero |
| Flutter `_autoPayTriggered` | Auto-open pay when status becomes `PAYMENT_PENDING` | **OK** — gated on real poll transition from `PENDING_HOST` |
| Flutter `launchUrl(..., externalApplication)` | External browser Paystack | **FIXED this pass** — in-app `webview_flutter`; verify via Fastify |
| Host dashboard after accept/decline | Optimistic list patch from API body | **OK** — mirrors server response; re-fetchable |
| Paystack WebView “success” page alone | Trust callback UI | **Forbidden** — always `GET /api/payments/verify/:ref` |
| Static `PROPERTIES` marketplace fill | Demo apartments in live UI/API | **Already removed** from listed Next routes (seed-only retained) |
| Design-system `demo` slug | UI kit route | **Retained** — not marketplace data |
| `mock_auth.dart` latency constants | Design-system skeleton demo | **Retained** — not booking SoT |

---

## Canonical state machine (must hold)

```
Book Now
  → POST /api/bookings → PENDING_HOST + host_response_deadline_at (~120s)
  → Guest progress UI waits ONLY (poll / refresh / foreground / notification-open)
  → Host notified (inbox real; FCM may be mock) + pending list
Host Accept (ownership + deadline + atomic)
  → PAYMENT_PENDING + payment_deadline_at
  → Backend may init Paystack; guest sees accept then pay
Decline / host-window expire / payment expire
  → Backend CANCELLED (+ reason); guest terminal UI from SoT
Verified payment (webhook or verify)
  → CONFIRMED; ledger + commission snapshots preserved
```

Rules:

- Countdown hitting 0 → **re-fetch**, never assume expire or accept.
- No client status mutation endpoints.
- AUTOMATIC payout: after verified payment, check-in must **not** block (see finance mode).
- MANUAL payout: keep settlement / check-in gates.

---

## Fixes applied in this integrity pass

1. Audit document (this file).
2. Flutter in-app Paystack WebView (`webview_flutter`) with domain allowlist, callback detection, Fastify verify, close/back/network recovery without duplicate booking create.
3. Reservation status screen: remove external browser checkout; keep animation/waiting as presentation only.
4. Docs: git readiness / consistency notes updated to reflect WebView path and remaining limits.

---

## Explicit non-actions

- No production Neon migrate / fixture cleanup execute  
- No live Paystack transfers (mock/test adapters only)  
- No deploy / commit / push  

---

## Remaining limits (honest)

- Device FCM / physical Paystack WebView on hardware: **UNVERIFIED** in this pass when credentials/device unavailable.
- Production migrations `0004`/`0005`/`0006`: artifacts only until PO applies. Observed during tests: `notification_inbox` relation missing → host inbox write is **non-fatal**; host still receives email best-effort and sees `PENDING_HOST` on dashboard/reservations APIs.
- Full Next.js production build / Flutter APK: may be skipped when disk pressure requires it.
- Guest↔host messaging thread UI remains sample/empty where no messaging API exists (out of booking SoT).
