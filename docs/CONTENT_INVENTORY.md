# Ilé content inventory (customer-facing)

Snapshot of surfaces that show copy to guests, hosts, or admins. Internal = ops/admin or logs.

**Status legend:** `Aligned` = uses shared constants / terminology guide · `Partial` = mostly aligned, residual hardcoded · `Open` = needs work · `Internal` = admin/ops OK as-is

## Shared constants (source of truth for status language)

| Surface | Path | Audience |
|---------|------|----------|
| Guest messages (web) | `src/lib/guest-messages.ts` | Guest |
| Guest outcome (web) | `src/lib/phase11-guest-outcome.ts` | Guest |
| Host messages (web) | `src/lib/host-messages.ts` | Host |
| Product language | `src/lib/product-language.ts` | Guest + Host |
| Guest messages (Flutter) | `apps/mobile/lib/core/guest_messages.dart` | Guest |
| Host messages (Flutter) | `apps/mobile/lib/core/host_messages.dart` | Host |
| App strings (Flutter) | `apps/mobile/lib/core/constants/app_strings.dart` | Guest auth |

Exact guest lifecycle labels: **Waiting for the host** · **Payment waiting** · **Confirmed** · **Completed** · declined/cancelled/expired in plain language.

Exact host payout labels: **Held for settlement** · **Ready to withdraw** · **Transfer in progress** · **Paid to your bank**.

---

## Message catalog (discovered customer-facing copy)

| Message ID | Current | Recommended | Audience | Channel | Trigger | Source | Action | Status |
|------------|---------|-------------|----------|---------|---------|--------|--------|--------|
| GUEST.STATUS.PENDING_HOST | Waiting for the host | Waiting for the host | Guest | UI / badge | Booking PENDING_HOST | `guest-messages` / Flutter `GuestMessages` | Keep single source | Aligned |
| GUEST.STATUS.PAYMENT_PENDING | Payment waiting | Payment waiting | Guest | UI / badge | Booking PAYMENT_PENDING | same | Keep; was “Payment is waiting for you” | Aligned |
| GUEST.STATUS.CONFIRMED | Confirmed | Confirmed | Guest | UI | CONFIRMED | same | Keep | Aligned |
| GUEST.STATUS.COMPLETED | Completed | Completed | Guest | UI | COMPLETED | same | Keep | Aligned |
| GUEST.STATUS.DECLINED | Host declined | Host declined | Guest | UI | CANCELLED + HOST_DECLINED | `phase11-guest-outcome` | Keep; never imply charged | Aligned |
| GUEST.STATUS.EXPIRED_HOST | Request expired | Request expired | Guest | UI | HOST_WINDOW_EXPIRED | same | Keep; no charge | Aligned |
| GUEST.STATUS.EXPIRED_PAY | Payment window closed | Payment window closed | Guest | UI | PAYMENT_WINDOW_EXPIRED | same | Keep; not confirmed | Aligned |
| GUEST.CTA.REQUEST | Request to book | Request to book | Guest | UI | Reserve / BookingModal | GuestMessages.bookNow | Prefer over Book Now | Aligned |
| GUEST.CTA.PAY | Proceed to payment / Complete payment | same | Guest | UI | PAYMENT_PENDING | GuestMessages | Keep | Aligned |
| GUEST.EMPTY.TRIPS | No trips yet | No trips yet | Guest | Web trips | Empty list | GuestMessages.emptyTripsTitle | Wired | Aligned |
| GUEST.AUTH.OTP | Enter verification code… | same | Guest | Flutter auth | Email OTP | `app_strings.dart` | Keep | Aligned |
| GUEST.AUTH.RESET | Forgot / reset password copy | same | Guest | Web + Flutter | Auth flows | app_strings / auth pages | Keep | Aligned |
| GUEST.EMAIL.REQUEST | Waiting for the host: {stay} | same | Guest | Email + inbox | GUEST_REQUEST_SUBMITTED | `notifications.service` + bookings dispatch | Subject aligned | Aligned |
| GUEST.EMAIL.ACCEPTED | Proceed to payment: … | same | Guest | Email + inbox | GUEST_HOST_ACCEPTED | lifecycle + bookings | Keep | Aligned |
| GUEST.EMAIL.DECLINED | Request declined… No payment | same | Guest | Email + inbox | GUEST_HOST_DECLINED | same | Keep | Aligned |
| GUEST.EMAIL.CONFIRM_LEGACY | Payment waiting badge (was ● PAYMENT PENDING) | Payment waiting | Guest | Email | bookingConfirmationEmail pending | `notifications.service` | Scrubbed | Aligned |
| GUEST.INBOX.DEFAULT_LINK | `/trips` (was `/bookings/{id}` fallback) | `/trips` | Guest | Inbox | lifecycle-notify default | `lifecycle-notify.ts` | Fixed default deep link | Aligned |
| HOST.STATUS.PENDING_HOST | Waiting for your response | same | Host | UI badge | PENDING_HOST | `hostBookingStatusLabel` / Flutter HostMessages | Wired web dashboard | Aligned |
| HOST.STATUS.PAYMENT_PENDING | Waiting for guest payment | same | Host | UI badge | PAYMENT_PENDING | same | Wired | Aligned |
| HOST.PAYOUT.HELD | Held for settlement | Held for settlement | Host | UI | HELD | `product-language` / HostMessages | Never withdrawable | Aligned |
| HOST.PAYOUT.READY | Ready to withdraw | Ready to withdraw | Host | UI | READY_FOR_PAYOUT | same | Was “Available to withdraw” on status chip | Aligned |
| HOST.PAYOUT.PROCESSING | Transfer in progress | same | Host | UI | PROCESSING | same | Keep | Aligned |
| HOST.PAYOUT.PAID | Paid to your bank | same | Host | UI | PAID/DISBURSED | same | Keep | Aligned |
| HOST.BALANCE.AVAILABLE | Available to withdraw | Available to withdraw | Host | UI card | Wallet available balance | HostMessages.availableToWithdraw | Card title OK (not status enum) | Aligned |
| HOST.IDENTITY.* | Identity verification / Verified host… | same | Host | UI + alerts | verificationStatus | product-language + hosts.service alerts | No raw enums / KYC in customer UI | Aligned |
| HOST.ONBOARD.STATUS_CHIP | Raw verificationStatus (was) | hostVerificationLabel(…) | Host | Web onboarding | Step 6 review | OwnerOnboardingWizard | Scrubbed | Aligned |
| HOST.EMAIL.WELCOME | Complete identity verification (was KYC) | Identity verification | Host | Email | hostWelcomeEmail | notifications.service | Scrubbed | Aligned |
| HOST.ALERT.REQUEST | Booking request waiting for you | same | Host | Dashboard alert | PENDING_HOST rows | hosts.service | Keep | Aligned |
| HOST.EMAIL.PAYOUT | Payout sent / Paid to bank | same | Host | Email + inbox | Finance disbursement | finance.service | Keep; no fake balances | Aligned |
| NOTIF.PUSH.OPTIONAL | Push may be silent | Do not claim “we pushed” | All | Push | VAPID/FCM unset | orchestrator | Honest prefs copy Partial | Partial |
| ADMIN.KYC.* | KYC / ledger / Paystack | Keep technical | Admin | Admin portal | Ops | admin page | Intentional Internal | Internal |

### Surfaces still scanned (no competing lifecycle labels found after this pass)

| Area | Paths | Notes |
|------|-------|-------|
| Home / search / stay | `src/app/page.tsx`, search, stay/[slug] | Brand/stays voice; no status enums |
| Trips | `src/app/trips/page.tsx` | Badges → guestStatusLabel |
| Booking modal | `src/components/BookingModal.tsx` | GuestMessages |
| Host dashboard panels | Overview / Settings / Notifications | HostMessages |
| Flutter bookings / reserve / paystack | `features/bookings/**`, `property/reserve_screen` | GuestMessages + outcome |
| Flutter host shell / wallet / reservations | `features/host/**` | HostMessages + HostStatusChip |
| Auth OTP / reset | Flutter app_strings + web auth routes | Covered |
| SMS | bookings.service smsMessage extras | Short hospitality; optional channel |
| API user messages | Client maps codes; sanitizeGuestAlert on Flutter/web | Machine codes not shown raw when sanitized |

## Internal-only (do not hospitality-rewrite)

- Admin finance tabs, ledger, reconciliation, Paystack balance ops
- Seed / migration / test fixtures
- API error codes returned as machine codes (map at client)
- Logic comparisons still use backend enums (`if status === "PENDING_HOST"`)
