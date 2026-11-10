# Phase 13 — Loading, empty, and error states

## Objective

Data screens should not sit blank, and booking-journey failures should say what failed and allow a retry where a retry is possible.

## Already correct (VERIFIED, not rebuilt)

- Explore property cards, search results, wishlist, and bookings already used skeletons and empty states
- Property details already had an image/title skeleton and a not-found empty state
- Amenities already have an empty state when the host configured none
- Help centre is static policy content (no fetch)
- Notifications screen is an honest empty state: there is no notifications feed API
- Inbox signed-out state is the existing auth prompt; signed-in state stays “messaging is coming soon”
- Bookings signed-out state stays the auth prompt
- Date picker already blocks past ranges, min nights, and capacity with inline copy, and shows a loading state on the save button while availability is checked

## What changed

- Review and reservation status use skeletons (reservation skeleton is labeled “Loading host confirmation” for assistive tech)
- Marketplace header name lines skeleton while the first explore payload is in flight; search chrome stays visible
- Property-detail skeleton adds bedroom-card and amenity-row placeholders
- Profile, inbox, and map search no longer use a lone centered spinner
- Profile network/server failures show a retry error instead of looking signed out. A 401 from `/api/auth/me` still shows the guest sign-in prompt
- Shared copy for: no internet, search failed, property unavailable, host request failed, payment initialization failure, payment verification pending, invalid dates, guest count exceeds capacity, request expired, authentication required, unexpected error
- Wired on explore, search, map search, property details, review, reservation load/pay, bookings, the date picker network failure, web booking modal create/pay errors

## Tests

`tests/phase13-guest-errors.test.ts` — 1/1 pass (8 assertions). Flutter `guest flow errors name the failure` is part of the 9/9 Flutter run.

## Not claimed

A device airplane-mode pass was not run. Classification is based on exception text (`SocketException`, `Failed to fetch`, timeouts) and API messages.
