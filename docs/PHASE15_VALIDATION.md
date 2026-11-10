# Phase 15 — Testing and validation

Focused checks for the Phase 10–14 gap fixes. The full repository suite was not re-run. Closed Phase 3, 8, and 9 suites were not repeated.

## Automated

| Command | Result |
| --- | --- |
| `npx tsx --test tests/phase10-host-confirmation-audit.test.ts tests/phase11-guest-journey.test.ts tests/phase12-review-estimate.test.ts tests/phase13-guest-errors.test.ts` | 9/9 pass |
| `flutter test test/core/booking_lifecycle_test.dart test/core/phase11_15_guest_flow_test.dart` (in `apps/mobile`) | 9/9 pass |
| `flutter analyze` on the touched Dart files | 0 errors. 5 pre-existing info lints (`unnecessary_underscores`) |

Covered in those tests:

- Payment unlock is only `PAYMENT_PENDING`
- Decline, host-window expiry, and guest cancel have different headlines and stay non-payable
- Prefixed `HOST_DECLINED: …` stays a decline
- Review estimate uses the Paystack helper, caps at ₦2,000, and is not a final charge
- Review copy does not say the host can be skipped
- Error titles for offline, capacity, dates, unavailable dates, payment init, payment pending, search, and auth

`flutter analyze` compiled the changed screens (review, reservation status, explore, search, property detail, bookings, profile, inbox, map, date picker).

## Scenario checklist

| Scenario | Evidence |
| --- | --- |
| Search by destination, dates, guests, results | Existing search session + results screen. Not re-executed in a browser this batch. |
| Open property details; amenities from host config | VERIFIED in code. Detail screen reads `amenityItems` only. |
| Change dates and guests before send | Review Edit buttons open the date/guest picker. |
| Submit request | `createBooking` → `PENDING_HOST`. UI routes to reservation status. |
| Host receives request | Existing host email + host dashboard. Not re-sent (Resend quota exhausted). |
| Host confirms; guest sees it; payment unlocks | Server accept → `PAYMENT_PENDING`. UI polls. Pay CTA gated. Not clicked against live Paystack. |
| Payment verified; booking confirmed; visible under Bookings | Existing verify path only confirms from `PAYMENT_PENDING`. Not charged in this batch. |
| Host declines / request expires / guest cancels | Outcome copy tested. Live DB transitions were not re-run. |
| Capacity and unavailable dates | API already rejects. UI maps those errors. |
| Payment before host accept | Blocked in payments service and both clients. Unit-tested via `paymentUnlocked`. |
| Logged-out restricted pages | Bookings and inbox already show sign-in with a return path. |
| Network lost | Copy classifier tested with offline-shaped errors. No device airplane-mode pass. |

## Not visually verified

Browser tools were not used for a click-through. No screenshots were captured. Alignment, type, and contrast on the review screen were implemented with existing Ilé tokens (emerald, alabaster, 44px edit targets) but not compared in a running browser or emulator.

## Not done

No deploy, no commit, no push, no production database writes, no Paystack charge, no refund execution, no email retry.
