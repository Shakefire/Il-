# Phase 4 — Next.js Web Booking Audit (pre-code)

**Date:** 2026-11-08  
**Backend SoT:** Phase 3 reservation lifecycle (no status invention)

## Phase 3 API (reconciled)

| Fact | Evidence |
|---|---|
| Create → `PENDING_HOST` + `host_response_deadline_at` (~120s) | `bookings.service.createBooking` |
| Host accept → `PAYMENT_PENDING` + `payment_deadline_at` (~10m), idempotent | `POST /api/bookings/:id/accept` |
| Host decline → `CANCELLED` | `POST /api/bookings/:id/decline` |
| Pay init **rejected** on `PENDING_HOST` | `payments.service.initializeBookingPayment` |
| Guest cancel unpaid (`PENDING_HOST` / `PAYMENT_PENDING`) OK | `cancelBooking` |
| Paid cancel → `REFUND_REQUIRED` (409); admin only | Same; PO rule: guests never execute refunds |
| Absolute deadline expiry | `expireDueBookings` / admin expire-stale |
| Emails via Resend server-side | create / accept / cancel — not from client |

Statuses in use: `PENDING_HOST`, `PAYMENT_PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED` (+ legacy `PENDING`).  
**Not** inventing: `AWAITING_PAYMENT`, `CHECKED_IN`, `REFUND_PENDING`, `HOST_CONFIRMED`.

## Web UI gaps (before Phase 4)

| Surface | Gap |
|---|---|
| `BookingModal` | Create → jump to Pay; no host-wait; may init pay on wrong status |
| `BookingPanel` | Defaults dates/guests; weak min-nights UX; CTA says “instant” |
| Host dashboard | Lists bookings; **no** Accept/Decline; no `PENDING_HOST` countdown |
| Next.js API | Cancel/create exist; **no** accept/decline route proxies |
| `api.ts` | No `acceptBooking` / `declineBooking` |
| Trips | Uses invented badges (`AWAITING_PAYMENT`); pay CTA wrong status; no guest cancel / refund guidance |
| Host bookings API enrich | Missing deadline fields for UI countdown |

## Old mobile audit vs Phase 3

`apps/mobile/docs/BOOKING_LIFECYCLE_AUDIT.md` is **stale**: it says create inserts `PAYMENT_PENDING`.  
**Correct:** create = `PENDING_HOST`; pay only after host accept → `PAYMENT_PENDING`.

## Phase 4 implementation plan

1. Next routes + `api.ts` for accept/decline; enrich host booking deadlines.
2. Guest modal: review → create → wait (`host_response_deadline_at`) → pay (`payment_deadline_at`) → verify via backend → `CONFIRMED`. Never init pay on `PENDING_HOST`.
3. Host dashboard: pending list, countdown, Accept / confirm-Decline; post-accept = payment-pending.
4. Trips: real statuses, refresh on load/Paystack return/focus, bounded poll, cancel unpaid only, CONFIRMED → contact/admin refund guidance.
5. Preserve panel dates/guests; capacity + min nights; backend pricing display.
6. Tests + STOP report; then Phase 5.

## Out of scope

Phase 6/7, production deploy, ledger/wallet rewrite, client-sent emails, WebSockets (unless already present — none).
