# Phase 10 — Host confirmation / waiting flow

Audit of the live request-to-pay path. Backend statuses were not renamed. The reference names in the spec map as follows:

| Reference | Live status |
| --- | --- |
| PENDING_HOST_CONFIRMATION | `PENDING_HOST` |
| HOST_DECLINED | `CANCELLED` + `cancellationReason` `HOST_DECLINED` + `hostResponse` `DECLINED` |
| EXPIRED (host window) | `CANCELLED` + `HOST_WINDOW_EXPIRED` + `hostResponse` `EXPIRED` |
| CANCELLED (guest, unpaid) | `CANCELLED` + `GUEST_CANCELLED_BEFORE_PAYMENT` |
| HOST_CONFIRMED / AWAITING_PAYMENT | `PAYMENT_PENDING` |
| PAYMENT_EXPIRED | `CANCELLED` + `PAYMENT_WINDOW_EXPIRED` |
| BOOKING_CONFIRMED | `CONFIRMED` (only after verified Paystack success) |
| COMPLETED | `COMPLETED` |

There is no `DRAFT` booking row. The review screen is client state before `POST /api/bookings`.

## Audit answers

1. **Reservation request implemented.** VERIFIED. `createBooking` inserts `PENDING_HOST` and a `REQUEST_HOLD`. It does not initialize Paystack.
2. **Host notified.** VERIFIED. Best-effort `HOST_REQUEST_RECEIVED` email. Email failure is non-fatal. Resend quota was not chased.
3. **Host accept/decline UI.** VERIFIED. Host dashboard accept/decline calls the existing routes. Not rebuilt.
4. **Host response updates the reservation.** VERIFIED. Accept moves `PENDING_HOST` → `PAYMENT_PENDING` and sets `paymentDeadlineAt`. Decline moves to `CANCELLED` and deletes the hold.
5. **Guest notified of the response.** VERIFIED as best-effort email (`GUEST_HOST_ACCEPTED` / `GUEST_HOST_DECLINED`). The guest UI learns the new status by polling `getBooking`, not by a fake local transition. There is still no guest notifications feed API.
6. **Pending-host status.** VERIFIED. `PENDING_HOST` (legacy `PENDING` still recognized in the UI).
7. **Timeout.** VERIFIED. `hostResponseDeadlineAt` is create time + `HOST_RESPONSE_WINDOW_SECONDS` (120). Payment window is 10 minutes after accept.
8. **Guest can cancel while pending.** VERIFIED. Unpaid cancel on `PENDING_HOST` and `PAYMENT_PENDING` releases the hold and does not create a refund.
9. **Host can decline.** VERIFIED. `declineBooking` only from `PENDING_HOST`.
10. **Request can expire.** VERIFIED. `expireDueBookings` and in-transaction deadline checks on create/accept.
11. **Payment blocked until host accept.** VERIFIED in `payments.service` (`PENDING_HOST` rejected; init requires `PAYMENT_PENDING`). Flutter `canPay` and web re-check match that.
12. **Payment endpoint validates status.** VERIFIED. Confirm also requires `PAYMENT_PENDING`. Success after the booking left that status is reconciliation, not a silent confirm.
13. **Waiting is not simulated.** VERIFIED on reservation status and `BookingModal` (`waiting_host`). Countdown hitting zero refreshes the server. It does not locally mark the booking cancelled. **Gap fixed:** Flutter review copy claimed hosts do not need to accept before pay. That sentence was removed. Web trips now show the host and payment windows as display-only.
14. **Real backend transition.** VERIFIED. Accept, decline, expire, cancel, and verified payment are server transitions.
15. **Duplicate requests.** VERIFIED, not changed. The same guest’s overlapping unpaid hold is superseded (`SUPERSEDED_BY_NEW_BOOKING_ATTEMPT`). Another guest’s active hold returns 409 `DATE_CONFLICT`. Expired holds are cleared inside the create transaction.

## What changed

- Flutter review copy no longer says payment is the next step before host acceptance (see Phase 12 screen).
- Web trips show a display-only host window on `PENDING_HOST` and pay window on `PAYMENT_PENDING`.
- Pure helper `paymentUnlocked` is true only for `PAYMENT_PENDING`.

Money paths, ledger, Paystack fee recording, and transfer fee ₦0 were not modified.

## Tests

`npx tsx --test tests/phase10-host-confirmation-audit.test.ts` — 3/3 pass (run together with phases 11–13: 9/9).

## Assumption

Host and guest “notification” remains email plus client polling. No new notifications API was added.
