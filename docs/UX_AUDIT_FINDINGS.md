# Ilé UX / content audit findings

Severity: Critical / High / Medium / Low. Status reflects this implementation pass.

## Critical

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| C1 | Guest outcome fallback can surface raw API status (`Status from server: PAYMENT_PENDING`) | Sanitize via `GuestMessages` / product language | Fixed |
| C2 | Guest payment banners over-index on “Paystack” and imply stay secured before server confirm | Hospitality payment copy; reference as payment ref | Fixed |
| C3 | Host “Available to withdraw” vs held funds risk of misread | Clarify held / pending labels; empty payout copy | Fixed |
| C4 | Host alerts expose raw `verificationStatus` enums + “Complete KYC” | Identity verification labels | Fixed |
| C5 | Host onboarding step 6 showed raw `verificationStatus` enum | `hostVerificationLabel` | Fixed (this pass) |

## High

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| H1 | Flutter welcome/auth copy generic (“Perfect Apartment”) | Align to Ilé stays voice | Fixed |
| H2 | Email subjects use emoji (💰⭐🎉) | Plain scannable subjects | Fixed |
| H3 | Guest/host KYC jargon across Flutter host shell | Identity verification | Fixed |
| H4 | Homepage hero weak brand signal vs design rules | Brand-first Ilé + stays subcopy | Fixed |
| H5 | Trips badge default shows raw `status` | Use outcome / guestStatusLabel | Fixed |
| H6 | Host email payout note can overclaim check-in-only timing | Settlement-rules language | Fixed |
| H7 | Guest PAYMENT_PENDING label diverged (“Payment is waiting for you” vs guide **Payment waiting**) | Unified to **Payment waiting** | Fixed (this pass) |
| H8 | Legacy booking confirmation email badge “● PAYMENT PENDING” | Hospitality badge + subject | Fixed (this pass) |
| H9 | Lifecycle inbox default deep link `/bookings/{id}` | Default `/trips` | Fixed (this pass) |

## Medium

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| M1 | Inconsistent “Book Now” vs “Request to book” | Prefer request language where unpaid | Partial — modal/reserve use Request to book; marketing CTAs may still vary |
| M2 | Admin destructive confirms exist but dense jargon | Clarified where touched; full admin rewrite deferred | Partial |
| M3 | Notification prefs when push unconfigured | Honest empty/setup copy | Partial |
| M4 | Trips badge “Waiting for host” missing “the” | Shared guestStatusLabel | Fixed (this pass) |

## Low

| ID | Finding | Status |
|----|---------|--------|
| L1 | Email shell font stack includes Roboto | Low priority; brand fonts not in email clients reliably |
| L2 | Some host dashboard still says “payout ledger” in loading | Softened where edited |

## Out of scope / preserved

- Booking state machine, finance math, authz, Paystack WebView flow
- No mock marketplace data; no fake host accept
- No production DB reset
- Backend enums unchanged in API contracts

## Verification notes (this pass)

- Phase 8 web consistency (5/5) + focused Flutter guest/host suites (18/18): COMPLETED AND VERIFIED
- Production ilestays.ng: local changes not deployed
- Full `tsc` / Next build: pre-existing errors remain; not treated as UX blockers
- No git commit (assignment did not request commit)

## Before / after examples

| Surface | Before | After |
|---------|--------|-------|
| Guest badge | Payment is waiting for you / Waiting for host | Payment waiting / Waiting for the host |
| Host payout chip | Available to withdraw (for READY_FOR_PAYOUT) | Ready to withdraw |
| Host held | Held until settlement | Held for settlement |
| Onboarding status | UNDER_REVIEW | Identity under review |
| Email pending | ● PAYMENT PENDING | ● Payment waiting |
| Host welcome | Complete Verification (KYC) | Complete identity verification |
