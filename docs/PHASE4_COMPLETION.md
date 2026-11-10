# Phase 4 — Next.js Web Booking — Completion Report (STOP)

**Status:** Implemented → Tested → Documented. **Continue to Phase 5 authorized by user.**  
**No production deploy. No ledger/wallet rewrite. Backend remains SoT.**

## Audit (pre-code)

See `docs/PHASE4_WEB_BOOKING_AUDIT.md`. Reconciled stale mobile audit: create is **`PENDING_HOST`**, not immediate `PAYMENT_PENDING`.

## Implemented

| Area | Label | Notes |
|---|---|---|
| Guest create → PENDING_HOST wait UI + countdown | **Implemented** | `BookingModal` steps: review → guest → waiting_host → payment → confirmed |
| Never init pay on PENDING_HOST | **Implemented** | Modal + Trips re-fetch status before `initializePayment` |
| PAYMENT_PENDING → Paystack → backend verify | **Implemented** | `verifyPayment` after init; redirect URL when present |
| Host Accept / Decline + countdown | **Implemented** | Dashboard Actions; confirm on decline; post-accept = payment-pending copy |
| Guest cancel unpaid via API only | **Implemented** | Modal + Trips; no local-only cancel |
| CONFIRMED: no guest refund CTA | **Implemented** | Guidance modal; admin-only messaging |
| Status recovery (load / Paystack return / focus / poll) | **Implemented** | Trips + modal bounded poll; focus/visibility refresh |
| Dates/guests preserved; capacity / min nights | **Implemented** | `BookingPanel` + `minimumNights` on StayDetail |
| Resend from server only | **Implemented** | No client email send |
| Next accept/decline API proxies | **Implemented** | `/api/bookings/[id]/accept\|decline` |
| Host bookings deadline fields | **Implemented** | `hosts.service.getHostBookings` |

## Tested

| Suite | Label |
|---|---|
| `tests/phase4-web-booking-lifecycle.test.ts` | **Tested** (run against local DB) |
| Phase 3 lifecycle still SoT | Relies on existing `phase3-reservation-lifecycle.test.ts` |

Flows covered: create PENDING_HOST, pay gate, accept→PAYMENT_PENDING + idempotent, decline, guest unpaid cancel, CONFIRMED→REFUND_REQUIRED, min nights/capacity, getBooking recovery.

## Partial / Deferred

| Item | Label | Why |
|---|---|---|
| Full browser E2E (Playwright) | **Deferred** | No browser harness in repo; service-level contract tests instead |
| Disk persistence of guest draft dates across sessions | **Deferred** | Panel state is session UI; backend pricing on create |
| WebSockets | **Deferred** | Not present; bounded polling used |
| Late-pay recon UI for admin | **Deferred** | Admin-facing; not guest Phase 4 |

## Known limitations

- Countdown clocks are **display-only**; expiry is server-side.
- Guest modal cancel-on-close is best-effort; expire job cleans leftovers.
- Trips merges localStorage guest bookings with authenticated list — refresh prefers API when logged in.
- Client price on panel is **estimate** until create returns server total.

## Product rule compliance

**Only admin makes refunds.** Guests see contact/guidance for paid cancel. Hosts never get a guest refund button. Late-pay recon stays admin-facing.

---

**STOP (Phase 4).** User authorized continuing to Phase 5 in the same batch — proceeding to Flutter.
