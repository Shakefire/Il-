# Ilé notification matrix

Lifecycle events → channels. Persistence via delivery ledger + inbox; idempotency keys on email.
Push/SMS may be silent when VAPID / FCM / Termii are unconfigured — copy still ships to inbox/email.
**Inbox persistence is independent of push delivery.**

Source of dispatch: `backend/src/modules/bookings/bookings.service.ts` (+ payments / finance / auth / hosts for non-booking events) via `lifecycle-notify.ts` → orchestrator.

| Event | Recipient | Email subject pattern (code) | Inbox title / body (code) | SMS (when phone) | Deep link | Idempotency |
|-------|-----------|------------------------------|---------------------------|------------------|-----------|-------------|
| GUEST_REQUEST_SUBMITTED | Guest | `Waiting for the host: {title} (#{ref})` | Booking request sent / request sent; host must accept; no charge language in email body | Optional short status | `/trips` | `booking:{id}:GUEST_REQUEST_SUBMITTED:guest:email` |
| HOST_REQUEST_RECEIVED | Host | `New request: {title} (#{ref})` | New booking request / respond within window | Optional | `/host/dashboard` (tab bookings preferred) | host role key |
| GUEST_HOST_ACCEPTED | Guest | `Proceed to payment: {title} (#{ref})` | Host accepted — proceed to payment | Pay before deadline | `/trips` | guest |
| GUEST_HOST_DECLINED | Guest | `Request declined: …` | Host declined; browse similar; **no charge** | Optional | `/trips` | guest |
| GUEST_HOST_WINDOW_EXPIRED | Guest | `Request timed out: …` | Host did not respond; **no charge** | Optional | explore / trips | guest |
| GUEST_PAYMENT_WINDOW_EXPIRED | Guest | `Payment window ended: #{ref}` | Hold released; **not confirmed** | Optional | explore | guest |
| GUEST_CANCELLED_BEFORE_PAYMENT | Guest | Cancelled (unpaid) | Unpaid request cancelled | — | trips | guest |
| GUEST_PAYMENT_CONFIRMED | Guest | Confirmed stay / booking confirmed | Payment verified; arrival unlock | Optional | trips / access | guest |
| GUEST_ARRIVAL_GUIDE | Guest | Arrival guide | Check-in / arrival details | Optional | trips | guest |
| HOST_BOOKING_CONFIRMED | Host | Booking confirmed + host amount | Confirmed stay; earnings **held for settlement** per rules | Optional | host dashboard | host |
| HOST_ARRIVAL_REMINDER | Host | Arrival tomorrow | Guest arriving | Optional | host dashboard | host |
| GUEST_LATE_PAYMENT_RESOLUTION | Guest | Resolution pending | Paid after cancel — **not confirmed** | — | trips | guest |
| ADMIN_LATE_PAYMENT_RECON | Admin | Late payment recon (ops) | Internal Paystack/recon language OK | — | `/admin` | admin |
| Listing / host onboarding | Host | Review / approved / more info | **Identity verification** (not KYC in customer email) | — | onboarding status | entity keys |
| hostWelcomeEmail | Host | Welcome — Complete Your Verification | Complete **identity verification** steps | — | onboarding | auth/host |
| Payout disbursed | Host | Payout sent | Amount sent to bank / paid to your bank | Optional | host earnings | payout id |
| Password reset / security | User | Reset / password changed | Security | — | reset URL | auth keys |
| bookingConfirmationEmail (legacy/pending path) | Guest | `Payment waiting: …` (was “Payment Pending”) | Badge **Payment waiting** (was ● PAYMENT PENDING) | — | trips | legacy |

## Channel honesty

| Channel | Live when | Customer expectation |
|---------|-----------|----------------------|
| Inbox | Always (DB) | Source of truth in-app |
| Email | Resend configured | Primary off-app |
| Web Push | VAPID keys | May be unavailable — do not claim “we pushed” |
| FCM | Firebase creds | Same |
| SMS | Termii | Same |

## Deep link rules

- Guest booking: `/trips` (default in `lifecycle-notify` when extras omit link) or `/booking/status/{reference}` with access token when issued
- Host requests: `/host/dashboard?tab=bookings` (callers may pass `/host/dashboard`)
- Host earnings: `/host/dashboard?tab=financials` (or Flutter host wallet route)
- Never deep-link guests into admin
- Never invent events that the services do not emit

## Copy accuracy notes (this pass)

- Guest confirmation email pending badge/subject scrubbed of raw PAYMENT PENDING
- Host welcome email KYC → identity verification
- Lifecycle default inbox deep link no longer `/bookings/{id}`
- No fake “push sent” claims when VAPID/FCM unset (prefs honesty still Partial on some empty states)
