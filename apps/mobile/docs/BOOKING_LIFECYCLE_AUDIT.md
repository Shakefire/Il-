# Ilé Mobile — Booking Lifecycle Audit

> **Superseded for statuses (2026-11-08):** Phase 3 backend creates **`PENDING_HOST`**, not immediate `PAYMENT_PENDING`. Host accept/decline APIs exist. See `PHASE5_FLUTTER_BOOKING_AUDIT.md` and `PHASE5_COMPLETION.md`. Sections below that say create → PAYMENT_PENDING are historical.

Evidence-based findings for guest search → reserve → payment. Web/backend left unchanged except where noted.

## Q1 — Search state retention

| Concern | Finding | Evidence |
|---|---|---|
| Source of truth | In-memory `SearchSession` (`ChangeNotifier`) provided at app root | `lib/core/state/search_session.dart`, `lib/app/app.dart` |
| Fields | destination, lat/lng, nearMe, checkIn/Out, guests, propertyType, bedrooms, bathrooms, price, power, amenities, sort | `search_session.dart` |
| Explore → Results → Detail → Reserve | Same Provider instance; dates/guests survive navigation | Detail & Reserve `context.watch/read<SearchSession>()` |
| Persistence | **Session-only** — lost on process kill; not written to SharedPreferences | `app.dart` constructs `SearchSession()` once |
| Competing sources | Host capacity chips use `property.maxGuests`; guest count uses `session.guests`. Filters tune icon on Explore was not separately wired (search card single tap) | `explore_screen.dart`, `property_detail_screen.dart` |
| Route params | `toQueryParameters` / `applyQueryParameters` exist but detail/reserve do not rehydrate from URI | `search_session.dart` |

**Verdict:** Guest criteria persist through the in-app flow via Provider. No second store overwrites dates/guests with host defaults. Gaps: no disk persistence; date picker always pushed to results (bad for edit-from-reserve).

## Q2 — Host vs guest data separation

| Data | Owner | Where |
|---|---|---|
| maxGuests, bedrooms, baths, beds, amenities, pricePerNight, minimumNights, availability | Host / listing | DB `properties` + `property_amenities` + `availability_blocks`; mobile `IleProperty` |
| check-in / check-out / guest count | Guest selection | `SearchSession` → `createBooking` body |
| maxGuests used as booked guests? | **No** on mobile reserve path — sends `session.guests` | `reserve_screen.dart` → `ile_api.dart` `guestCount` |
| Guest dates overwritten by host? | **No** | Session dates only; host has no default stay dates in API |
| Capacity validation | Backend enforces; mobile lacked pre-submit UX | `bookings.service.ts` L101–108 |
| Min nights | Backend enforces; `enrichProperty` previously omitted `minimumNights` (always fell back to 1 on mobile) | `bookings.service.ts` L110–118; `properties.service.ts` enrich |
| Price recalc | Server-side only on create | `calculateFromGuestPrice` in createBooking |
| Conflict checks | Availability blocks + stale PAYMENT_PENDING expiry (~5 min) | `bookings.service.ts` L121–211 |

### Bedroom / sleep schema

Schema has integer `bedrooms` + `beds` only — **no per-room photos or bed-type array**. “Where you’ll sleep” must derive from counts or show a transparent fallback (no invented rooms/photos).

### Amenities

Stored as `{ name, category, isHighlight }` (`property_amenities`). Host onboarding writes category `"General"` (`hosts.service.ts`). Web list: `AVAILABLE_AMENITIES` in `src/app/become-a-host/page.tsx`.

## Q3 — Editable before payment

| Stage | Editable? |
|---|---|
| Before request | Yes via SearchSession / date-guest picker |
| Review before send | Reserve screen shows summary; needs explicit Edit + validation |
| While PAYMENT_PENDING | No guest update API — cancel + recreate only |
| After CONFIRMED | No date/guest edit API |

## Q4 — Host confirmation / Bolt-style flow

### Actual `BOOKING_STATUS` (`backend/src/config/constants.ts`)

`PENDING` · `PAYMENT_PENDING` · `CONFIRMED` · `CANCELLED` · `COMPLETED`

### Ideal vs real

| Ideal | Real |
|---|---|
| PENDING_HOST → HOST_CONFIRMED → AWAITING_PAYMENT → CONFIRMED | **Missing.** Create inserts `PAYMENT_PENDING` immediately (`bookings.service.ts` L270) |
| Host accept/decline APIs | **None** (no matches in hosts/bookings modules) |
| Payment gated by host confirm | Payment gated only by status `PAYMENT_PENDING` via `/api/payments/initialize` |
| Expiry | Stale unpaid holds cancelled (~5 min) during conflict checks; admin expire-stale route exists |
| Cancel | `POST /api/bookings/:id/cancel` |
| Notifications | Emails on initiate / confirm / cancel — not push/inbox |

### Actual guest journey

1. Search with destination / dates / guests  
2. Open listing (session retained)  
3. Reserve form → availability check → `POST /api/bookings` → status **`PAYMENT_PENDING`**  
4. Guest pays via Paystack initialize → webhook → **`CONFIRMED`**  
5. Address / contact quarantined until CONFIRMED  

**Missing for Bolt-style:** host confirm statuses, host accept/decline endpoints, guest edit-booking API, push notifications, true PENDING_HOST hold without payment expectation.

Mobile must **not** fake host-confirm transitions. Copy and CTAs must match `PAYMENT_PENDING` = payable now.

### Mobile Bookings tabs (guest UI — date windows, not invented statuses)

| Tab | Inclusion rule |
|---|---|
| Requests | `PAYMENT_PENDING` **or** rare `PENDING` |
| Upcoming | `CONFIRMED` with check-in **after** today |
| Ongoing | `CONFIRMED` with check-in ≤ today **and** today < check-out (**mandatory separate tab**) |
| Past | `COMPLETED`, or non-cancelled / non-request with check-out ≤ today (and not Ongoing) |
| Cancelled | `CANCELLED` or legacy `FAILED` |

Copy mapping:

- `PAYMENT_PENDING` → “Payment due” / **Complete payment** (never “waiting for host”)
- `PENDING` → “Waiting for host confirmation” (only if API returns it; create path does not today)
- No accept/reject screens — reservation status screen reflects API status only

## Mobile integrity fixes (this change set)

- Persist SearchSession through detail/reserve (already Provider); improve edit return path  
- Never substitute `maxGuests` for selected guests; clamp guests to listing capacity when known  
- Client validate capacity / min nights before create  
- Review/reserve screen with Edit dates/guests  
- Gate pay CTA on `status == PAYMENT_PENDING` only  
- Status screens use honest API copy  

## Minimal backend fix (documented)

- Include `minimumNights` in `enrichProperty` so mobile can validate against real host setting.
