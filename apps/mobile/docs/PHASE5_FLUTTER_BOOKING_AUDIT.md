# Phase 5 — Flutter Booking Audit (pre-code)

**Date:** 2026-11-08  
**Reconciles:** `BOOKING_LIFECYCLE_AUDIT.md` (stale) vs Phase 3 backend.

## Reconciliation (critical)

| Old mobile audit | Phase 3 truth |
|---|---|
| Create → `PAYMENT_PENDING` immediately | Create → **`PENDING_HOST`** + `host_response_deadline_at` |
| No host accept/decline | `POST /api/bookings/:id/accept\|decline` |
| Pay anytime on PAYMENT_PENDING | Pay **only** after accept; init rejected on `PENDING_HOST` |
| “Waiting for host” only for rare `PENDING` | **`PENDING_HOST`** is the host-wait status |

## Current Flutter gaps

| Surface | Gap |
|---|---|
| `IleBooking` | No `PENDING_HOST` in `isRequest` / headlines; no deadline fields; comments say create=PAYMENT_PENDING |
| `ReserveScreen` | Correct create path; navigates to status — status screen still treats pay-first |
| `ReservationStatusScreen` | Pay CTA without host-wait UI; clipboard URL hack; no poll/deadlines; no cancel unpaid; no resume recovery |
| `BookingsScreen` tabs | Requests miss `PENDING_HOST` |
| `ile_api` | No cancel; no verify; create may drop timers/deadlines |
| Help copy | Still says create → PAYMENT_PENDING |
| Date edit | `editMode` pops back to reserve — **OK**; ensure slug preserved |

## Phase 5 plan

1. Model: safe status parsing, deadlines, `PENDING_HOST` request tab, honest copy.
2. API: cancel, verify payment, parse timers from create/get.
3. Status screen: waiting (countdown display-only) → pay → confirm via verify; resume/focus refresh; dispose timers; no fake zero→transition; late-pay message ≠ confirmed; no guest refund.
4. Bookings tabs with real statuses including PENDING_HOST.
5. Reserve/help copy; analyze + unit tests.

## Out of scope

Phase 6/7, production deploy, ledger rewrite, inventing statuses, guest refund execution.
