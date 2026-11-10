# Flutter Host App — Implementation report

**Date:** 2026-11-10 (re-verified)  
**Constraint compliance:** No deploy, no commit/push, no production migrations applied, no live Paystack transfer UI.

## Gap list vs prior “full completion” claim

Prior docs claimed sections 5–21 done. Tree inspection confirmed **most of that was real** (not vapor). Gaps found on re-verify:

| Claimed done | Actual gap found | Resolution this session |
|--------------|------------------|-------------------------|
| Host help / no “use website” | Help still said manage payouts **on web** | Copy → Host dashboard → Earnings in app |
| Earnings/payouts history | `getHostPayouts` existed but **unused** | Wallet loads `/api/host/payouts` as history fallback |
| Bank picker UX | Banks list wired; **did not prefill** existing bank code/NUBAN | Prefill from payout-account |
| Role-aware empty host shell | Non-host only “Back” | **Become a host** → `/host/onboarding` |
| Overview pending CTA copy | Snackbar said “Requests tab” | Corrected to **Reservations** |
| Fastify banks + check-in field | Claimed done | **Verified present** (no code change needed) |
| Full host screens 5–13 | Claimed done | **Verified present** (monthly calendar, KYC, editor, inbox, etc.) |

## Already present (verified, not re-built)

### Backend

- `GET /api/banks` (+ `/api/payments/banks`) — Nigerian bank list for Flutter picker
- Host bookings enrichment includes `guestCheckInConfirmedAt` / `guestCheckInConfirmed` (display-only for hosts)

### Flutter host surface (`apps/mobile`)

| Screen / route | Status |
|----------------|--------|
| Overview `/host` | Real dashboard + wallet + KYC banner + skeletons + pull-to-refresh |
| Properties | List + publish/unpublish/relist/archive + editor entry |
| Property create/edit | 3-step CRUD, media upload, reorder, cover, publish actions |
| Reservations | Status filters, 120s countdown, accept/decline → real booking APIs |
| Reservation detail | Stay view; guest check-in read-only |
| Calendar | Monthly grid, day states, block/unblock via availability API |
| Earnings | Finance wallet projection + withdraw submit + bank CTA |
| Bank | Paystack-backed resolve via payout-account + banks list |
| Notifications | Inbox + dashboard alerts + prefs + unread badge |
| Profile | KYC status, settings links, no currency preference |
| Onboarding `/host/onboarding` | Full KYC journey against onboarding endpoints |
| Guest profile banner | Role-aware Host dashboard / Become a host |

### API client

`IleApi` already had onboarding steps, relist/submit, banks, uploads, payouts, media-order, notifications.

### Guest intact

Guest marketplace shell, booking lifecycle, pay/check-in flows untouched aside from profile host entry + help copy.

## Newly fixed this session

1. Help payouts copy (remove web-only host instruction)
2. Wallet merges `/api/host/payouts` when Finance history is empty
3. Bank screen prefills verified account fields
4. Non-host shell CTA → onboarding
5. Overview snackbar label accuracy
6. Profile sign-out: capture providers before async (analyzer hygiene)
7. Added `getHostPayouts` focused unit test
8. Docs rewritten to separate **already done** vs **newly fixed**

## Page-by-page completion matrix

| PO area | Status |
|---------|--------|
| Role-aware nav | **Done** — Overview/Properties/Reservations/Calendar/Earnings + Notifications/Profile chrome |
| Overview dashboard | **Done** |
| KYC onboarding | **Done** (mobile); admin approval still required server-side |
| Property CRUD + media | **Done** |
| Calendar monthly | **Done** |
| Reservations + deadline | **Done** |
| Check-in respect guest | **Done** (no host confirm-check-in call) |
| Earnings / bank / withdraw | **Done** (submit only) |
| Notifications inbox/prefs | **Done** |
| Host profile/settings | **Done** |

## Tests (exact)

- Flutter focused: **27 passed** (`host_flow` 13 + phase7 8 + booking_lifecycle 6)
- Backend parity: **6 passed** (`flutter-host-api-parity` 3 + `host-platform-api-parity` 3)
- Device E2E: **UNVERIFIED**

## Explicit non-actions

- No deploy  
- No git commit / push  
- No production Neon migration apply  
- No client-initiated live Paystack transfers beyond withdraw API submit  
