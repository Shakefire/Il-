# Phase 14 — Booking flow audit

Inspected the live web, Flutter, and Fastify booking path before the Phase 10–13 gap fixes. Status names were not migrated.

## UI findings

- **Header.** Flutter explore keeps avatar, greeting, map, notifications, and the search bar. While the first property payload loads, the greeting lines are skeletons and the cards below are skeletons. Logged-out greeting stays neutral.
- **Property details.** Title, location, specs, sleep cards, and amenities come from the listing. Sleep cards are derived from bedroom and bed counts. The schema has no per-room photos, and the screen says so. Amenity rows use host-configured amenities only.
- **Bottom navigation.** Explore, Wishlist, Bookings, Inbox, Profile already exist. Not restyled in this batch.
- **Calendar.** Guest date/guest picker is separate from the host calendar. It disables invalid ranges, enforces min nights and capacity, and checks availability when a property id is present.
- **Help and profile.** Help topics match the real request → host accept → pay → confirmed path and the admin-only refund rule. Guest profile does not show the host wallet.
- **Authentication.** Bookings and inbox require sign-in and keep a return path. Explore and public property details stay open. Profile treats 401 as signed out and other failures as errors.

## Booking findings

- **Search state.** `SearchSession` holds destination, dates, guests, and filters through results, details, and review. Guest count is the selection, not `maxGuests`.
- **Host vs guest data.** Capacity, bedrooms, amenities, nightly price, min nights, and availability are listing facts. Check-in, check-out, and guest count are the request. Create rejects guests above `maxGuests`, nights below `minimumNights`, and conflicting holds.
- **Requests exist.** `POST /api/bookings` creates `PENDING_HOST`.
- **Host confirmation exists.** Accept and decline are host-only and status-checked.
- **Payment gating.** Init and confirm require `PAYMENT_PENDING`. Flutter and web re-read status before init.
- **Statuses.** Live set is `PENDING_HOST`, `PAYMENT_PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, plus legacy `PENDING`. Decline and expiry are cancellation reasons.
- **Editing.** Dates and guests can be edited on the review screen before send. They are not edited in place after the request exists; a new request from the same guest supersedes an overlapping unpaid hold.
- **Amount.** Review shows an estimate. `totalAmount` on the booking is the payable amount. Paystack success alone does not confirm the booking.

## Missing functionality (left as-is)

- No guest notifications feed API (empty state only)
- No guest–host messaging API (inbox says coming soon)
- No cloud wishlist API (device-only)
- No per-bedroom photos in the listing schema
- Map search is the existing geo result list, not a second maps SDK

## Fixes applied after the audit

1. Booking lifecycle copy and terminal outcomes (decline / expire / guest cancel) on web and Flutter
2. Review screen estimate vs payable, and removal of the false “pay before host accept” sentence
3. Display-only host and payment countdowns on web trips
4. Skeletons and named errors on the guest journey screens listed in Phase 13

Backend payment, ledger, refund, and fee behavior was not changed. Transfer fee stays ₦0. Ilé absorbs it.
