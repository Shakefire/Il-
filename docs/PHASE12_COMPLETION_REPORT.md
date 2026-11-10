# Phase 12 — Booking review screen

## Objective

The guest reviews the stay, dates, guests, and an estimate before sending a request, and sees that payment is not collected yet.

## What changed

Flutter `ReserveScreen` now matches the request review:

- Property image, name, and location from the listing
- Dates and guests, each with Edit (both open the existing date/guest picker)
- Price summary: nightly rate, nights, stay subtotal, Paystack processing estimate, total estimate
- Copy: no payment yet; the host must confirm availability; the server sets the payable amount when the request is created
- Button: **Send reservation request**
- Guest name, email, and phone stay on this screen because `createBooking` requires them. Signed-in profiles are prefilled when `/api/auth/me` succeeds. Checkout still works without an account.
- Loading uses a review skeleton instead of a blank spinner

Web `BookingModal` review step now includes the same “no payment is required yet” sentence. It already showed image, dates, guests, nightly × nights, and the Paystack estimate. Platform commission is still hidden.

The estimate uses the same Paystack formula as `calculatePaystackFee` (1.5% path, ₦100 waived under ₦2,500, cap ₦2,000). `isFinalPayable` is false. The charge amount remains `booking.totalAmount` from the server.

## Tests

`tests/phase12-review-estimate.test.ts` — 3/3 pass. Flutter estimate assertion is inside `phase11_15_guest_flow_test.dart` (9/9 with the lifecycle file).

## Assumption

Nightly rate on the review screen is the public `pricePerNight`. Commission embedded in that guest price is not itemized.
