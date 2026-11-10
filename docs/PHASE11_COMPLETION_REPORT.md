# Phase 11 — Exact guest booking journey

## Objective

Make the guest UI tell the truth about the live journey: explore and search stay as they are; a request waits on the host; payment appears only after accept; decline, expiry, and guest cancel are different screens.

## Journey vs code

| Step | Result |
| --- | --- |
| Explore, search, dates, guests, filters, property details | VERIFIED. Search session is the guest selection. Listing max guests and min nights are constraints, not the booked values. |
| Review and submit | Gap closed in Phase 12. Submit calls `createBooking` and lands on the reservation status screen as `PENDING_HOST`. |
| Waiting | VERIFIED. Poll + display-only countdown. |
| Host declines | **Fixed.** Headline `Host declined`. Status stays `CANCELLED`. Payment stays off. |
| Request expires | **Fixed.** `HOST_WINDOW_EXPIRED` → `Request expired`. |
| Guest cancels unpaid | **Fixed.** `GUEST_CANCELLED_BEFORE_PAYMENT` → `Request cancelled`. |
| Host accepts | VERIFIED. Status becomes `PAYMENT_PENDING`. Pay CTA appears only then. |
| Checkout and verify | VERIFIED. Existing Paystack init + server verify. The client does not set `CONFIRMED` because a screen says success. |
| My Bookings | VERIFIED. List uses the same headlines. |

## Payment rules

- Pending, declined, expired, and guest-cancelled reservations report `paymentAvailable: false`.
- Only `PAYMENT_PENDING` reports payment available.
- Backend init/confirm still enforce that status. This phase did not change those functions.

## What changed

- `src/lib/phase11-guest-outcome.ts` and `apps/mobile/lib/core/phase11_guest_outcome.dart`
- Flutter `IleBooking.statusHeadline` / `statusBody` use that mapping. Confirmed stays still distinguish in-progress vs upcoming.
- Web `BookingModal` terminal step and trips badges use the same headlines.
- Reservation status uses a distinct icon for decline vs expiry and offers “Find another stay” on those terminals.

## Tests

- `tests/phase11-guest-journey.test.ts` — 2/2 pass
- Flutter `booking_lifecycle_test.dart` plus `phase11_15_guest_flow_test.dart` — 9/9 pass (includes Phase 12–13 cases)

## Assumption

A prefixed decline reason (`HOST_DECLINED: …`) is still a decline. No new status enum was added.
