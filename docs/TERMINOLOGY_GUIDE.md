# Ilé terminology guide

Customer-facing language for web, Flutter, email, SMS, push, and inbox.
Backend enums and admin ops language stay technical; map before display.

## Preferred terms

| Prefer | Avoid in customer UI | Notes |
|--------|----------------------|--------|
| stay / stays | shortlet (marketing OK sparingly), listing (guest browse) | Guests book *stays* |
| booking / booking request | reservation request (OK), order | |
| Waiting for the host | PENDING_HOST, awaiting approval | Exact guest lifecycle label |
| Payment waiting | PAYMENT_PENDING, pay now (as status) | Exact guest lifecycle label; CTA = Proceed to payment |
| Confirmed | CONFIRMED raw enum | |
| Completed | completed raw enum | |
| Identity verification | KYC | Hosts & guests (admin may keep KYC) |
| Earnings | wallet ledger, net payout (UI labels) | Detail can say “host amount” |
| Held for settlement | HELD | Not “your money is available” |
| Ready to withdraw | READY_FOR_PAYOUT | Status chip label |
| Available to withdraw | — | OK as **balance card** title for withdrawable amount only |
| Transfer in progress | PROCESSING | |
| Paid to your bank | PAID / DISBURSED | |
| Payment reference | Paystack Reference (guest banners) | Keep Paystack for checkout chrome only |

## Booking lifecycle (guest)

1. **Waiting for the host** — request sent; no charge.
2. **Payment waiting** — host accepted; guest must pay before deadline.
3. **Confirmed** — payment verified; arrival details unlock.
4. **Completed** — stay finished.
5. **Cancelled / declined / expired** — plain language; never imply a charge when unpaid.

## Host money

- Do not say held funds are withdrawable.
- Distinguish **Automatic** vs **Manual** payout mode without inventing balances.
- “100% of your base rate” is OK; never “100% of guest price.”

## Channels

- **Guest / host product UI:** this guide.
- **Admin portal:** KYC, ledger, Paystack, REQUESTED refunds OK.
- **Logs / API:** enums unchanged.

## Shared constants

- Web: `src/lib/guest-messages.ts`, `src/lib/host-messages.ts`, `src/lib/product-language.ts`
- Flutter: `apps/mobile/lib/core/guest_messages.dart`, `apps/mobile/lib/core/host_messages.dart`, `apps/mobile/lib/core/constants/app_strings.dart`

`phase8-consistency.guestStatusHeadline` delegates to `guestStatusLabel` — no second string table.

## Compliance report (implementation pass)

| Area | Before | After | Severity fixed |
|------|--------|-------|----------------|
| Guest PAYMENT_PENDING label | “Payment is waiting for you” (diverged from guide) | **Payment waiting** across web + Flutter + phase8 | High |
| Trips badge “Waiting for host” | Missing “the” | Uses `guestStatusLabel` → Waiting for the host | Medium |
| Host payout READY chip | Flutter “Available to withdraw” for status | **Ready to withdraw**; balance card keeps Available to withdraw | High |
| Host held | “Held until settlement” (Flutter) | **Held for settlement** | Medium |
| Host onboarding status chip | Raw `UNDER_REVIEW` etc. | `hostVerificationLabel` | Critical |
| Email pending badge | ● PAYMENT PENDING | ● Payment waiting | High |
| Host welcome email | Complete Verification (KYC) | Complete identity verification | High |
| Lifecycle inbox deep link default | `/bookings/{id}` | `/trips` | High |

### Remaining (honest)

| Item | Severity | Notes |
|------|----------|-------|
| Admin KYC / READY_FOR_PAYOUT display | — | Intentional for ops |
| Some host email/HTML still says “Reservation” interchangeably | Low | Acceptable synonym |
| Push prefs honesty when VAPID unset | Medium / Partial | Do not claim push delivered |
| Production deploy lag | — | Local tree only until deploy |
| Pre-existing `tsc` errors outside UX | — | Not treated as terminology blockers |
