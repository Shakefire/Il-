# Flutter Host App — Audit

**Date:** 2026-11-10 (re-verified same day)  
**Scope:** `apps/mobile` host surface + Fastify `/api/host/*` / bookings / finance / notifications / uploads  
**Constraint:** Guest marketplace must remain intact; no deploy/commit; no production migrations; no live Paystack transfers from client.

## Executive verdict

Prior host-platform work left a **wired but thin** Flutter host shell under `/host`. A later session claimed full completion; this re-audit **verified most of that claim against the tree** (screens, `IleApi`, Fastify banks + check-in enrichment, focused tests). Remaining gaps were thin UX/copy and one unused payouts client path — closed in the re-verify pass.

## Inventory (post re-verify)

| Area | Files | Status | Notes |
|------|-------|--------|-------|
| Routing | `app_router.dart`, `app_routes.dart` | **Done** | Shell + onboarding/bank/profile/notifications/wallet/property/reservation routes |
| Role gate | `host_shell_screen.dart`, `user_role.dart` | **Done** | `/api/auth/me` role via `UserRole.canAccessHostWallet`; non-host → Become a host (onboarding) |
| API surface | `ile_api.dart` | **Done** | Onboarding steps, relist/submit, banks, uploads, payouts, media-order, inbox/prefs |
| Overview | `host_overview_screen.dart` | **Done** | Real dashboard/wallet/onboarding; skeleton + pull-to-refresh; KYC CTA |
| Properties | `host_properties_screen.dart` | **Done** | List + publish/unpublish/relist/archive + editor entry |
| Property editor | `host_property_editor_screen.dart` | **Done** | 3-step CRUD, `image_picker` upload, media-order/cover, publish actions |
| Reservations | `host_reservations_screen.dart` + detail | **Done** | Status filters; 120s countdown; accept/decline; stay view read-only check-in |
| Calendar | `host_calendar_screen.dart` | **Done** | Monthly grid + day states + block/unblock (not text-date stub) |
| Earnings | `host_earnings_screen.dart` → wallet | **Done** | Finance projection + withdraw submit; payouts ledger fallback |
| Bank | `host_bank_screen.dart` | **Done** | `/api/banks` picker + Paystack resolve via payout-account; prefills existing account |
| Notifications | `host_notifications_screen.dart` | **Done** | Inbox + dashboard alerts + prefs + unread badge |
| Profile | `host_profile_screen.dart` | **Done** | KYC status, bank/notif/account links; no currency preference; no “use website” host CTA |
| Guest profile banner | `profile_screen.dart` `_HostBanner` | **Done** | Host dashboard / Become a host → real host routes |
| Guest flows | explore/bookings/reserve/etc. | **Intact** | Must not regress |

## Backend readiness

| Endpoint group | Fastify | Notes |
|----------------|---------|-------|
| Profile / onboarding | Yes | Full KYC step APIs present |
| Properties CRUD + publish/unpublish/relist/archive/media-order | Yes | Soft-archive semantics already enforced |
| Availability block/unblock | Yes | Ownership-checked |
| Dashboard / bookings / wallet / withdraw / payout-account | Yes | FinanceService projection |
| Booking accept/decline | Yes (`/api/bookings`) | Host ownership; → PAYMENT_PENDING / CANCELLED |
| Guest check-in | Guest-only | Host must not call confirm-check-in (UI respects) |
| Notifications inbox/prefs | Yes (`/api/notifications`) | Host screen uses them |
| Uploads | Yes (`/api/uploads`) | Base64; property ownership check |
| Banks list | Yes | `GET /api/banks` (+ `/api/payments/banks`) |
| Host bookings `guestCheckInConfirmedAt` | Yes | Enriched in `hosts.service` for stay view |

## Lifecycle invariants (must preserve)

1. `PENDING_HOST` → host accept → `PAYMENT_PENDING` → pay verify → `CONFIRMED`
2. Host response deadline = **120s server clock** (UI countdown only)
3. Wallet = payout projection (HELD/READY/PROCESSING/PAID) — no invented balances
4. Soft-archive when booking/finance history exists
5. Publish gated by KYC `APPROVED` server-side
6. No client-side role elevation; no live transfer initiation beyond withdraw submit API

## Risks / limits

- Device E2E: **UNVERIFIED** unless manually run  
- SMS/FCM: mock adapters OK if credentials missing; inbox DB records must be real  
- Neon production migrate: document only — do not apply  
- Paystack transfer: withdraw API may attempt transfer server-side when keys present; client only submits request (no direct transfer UI)
- No deploy / no commit / no push / no live money from mobile
