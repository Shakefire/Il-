# Phase 1 — Core transaction reliability, booking, payments, and notifications

Date: 2026-11-23
Workspace: `C:\Users\user\Desktop\NEXT_HOME`
Scope: booking state machine, inventory holds, Paystack verification and webhooks, five notification channels, and the authorization needed to keep access details off public and email-only lookups.

This report was written from the current code and from tests run in this session. Earlier audit documents were not treated as evidence. Live Paystack, Resend, Termii, FCM, and VAPID delivery were not exercised. Nothing here is a production-readiness claim.

## Initial findings

The backend already owned the approved status names and windows:

- Booking: `PENDING` (legacy), `PENDING_HOST`, `PAYMENT_PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`
- Host response: `ACCEPTED`, `DECLINED`, `EXPIRED`
- Timers: `HOST_RESPONSE_WINDOW_SECONDS = 120`, `PAYMENT_WINDOW_MINUTES = 10`
- Payment rows use `SUCCESS` for a captured charge. The `PAYMENT_STATUS` constant also lists `VERIFIED`. `SUCCESS` was left in place. Failed abandoned attempts are stored as `ABANDONED`.

Gaps that were still unsafe:

- Host accept and payment confirmation could race. A losing confirmer could open a late-payment refund after the winner had already confirmed the stay.
- A failed or abandoned Paystack attempt cancelled an open `PAYMENT_PENDING` booking and released the date hold, so a guest could not retry inside the 10-minute window.
- A Paystack success after cancel or expiry could be confused with confirmation. Late money must be reconciled and must not revive the booking.
- Amount, currency, guest email, or booking metadata that did not match the server booking could still be treated as the right payment.
- Webhook redelivery needed a durable processed-event check and a unique `(gateway_provider, event_id)` index.
- `GET` booking and contact lookups could return the access token, phone, or house pass from an email address, and the verify payload could carry private stay details.
- Confirmation copy invented a gate code and a host phone when private details were missing.
- Admin delete could hard-delete bookings and payments. Several financial foreign keys were `ON DELETE CASCADE`.
- Booking create, payment init, and auth OTP/login routes had no per-IP limit.
- The expiry sweeper takes advisory lock `99281`. A targeted expiry must not wait on that lock.

Public property enrichment already offsets coordinates and does not select `property_private_details` (exact address, gate code, check-in instructions). That stayed in place.

All five notification channels were already routed: persistent inbox, Resend email, Termii SMS only, FCM, and VAPID web push. Missing destinations skip that channel and record why. This phase did not remove or replace any channel.

## Plan that was implemented

1. Lock the payment and booking rows, then confirm only from `PAYMENT_PENDING`.
2. Keep inventory until the host or payment deadline when an attempt fails or is abandoned.
3. On late or duplicate success, write a `REQUESTED` refund and do not confirm or recreate earnings.
4. Reject association mismatches without confirming.
5. Verify Paystack webhooks with HMAC-SHA512 of the raw body and the secret key, and ignore already-processed events.
6. Authorize booking reads. Email-only responses are redacted. House-pass contact requires a confirmed or completed stay plus token, guest, host, or admin.
7. Refuse admin hard-delete of bookings and payments. Point new and migrated foreign keys at `ON DELETE RESTRICT`.
8. Rate-limit create, pay init, and auth attempts in-process.
9. Keep client countdowns as display-only and stop treating a verify redirect as the house pass.
10. Cover the lifecycle with mocked provider tests. Do not call live providers.

## What changed

### Booking and inventory

- `acceptBooking` and `declineBooking` lock the booking row.
- Overlap checks still treat `PENDING_HOST`, `PAYMENT_PENDING`, and `CONFIRMED` as holds, plus manual blocks.
- Decline, host-window expiry, payment-window expiry, and guest cancel before payment release availability blocks and keep the booking row.
- `expireDueBookings(limit, onlyBookingId)` expires one booking without taking advisory lock `99281`. The global sweeper still takes that lock.
- `GET /api/bookings/:id` uses `authorizeBookingView`. Token, guest, or admin receive the booking. The host receives it without the access token. An email with no stronger credential receives a redacted status (no access token, phone, email, or guest id). Everyone else gets 403.
- Contact details (`getBookingContact`) require `CONFIRMED` or `COMPLETED`, and reject a missing token and the literal string `admin`. Admin is the user role, not a magic string.
- Arrival reminder processing requires a cron secret or an admin session.

### Paystack

- Initialize still builds a server reference and an amount from the booking snapshot, and only while the booking is `PAYMENT_PENDING` before the deadline.
- `processSuccessfulPayment` runs in one transaction with `FOR UPDATE` on the payment and the booking.
  - Already `SUCCESS` and `CONFIRMED`, and the association matches: idempotent return. No second earnings post.
  - Association mismatch: payment marked `SUCCESS` with an audit note, refund reason `PAYMENT_ASSOCIATION_MISMATCH`, booking left unconfirmed (`PAYMENT_PENDING` if the window is still open).
  - Second success after `CONFIRMED`: refund reason `DUPLICATE_PAYMENT_AFTER_CONFIRM`. The stay stays `CONFIRMED`.
  - Success after cancel, expiry, or a passed payment deadline: refund reason `LATE_PAYMENT_AFTER_CANCEL_OR_EXPIRE`. Blocks are removed. Earnings and payouts for that booking are cancelled. The booking is not revived.
  - The confirm update is conditional on `PAYMENT_PENDING`. If another worker already set `CONFIRMED`, the result is idempotent rather than a false late refund.
- `processFailedPayment` sets the attempt to `FAILED` or `ABANDONED`. It does not cancel `PAYMENT_PENDING`, `CONFIRMED`, or `COMPLETED`, and it does not delete blocks. The guest notification uses the guest user id, not the email address as a user id.
- Verify without `PAYSTACK_SECRET_KEY` no longer returns a fake verified amount of 0. In non-production mock mode it still requires a payment row and goes through `processSuccessfulPayment`.
- Webhook signature is HMAC-SHA512 hex of the raw body using `PAYSTACK_SECRET_KEY`, compared with `timingSafeEqual`. A duplicate `webhook_events` insert (`23505`) is treated as idempotent when the event is already `PROCESSED`.
- Verify responses do not include private stay details or the access token. The trips page loads the house pass from the contact endpoint after a confirmed stay, using the access token already held for that booking.
- Confirmation email and SMS no longer invent a gate code or a host phone. The guest is told to open the confirmed trip.

Ledger posting still goes through `LedgerService.recordBookingPayment`, which refuses a second journal for the same reference and `BOOKING_PAYMENT_RECEIVED`. Host earnings remain unique per booking. Post-payment payout still follows platform settings: `MANUAL` does not call a Paystack transfer.

### Notifications

Channels were not removed:

| Channel | Destination | Provider |
| --- | --- | --- |
| In-app | authenticated user id | `notification_inbox` |
| Email | email address | Resend when `EMAIL_PROVIDER=resend` and a key is set; otherwise console outside production |
| SMS | E.164 phone | Termii only when `SMS_PROVIDER=termii` and `TERMII_API_KEY` is set. No other SMS provider |
| Mobile push | FCM device token | FCM when configured |
| Web push | browser subscription endpoint | VAPID web-push when configured |

A missing or invalid destination skips only that channel (`SKIPPED` or `NOT_CONFIGURED`) and records the reason. Email is not substituted for a user id, phone, or device token.

Lifecycle events already on the routing matrix include registration and OTP, password reset, booking request, host accept and decline, host and payment expiry, payment confirmed and failed, late-payment resolution, cancellation, arrival guide, KYC, listing moderation, reviews, refunds, and payouts. Booking and payment transitions in this phase call that orchestrator. Delivery statuses in the ledger are `PENDING` (queued), `SENT`, `ACCEPTED` (provider accepted, including mocks when `mockMode` is set), `DELIVERED`, `FAILED`, `EXHAUSTED`, `SKIPPED`, and `NOT_CONFIGURED`. Mock acceptance is not live delivery.

Inbox rows support read and unread. Channel sends are idempotent on the delivery key. Invalid FCM tokens and expired web-push subscriptions (404/410) are deactivated by the existing adapters.

### Security

- Ownership checks on accept, decline, cancel, booking read, and contact.
- Per-process fixed-window limits: booking create 12 / 10 min / IP; payment init 15 / 10 min / IP; auth windows are 15 minutes — register-owner 10, verify-email 20, resend-email-otp 5, send-phone-otp 5, verify-phone 10, register 10, login 15, forgot-password 5, reset-password 8.
- Admin `deleteBooking` and `deleteTransaction` always return 409. `deleteHost` returns 409 when bookings or host earnings exist.
- Schema, seed, and migration `0008_phase1_financial_retention.sql` set `ON DELETE RESTRICT` for booking property, payment booking, host earnings, payouts, refunds, and review booking when those tables exist. Unique indexes: `webhook_events (gateway_provider, event_id)` where `event_id` is not null, and `ledger_journals (reference, event_type)`. Unique-violation failures in the migration are swallowed so a pre-existing duplicate does not abort the rest of the migration. Duplicate ledger rows must be cleaned before the unique index can be relied on.
- Webhook raw-body HMAC as above. Secrets stay in env. This report does not print values.
- Rate limits are not shared across processes or instances.

## Files and services

Phase 1 behavior lives in:

- `backend/src/modules/bookings/bookings.service.ts`, `bookings.routes.ts`
- `backend/src/modules/payments/payments.service.ts`, `payments.routes.ts`, `paystack-transfer.service.ts` (verify result typing only)
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/notifications/notifications.service.ts` (no invented gate code)
- `backend/src/lib/rate-limit.ts`, `backend/src/lib/booking-audit.ts`
- `backend/src/db/schema/bookings.ts`, `payments.ts`, `finance.ts`, `reviews.ts`
- `backend/src/db/seed.ts`
- `backend/src/db/migrations/0008_phase1_financial_retention.sql`
- `backend/src/db/migrations/meta/_journal.json` (entries for `0007` and `0008`)
- `backend/src/modules/finance/finance.service.ts` (journal id narrowing only; payout rules were not redesigned)
- `src/app/api/bookings/[id]/route.ts`, `src/app/api/bookings/[id]/contact/route.ts`, `src/app/api/payments/verify/[reference]/route.ts`
- `src/app/trips/page.tsx`
- `tests/phase1-core-transaction.test.ts`, `tests/phase1-notification-routing.test.ts`
- `scripts/test_booking_email.ts` (assertion no longer expects an invented gate code)

The working tree also contains other uncommitted mobile and UI edits. Flutter booking and payment client code was not changed for this phase and was not tested.

## Database migration

`0008_phase1_financial_retention.sql` is in the Drizzle journal and was **not applied** to the database during this session. Application delete guards work without it. Existing `CASCADE` foreign keys remain until migrate runs.

`0007_things_to_know_and_booking_indexes.sql` is idempotent (`IF NOT EXISTS`) and is now in the journal. If it was applied outside the journal, `drizzle migrate` will try it again and should no-op.

## API behavior

- `POST /api/bookings` — 429 after 12 creates per IP per 10 minutes.
- `POST` payment initialize — 429 after 15 inits per IP per 10 minutes.
- `GET /api/bookings/:id` — authorized view; email-only is redacted.
- `GET` booking contact — token, guest, host, or admin, and only after confirm or complete.
- `POST` reminders process — cron secret (`CRON_SECRET` or `INTERNAL_JOB_SECRET`) or admin.
- Payment verify — `bookingConfirmed` is true only when the stay is confirmed. `reconciliationRequired` means a refund review, not a revived booking. No private details in the body.
- Admin booking and payment delete — 409.

Web and mobile countdowns remain display-only. The server deadlines decide expiry.

## Tests

Mocks only. Email lines in the Phase 1 run were `[Email Mock]`. No Paystack charge, transfer, refund, live SMS, live email, or live push was intentionally sent. The Phase 1 payment cases insert payment rows and do not call Paystack HTTP. The webhook case computes HMAC locally with whatever `PAYSTACK_SECRET_KEY` is already in the process environment. The value is not recorded here.

| Command | cwd | Exit | Result |
| --- | --- | --- | --- |
| `node --import tsx --test --test-force-exit tests/phase1-core-transaction.test.ts` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | 10 tests, 10 pass, 0 fail, 0 skipped. `duration_ms` 80425.4878 |
| `node --import tsx --test --test-force-exit tests/phase1-notification-routing.test.ts` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | 1 test, 1 pass, 0 fail. `duration_ms` 6887.2018 |
| `npx tsc --noEmit --pretty false` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | No `error TS` lines. Elapsed about 155s |

Phase 1 cases that passed: decline and cross-host 403, concurrent accept leaves one `PAYMENT_PENDING`, overlapping requests 409, concurrent confirm is idempotent and a later failure does not unconfirm, abandoned attempt keeps the hold, late payment and replay create one refund and do not confirm, amount and currency mismatch do not confirm, webhook bad signature rejected and SHA512 redelivery is idempotent, email lookup cannot read the access token, admin delete of booking and payment is 409, targeted expiry releases one unpaid hold.

The routing test checks the matrix for booking and payment events and rejects substituted recipient types (phone as email, email as SMS, email or phone as user id, email as a device token, non-URL web push). It does not deliver anything.

Not run, and not described as passed:

- `next build`. Not run so a running Next dev server and `.next` would not be disturbed.
- Flutter tests. Mobile booking, payment, and notification client code was not changed.
- Browser pass of the trips verify and contact flow.
- `tests/notification-independence-and-search-flow.test.ts`. Types were aligned with the current inbox, ledger, Termii, FCM, and web-push signatures. It was not executed, because those adapters follow the process env and could call a configured provider.
- `scripts/test_booking_email.ts`. The gate-code assertion was updated. The script was not executed.
- Existing phase 2–9 suites. They were not re-run. Type errors in them were corrected only where `tsc` failed.

An earlier Phase 1 attempt called `expireDueBookings` without a booking id against the shared `DATABASE_URL`. That can expire other rows already past their host or payment deadline. Notifications from that process were console mocks, not live Termii. The shipped test expires only the booking it created.

## Env var names

`DATABASE_URL`, `NODE_ENV`, `SESSION_SECRET`, `FRONTEND_URL`, `CRON_SECRET`, `INTERNAL_JOB_SECRET`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_MOCK_TRANSFERS`, `RESEND_API_KEY`, `EMAIL_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_SUPPORT`, `SMS_PROVIDER`, `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`, `PUSH_PROVIDER`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `WEB_PUSH_PROVIDER`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`.

`PAYSTACK_MOCK_TRANSFERS` is forced off when `NODE_ENV=production`. Console email and SMS fail closed in production instead of pretending to send.

## Deploy and rollback

Deploy:

1. Apply Drizzle migrations through `0008` before relying on foreign-key retention. Clean duplicate `ledger_journals (reference, event_type)` and `webhook_events (gateway_provider, event_id)` rows first if the unique indexes no-op.
2. Set the env names above. SMS must stay Termii-only. Do not enable mock transfers in production.
3. Point Paystack webhooks at the raw-body route. Signature is HMAC-SHA512 of the raw body with `PAYSTACK_SECRET_KEY`.
4. Run one API process family that can see the same rate-limit store, or accept that limits are per process until a shared store exists.
5. Confirm `EMAIL_PROVIDER`, `SMS_PROVIDER`, `PUSH_PROVIDER`, and `WEB_PUSH_PROVIDER` are the live values, not `console`.

Rollback: revert the application commit. Leaving `ON DELETE RESTRICT` in place is safer than restoring cascade deletes. Restoring cascade would again allow a property or booking delete to remove payment history.

## Decisions requiring product owner

These behaviors were implemented because the phase prompt already required them and the previous code did the opposite. They change what a guest or admin can do:

1. A failed or abandoned charge no longer cancels an open `PAYMENT_PENDING` booking and no longer releases the dates. The guest may retry until the 10-minute deadline. Expiry still releases the hold.
2. An email address alone no longer reveals the access token, phone, or house pass. The contact endpoint requires the access token, the guest session, the host session, or an admin user.
3. Admin hard-delete of bookings, payments, and of hosts who still have bookings or earnings is refused (409). Suspend or archive instead.
4. A second successful charge after `CONFIRMED` opens `DUPLICATE_PAYMENT_AFTER_CONFIRM` and does not change the booking.
5. Amount, currency, or guest/booking association mismatch does not confirm. Refund reason is `PAYMENT_ASSOCIATION_MISMATCH`. If the payment window is still open the booking stays `PAYMENT_PENDING`. The guest “do not pay again” late email is not sent for a mismatch. Late and duplicate charges still notify.
6. The verify API does not return private details or the access token.
7. Dev verify without `PAYSTACK_SECRET_KEY` does not return `verified: true` with amount 0.
8. Rate limits are per process, not distributed.

## Remaining blockers

- Migration `0008` is not applied on the database used by the tests.
- Live Paystack verify, webhook delivery, Resend, Termii, FCM, and VAPID are unverified. Mocked tests are not live proof.
- Trips payment-success UI was not clicked through in a browser.
- `next build` was not run.
- Flutter was not tested.
- In-memory rate limits reset on restart and are not shared across instances.
- Unique ledger and webhook indexes do nothing if duplicate rows already exist; the migration swallows that error.
- The notification independence suite and the booking-email script were not executed after the type and copy fixes.
