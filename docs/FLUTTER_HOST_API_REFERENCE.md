# Flutter Host App — API reference

**Base:** Fastify (mobile `ApiConfig.baseUrl`)  
**Auth:** Bearer session from `/api/auth/login` (stored in secure session store)

## Host module (`/api/host`)

| Method | Path | Flutter `IleApi` | Notes |
|--------|------|------------------|-------|
| GET | `/profile` | `getHostProfile` | User + profile |
| PUT | `/profile` | `updateHostProfile` | Profile updates |
| GET | `/onboarding/status` | `getHostOnboardingStatus` | KYC progress / missing |
| PUT | `/onboarding/profile` | `updateHostOnboardingProfile` | Step: personal |
| PUT | `/onboarding/identity` | `updateHostOnboardingIdentity` | Step: ID + selfie |
| PUT | `/onboarding/authority` | `updateHostOnboardingAuthority` | Step: authority + bank resolve |
| PUT | `/onboarding/property-draft` | `saveHostOnboardingPropertyDraft` | Optional draft |
| POST | `/onboarding/submit` | `submitHostOnboarding` | → UNDER_REVIEW |
| GET/POST | `/properties` | `getHostProperties` / `createHostProperty` | KYC gate on create/publish |
| GET/PUT | `/properties/:id` | `getHostProperty` / `updateHostProperty` | Includes `media` |
| DELETE | `/properties/:id?mode=archive&confirm=true` | `archiveHostProperty` | Soft-archive when history |
| POST | `/properties/:id/publish` | `publishHostProperty` | Requires APPROVED |
| POST | `/properties/:id/submit` | `submitHostProperty` | Review path |
| POST | `/properties/:id/unpublish` | `unpublishHostProperty` | → Draft |
| POST | `/properties/:id/relist` | `relistHostProperty` | From archived |
| PUT | `/properties/:id/media-order` | `reorderHostPropertyMedia` | Cover + order |
| GET | `/properties/:id/availability` | `getHostPropertyAvailability` | Blocks + holds |
| POST | `/properties/:id/availability/block` | `blockHostPropertyDates` | Manual block |
| DELETE | `/properties/:id/availability/block/:blockId` | `unblockHostPropertyDates` | Manual only |
| GET | `/dashboard` | `getHostDashboard` | Metrics + alerts |
| GET | `/bookings` | `getHostBookings` | Includes `guestCheckInConfirmedAt` |
| GET | `/payouts` | `getHostPayouts` | Payout ledger |
| GET | `/wallet` | `getHostWallet` | Finance projection |
| POST | `/wallet/withdraw` | `requestHostWithdrawal` | Submit only |
| GET/PUT | `/payout-account` | `getHostPayoutAccount` / `updateHostPayoutAccount` | Paystack resolve |

## Bookings (host actions)

| Method | Path | Flutter | Notes |
|--------|------|---------|-------|
| POST | `/api/bookings/:id/accept` | `acceptHostBooking` | → PAYMENT_PENDING |
| POST | `/api/bookings/:id/decline` | `declineHostBooking` | → CANCELLED |
| POST | `/api/bookings/:id/confirm-check-in` | **Guest only** | Host UI must not call |

## Supporting

| Method | Path | Flutter | Notes |
|--------|------|---------|-------|
| GET | `/api/banks` | `getNigerianBanks` | Fastify parity (+ `/api/payments/banks`) |
| POST | `/api/uploads` | `uploadImage` | Base64; ownership if `propertyId` |
| GET/PATCH | `/api/notifications` (+ prefs) | inbox helpers | Real DB records |

## Ownership / IDOR

All host property and payout mutations check `hostId === session.userId` in `hostsService`. Accept/decline check property ownership in bookings module.
