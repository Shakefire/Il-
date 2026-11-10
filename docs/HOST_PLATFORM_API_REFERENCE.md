# Host Platform — API reference

**Prefix:** `/api/host` (Fastify module + Next App Router proxies where present)  
**Auth:** session cookie / bearer via `authenticateRequest` / `authenticateNextRequest`  
**Ownership:** property mutations require `properties.hostId === session.userId`

## Profile & onboarding

| Method | Path | Service |
|--------|------|---------|
| GET | `/profile` | `getHostProfile` |
| PUT | `/profile` | `updateHostProfile` |
| GET | `/onboarding/status` | `getOnboardingStatus` |
| PUT | `/onboarding/profile\|identity\|authority\|property-draft` | onboarding steps |
| POST | `/onboarding/submit` | `submitOnboardingForReview` |

## Properties

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/properties` | List / create (KYC gate) |
| GET/PUT | `/properties/:id` | Detail includes `images` (URLs) + `media` (id/order) |
| DELETE | `/properties/:id?mode=archive\|delete&confirm=true` | Archive if history; hard-delete only when empty |
| POST | `/properties/:id/submit\|publish\|relist\|unpublish` | Publish gates; **unpublish on Fastify + Next** |
| PUT | `/properties/:id/media-order` | Body `{ orderedImageIds, coverImageId? }` |
| GET | `/properties/:id/availability` | Blocks + holds |
| POST | `/properties/:id/availability/block` | Manual block; conflicts with reservation blocks |
| DELETE | `/properties/:id/availability/block/:blockId` | Unblock manual only |

## Dashboard & finance

| Method | Path | Notes |
|--------|------|-------|
| GET | `/dashboard` | Full earnings aggregation, wallet projection, occupancy, alerts |
| GET | `/bookings` | Host reservation ledger |
| GET | `/payouts` | Payout rows |
| GET | `/wallet` | `FinanceService.getHostWallet` (payout projection) |
| POST | `/wallet/withdraw` | Atomic READY→PROCESSING; restore on verified fail; no uncertain auto-retry |
| GET/PUT | `/payout-account` | **Fastify + Next**; Paystack resolve required on PUT |

## Booking actions (bookings module)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/bookings/:id/accept` | Host ownership; → `PAYMENT_PENDING` |
| POST | `/api/bookings/:id/decline` | Host ownership; → `CANCELLED` |
| POST | `/api/bookings/:id/confirm-check-in` | **Guest**, not host |

## Dual API note

Next.js fallback rewrites `/api/:path*` → Fastify. Next route handlers take precedence when present (`payout-account`, `unpublish`, `media-order`, property DELETE). Both call **canonical** `hostsService` / `BankResolutionService` / `FinanceService` — no duplicated business rules.
