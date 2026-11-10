# Ilé Host Platform — Evidence-Based Audit Report

**Date:** 2026-11-10  
**Scope:** Host Platform across Next.js web, Flutter mobile, Fastify backend, Neon/Drizzle DB, admin integrations  
**Mode:** AUDIT ONLY — no rewrites, no deploy, no commits, no live Paystack transfers, no production data mutations  
**Evidence classes:** `INSPECTION` (code/schema read) · `AUTOMATED` (tests run this session) · `UNVERIFIED` (browser not exercised)

---

## 1. Executive summary

The Host Platform has a **substantial working backend core**: KYC onboarding → admin review → publish gates, property CRUD, availability blocks with reservation conflict checks, a single booking lifecycle (`PENDING_HOST` → accept/decline with **120s** deadline → `PAYMENT_PENDING` → `CONFIRMED`), payout projection wallet (`HELD` / `READY_FOR_PAYOUT` / `PROCESSING` / `PAID`), host self-withdrawal via Paystack, and admin KYC/suspend/reinstate.

**Web host UX is usable but monolithic** (~3,316-line dashboard), with real API wiring for properties, bookings accept/decline, calendar blocks, wallet, and bank account. Several stats are incomplete or misleading.

**Flutter host experience is largely missing** — only a wallet screen exists; `/host` routes to wallet, not a dashboard.

**Highest-severity findings:**
| ID | Severity | Finding |
|---|---|---|
| H-P0-1 | P0 | `deleteProperty(..., confirmWithReservations=true)` hard-deletes bookings (and cascades payouts/payments via FK) |
| H-P0-2 | P0 | Connected Neon DB missing migration `0005` columns (`phone_verification_attempts`) — schema/code drift; DB-backed host finance tests fail |
| H-P1-1 | P1 | `getDashboard` earnings computed from **last 10 bookings only** — understates lifetime net/gross |
| H-P1-2 | P1 | Flutter host ops missing (auth/KYC/properties/requests/calendar/earnings UI beyond wallet) |
| H-P1-3 | P1 | Dual API surface: some host routes Next-only (`payout-account`, `unpublish`); Fastify fallback incomplete for those |
| H-P2-1 | P2 | Occupancy metrics, dedicated host alerts feed, media reorder API — missing |
| H-P2-2 | P2 | Misleading copy: “100% net payout” vs platform markup/commission model |
| H-P3-1 | P3 | Dashboard IA / monolith polish; browser UX UNVERIFIED |

Guest booking/payment/refund/ledger/settlement paths were inspected for ownership boundaries only; no destructive changes were made.

---

## 2. Architecture and routes

### Stack (confirmed by inspection)

| Layer | Evidence |
|---|---|
| Fastify 5 | `package.json` → `fastify@^5.12.5`; `backend/src/app.ts` |
| Drizzle + Neon/pg | `drizzle-orm@^0.45.3`, `pg`, `@neon/*`; `backend/src/db/client.ts` |
| Next.js 14 | `next@^14.2.15` |
| Flutter | `apps/mobile/pubspec.yaml` (`ile_mobile`) |
| Paystack | transfer + bank resolution modules under `backend/src/modules/payments/` |
| Notifications | Resend (email), Termii (SMS), FCM deps in mobile, Web Push (`web-push`) |
| Migrations | `0000` … `0005` present under `backend/src/db/migrations/` |

### Dual API pattern

`next.config.mjs` uses **fallback rewrites** `/api/:path*` → Fastify (`BACKEND_URL` or `127.0.0.1:4000`). Next App Router handlers take precedence when present.

```
Browser / Next client
  → /api/host/* (Next route if exists) → hostsService / FinanceService (direct)
  → else rewrite → Fastify /api/host/* → hosts.routes.ts
Flutter → typically Fastify BASE_URL (no Next route layer)
```

### Fastify host module (`prefix: /api/host`)

| Method | Path | Service |
|---|---|---|
| GET/PUT | `/profile` | profile / onboarding update |
| GET | `/onboarding/status` | status machine |
| PUT | `/onboarding/profile\|identity\|authority\|property-draft` | KYC steps |
| POST | `/onboarding/submit` | UNDER_REVIEW |
| CRUD | `/properties`, `/properties/:id` | listings |
| GET/POST/DELETE | `/properties/:id/availability[/block[/:blockId]]` | calendar |
| POST | `/properties/:id/submit\|publish\|relist` | publish gates |
| GET | `/dashboard`, `/bookings`, `/payouts` | host ops |
| GET/POST | `/wallet`, `/wallet/withdraw` | finance |

**Missing on Fastify (exist as Next routes + service):**  
`POST /properties/:id/unpublish`, `GET|PUT /payout-account`.

### Host booking actions (bookings module)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/bookings/:id/accept` | host ownership check |
| POST | `/api/bookings/:id/decline` | host ownership check |
| POST | `/api/bookings/:id/confirm-check-in` | **guest**, not host |

### Admin host tools (`/api/admin/hosts…`)

List, detail, approve, reject, request-info, suspend, reinstate (+ Next admin proxies). Property approve/reject/suspend separate.

### Web pages

- `/host/dashboard` — monolith ops UI  
- `/host/onboarding/*` — business-type, profile, identity, authority, property-draft, review, status  
- `/host`, `/become-a-host` — marketing / entry  
- `/admin` — Hosts & KYC workspace tabs  

### Flutter

- Route `AppRoutes.hostDashboard = '/host'` → **`HostWalletScreen` only**  
- API: `getHostWallet`, `requestHostWithdrawal` only  

---

## 3. Feature-by-feature matrix

Legend: **WORKING** · **PARTIAL** · **BROKEN** · **MISSING** · **UNVERIFIED**

| Feature | Status | Frontend | Backend | DB | Sev |
|---|---|---|---|---|---|
| Host registration / role | WORKING | signup / become-a-host / onboarding | `auth.service` can set `role: host` | `users`, `profiles` | — |
| Email/phone OTP | WORKING (delivery credential-gated) | auth pages | auth + notifications | `users` OTP cols; **0005 phone rate-limit cols may be absent in live DB** | P0 if OTP rate-limit assumed live |
| Host login/session | WORKING | cookie session + middleware `/host/*` | Fastify auth | sessions via JWT cookie | — |
| KYC submit dossier | WORKING | onboarding pages | `submitOnboardingForReview` | `profiles`, `verification_logs` | — |
| KYC admin review | WORKING | `/admin` host workspace | approve/reject/request-info | `profiles.verificationStatus` | — |
| Publish gate unverified | WORKING | dashboard publish CTAs | create/submit/relist require APPROVED | `profiles.isVerified` / status | — |
| Multi-listing verified | WORKING | dashboard create | no listing cap after APPROVED | `properties.hostId` | P3 (no soft cap) |
| Host suspension | WORKING | admin UI | suspend → user SUSPENDED + all props SUSPENDED; marketplace filters | `users.status`, `properties` | — |
| Reinstate | WORKING | admin | `reinstateHost` | profiles + properties | — |
| Dashboard earnings card | BROKEN/PARTIAL | `dashboard/page.tsx` stats | `getDashboard` last-10 bookings | bookings | P1 |
| Properties list/CRUD | WORKING | dashboard modals | hostsService | `properties`, private, images, amenities | — |
| Publish / unpublish / relist | PARTIAL | dashboard | submit/publish/relist on Fastify; **unpublish Next-only** | status DRAFT/PUBLISHED | P2 |
| Media upload/order/remove | PARTIAL | upload + gallery replace array | `updateProperty` replaces images; `displayOrder` set by index; no dedicated reorder API | `property_images` | P2 |
| Availability blocks | WORKING | calendar tab | block/unblock; conflict with reservation blocks | `availability_blocks` | — |
| Nightly rate / commission snapshot | WORKING (at booking) | edit rate on listing | booking stores `hostCommission*` / `hostNetAmount` | `bookings` | — |
| Rate edit vs confirmed stays | PARTIAL | can edit listing price anytime | does not rewrite past bookings (good); no UI warning | — | P3 |
| PENDING_HOST accept/decline | WORKING | bookings tab | `acceptBooking` / `declineBooking` + ownership | bookings | — |
| 120s host deadline | WORKING | display countdown | `HOST_RESPONSE_WINDOW_SECONDS = 120` | `host_response_deadline_at` | — |
| PAYMENT_PENDING / CONFIRMED | WORKING | status badges | single lifecycle constants | bookings | — |
| Host cancel/refund | N/A / guest+admin | — | refunds admin-owned (preserve) | `refunds` | — |
| Wallet HELD→PAID projection | WORKING | financials tab + Flutter wallet | `FinanceService.getHostWallet` from **payouts only** | `payouts` | — |
| Bank account verify | WORKING (web) | bank modal | Next `/payout-account` + Paystack resolve | `profiles.bank*` | P2 Flutter |
| Host withdraw | WORKING | withdraw CTA | `requestHostWithdrawal`; fail restores READY; no uncertain auto-retry | `payouts` | — |
| Fee invention | WORKING | feePolicy ₦0 documented | interim Ilé absorbs transfer fee | ledger 5020 unused | — |
| Host notifications lifecycle | PARTIAL | shared `/notifications` inbox | lifecycle events include HOST_* | inbox + prefs (0005) | P2 |
| Host prefs UI | PARTIAL | profile/notifications prefs API | preferences service | `notification_preferences` | P3 |
| Occupancy analytics | MISSING | — | not in `getDashboard` | — | P2 |
| Dedicated alerts center | MISSING | only KYC + pending request banners | — | — | P2 |
| Flutter auth/KYC/host ops | MISSING | wallet only | APIs exist server-side | — | P1 |
| Browser E2E host flows | UNVERIFIED | — | — | — | — |
| Property delete with reservations | BROKEN (dangerous) | confirm dialog | hard-deletes bookings | bookings/payouts cascade | P0 |

---

## 4. Web dashboard audit

**File:** `src/app/host/dashboard/page.tsx` (~3,316 lines)  
**Tabs:** `properties` · `bookings` · `calendar` · `financials`  
**Data sources (INSPECTION):** `api.getHostDashboard`, `getHostBookings`, `getHostPayouts`, wallet, availability, accept/decline, bank modal.

| Area | Finding | Status |
|---|---|---|
| Loading | Tab-level loaders for properties/bookings/calendar/payouts | WORKING |
| Empty states | Present for no listings / no calendar / no blocks | WORKING |
| Errors | Mostly `alert()` + some inline banners | PARTIAL (a11y/UX) |
| Earnings hero | Uses `stats.earnings.totalNet` from truncated dashboard API | BROKEN accuracy |
| Reservations count | Uses full bookings list length (better than earnings) | PARTIAL copy (“Confirmed & pending”) |
| Occupancy | Not shown | MISSING |
| Accept/decline | Real API; countdown display-only (server is SoT) — honest copy | WORKING |
| NGN formatting | `formatNaira` used widely | WORKING |
| Ilé identity | Emerald `#0B5D45`, font-display headings | WORKING |
| Misleading copy | Create flow: “100% net payout” while guest sees 1.10× markup | PARTIAL |
| Dead buttons | No obvious inert CTAs found in core tabs; browser UNVERIFIED | UNVERIFIED |
| Responsiveness | Mobile-friendly tabs/overflow; not browser-verified | UNVERIFIED |

Onboarding suite under `/host/onboarding/*` is substantial and wired to onboarding APIs (INSPECTION).

---

## 5. Flutter host audit

| Capability | Status | Evidence |
|---|---|---|
| Host dashboard | MISSING | `/host` → `HostWalletScreen` |
| Auth as host | PARTIAL | shared guest auth; no host onboarding UI |
| Properties | MISSING | no screens / API wrappers |
| Booking requests accept/decline | MISSING | no mobile host booking UI |
| Calendar | MISSING | — |
| Earnings / withdrawals | PARTIAL | wallet balances + withdraw; bank add deferred to web |
| Profile / KYC | MISSING | — |
| Tests | PARTIAL | `phase7_checkin_wallet_test.dart` covers wallet path |

**Verdict:** Flutter is a **guest-first** app with a thin host wallet bolt-on — not a host operations client.

---

## 6. Backend API audit

### Strengths (INSPECTION)

- Ownership checks on property mutations (`hostId === userId`) and accept/decline (`property.hostId !== hostUserId` → 403).
- KYC gates on create/publish/relist for non-admin.
- Availability block refuses overlap with reservation-linked blocks (`ACTIVE_RESERVATION_CONFLICT`).
- Wallet is payout projection only (no invented balance table for withdraw).
- Withdrawal: `FOR UPDATE`, batch reserve READY→PROCESSING, verified fail restores READY; `otp_required` / failed initiation does not leave funds stuck without restore; no blind auto-retry of uncertain transfers.
- Commission/net snapshotted onto booking at create time.

### Gaps / defects

| Issue | Detail | Sev |
|---|---|---|
| Dashboard earnings window | `getDashboard` loads `.limit(10)` bookings then sums CONFIRMED/COMPLETED among those | P1 |
| `deleteProperty` cascade | Deletes `bookings` for property when confirmed; payouts FK `onDelete: cascade` | P0 |
| Unpublish / payout-account | Not registered on Fastify; Flutter/direct Fastify clients cannot call | P2 |
| `host_earnings` dual table | Still written/updated alongside payouts; withdraw UI correctly ignores it, but dual status can confuse admin/recon | P2 |
| PENDING_HOST not in delete guard | Upcoming check lists CONFIRMED/PENDING/PAYMENT_PENDING — not `PENDING_HOST` | P2 |
| Marketplace visibility | Search filters SUSPENDED host/property — good | WORKING |

---

## 7. Database / migration audit

### Migration files present

| File | Purpose |
|---|---|
| `0000_heavy_genesis.sql` | Core schema |
| `0001_newsletter_subscribers.sql` | Newsletter |
| `0002_phase3_reservation_lifecycle.sql` | Host response / payment windows |
| `0003_phase6_reliability.sql` | Reliability |
| `0004_core_notifications.sql` | Inbox / devices |
| `0005_notification_prefs_phone_otp.sql` | `notification_preferences` + phone OTP rate-limit columns |

### Live DB drift (AUTOMATED evidence)

Running DB-backed tests against configured `DATABASE_URL` failed with:

```text
column "phone_verification_attempts" of relation "users" does not exist
```

**Conclusion:** Migration **0005 is in repo but not applied** (or not fully applied) on the Neon database used by this environment. Schema TypeScript already declares those columns → inserts fail.

**Do not** apply migrations as part of this audit. Track as ops P0 before further DB-backed host finance testing.

### Key host-related tables

`users`, `profiles`, `verification_logs`, `properties`, `property_private_details`, `property_images`, `property_amenities`, `availability_blocks`, `bookings`, `payments`, `host_earnings`, `payouts`, `refunds`, ledger tables, notification tables.

---

## 8. KYC / security audit

| Control | Status | Notes |
|---|---|---|
| Onboarding steps + UNDER_REVIEW | WORKING | Requires ID, selfie, authority doc, bank |
| Admin approve → APPROVED + role host | WORKING | verification_logs + audit_logs + email |
| Reject / request-info / suspend / reinstate | WORKING | Suspend unpublishes all listings |
| Unverified cannot create/publish | WORKING | 403 messages |
| Middleware `/host/*` | WORKING | Requires session + emailVerified; does **not** require APPROVED KYC (dashboard shows banner instead) — intentional soft gate |
| Accept/decline IDOR | WORKING | hostId match required |
| Property get/update scoped by hostId | WORKING | |
| Payout account masking | WORKING | `maskAccountNumber` |
| Bank anti-spoof | WORKING (code) | Paystack resolve required; DB tests cancelled due to migration drift |
| Admin permanent host delete | DANGEROUS but gated | Deletes host + listings + earnings — admin-only; preserve policy awareness | P1 process |
| KYC docs storage | PARTIAL | URLs on profile; encryption/download UX in admin — deep storage security UNVERIFIED |

---

## 9. Booking / finance integration findings

### Lifecycle (single path — WORKING)

```
Create → PENDING_HOST (+120s hostResponseDeadlineAt)
  → accept → PAYMENT_PENDING (+ payment window)
  → pay success → CONFIRMED + payout HELD + host_earnings PENDING
  → guest check-in + hold → READY_FOR_PAYOUT
  → host withdraw / admin disburse → PROCESSING → PAID
  → decline/expire → CANCELLED (no refund on unpaid)
```

Constants: `HOST_RESPONSE_WINDOW_SECONDS = 120`, `PAYMENT_WINDOW_MINUTES = 10`, `DEFAULT_HOST_PAYOUT_PCT = 100` of classic host earnings (guest price still includes platform markup).

### Integration risks

1. **Dashboard earnings ≠ wallet available** — expected conceptually, but dashboard “Net Host Earnings” is also truncated (bug), so hosts may distrust numbers.  
2. **host_earnings vs payouts** — wallet correctly uses payouts; keep single SoT for UI.  
3. **Delete listing with confirm** — can destroy financial history (P0).  
4. **Guest check-in required for settlement** — implemented in finance release path (Phase 7); host does not confirm check-in.  
5. **Preserve refund/admin paths** — not host-callable; intact.

---

## 10. UI/UX problems

1. Monolithic dashboard (3k+ lines) — hard to maintain; mixed concerns.  
2. Heavy use of `window.alert` / `confirm` instead of inline patterns.  
3. “Under Review” stat card still implies admin listing review, while KYC-approved hosts **publish directly** (`submitPropertyForReview` sets PUBLISHED).  
4. “100% net payout” copy conflicts with 10% guest markup / commission snapshot language elsewhere.  
5. No occupancy or upcoming check-in summary section.  
6. Host notifications not surfaced inside `/host/dashboard` (global navbar inbox only).  
7. Flutter host entry from design-system preview only — easy to mistake wallet for full host app.  
8. Browser responsiveness / dead-control sweep: **UNVERIFIED**.

---

## 11. Broken and missing functionality

### Broken / dangerous

- Property delete with confirmation hard-deletes bookings/financial rows (**P0**).  
- Dashboard lifetime earnings undercount (**P1**).  
- Live DB missing 0005 columns → OTP rate-limit / prefs schema mismatch (**P0** ops).

### Missing

- Flutter host: KYC, listings, requests, calendar, profile, bank setup.  
- Occupancy metrics API/UI.  
- Host-native alerts / SLA reminders beyond email/SMS/push lifecycle.  
- Dedicated media reorder endpoint / UX beyond full gallery replace.  
- Fastify parity for `unpublish` and `payout-account`.  
- Soft listing caps / explicit multi-listing policy messaging (optional).

### Partial

- Media management, unpublish path dualism, notification channel delivery (credential-gated mocks), host prefs UX.

---

## 12. Prioritized backlog

### P0 — security / finance / data loss

1. Stop hard-delete of bookings on property delete; archive/unlist instead; never cascade-destroy payouts for settled stays.  
2. Apply / verify migration `0005` on all Neon environments (or align schema) before OTP/prefs/finance integration tests.  
3. Confirm payout FK cascade behavior under any remaining delete paths.

### P1 — core host ops

4. Fix `getDashboard` earnings to aggregate all eligible bookings (or serve wallet + payouts totals).  
5. Ship Flutter host MVP: pending requests (accept/decline + timer), properties list, deep-link to web for KYC/bank if needed.  
6. Align Fastify routes with Next for unpublish + payout-account (or document web-only and guard Flutter).  
7. Include `PENDING_HOST` in delete/unlist guards.

### P2 — incomplete

8. Occupancy + upcoming arrivals widget (real queries).  
9. Media reorder/remove polish with ownership checks.  
10. Host dashboard notification strip / unread badge for HOST_REQUEST_RECEIVED.  
11. Reduce dual `host_earnings` confusion in admin recon views.  
12. Copy pass: remove “100% net payout”; explain host base vs guest list price.

### P3 — polish

13. Split dashboard into route segments (`/host/properties`, `/bookings`, `/calendar`, `/earnings`).  
14. Replace alerts with toast/inline patterns; improve empty/error a11y.  
15. Soft multi-listing guidance; browser E2E for accept→pay→wallet.

---

## 13. Recommended dashboard IA

Keep Ilé brand (emerald, editorial type). Avoid card soup.

```
/host
  /home            Overview: KYC banner, pending requests (countdown), next arrivals, wallet available
  /requests        PENDING_HOST queue only (accept/decline)
  /stays           Upcoming / past reservations (read-only finance fields)
  /listings        Properties grid → detail editor (media, pricing, publish)
  /calendar        Property picker + blocks + booked holds
  /earnings        Wallet projection + history + withdraw + bank
  /account         Profile, notification prefs, deep-link to KYC status
```

First viewport of `/host/home`: brand, one headline, pending-request CTA if any, available-to-withdraw amount, primary “Manage listings” — no stat strip clutter.

Flutter: mirror **Requests + Earnings** first; defer full listing editor to web until parity matters.

---

## 14. Test results and evidence

### AUTOMATED (this session)

| Suite | Runner | Result |
|---|---|---|
| `tests/phase10-host-confirmation-audit.test.ts` | `npx tsx --test` | **3/3 pass** |
| `tests/phase7-web-checkin-withdraw.test.ts` | `npx tsx --test` | **5/5 pass** (UI helpers + mocked fetch) |
| `tests/phase7-checkin-wallet-settlement.test.ts` | `npx tsx --test` | **FAIL** — DB missing `phone_verification_attempts` |
| `tests/phase3-reservation-lifecycle.test.ts` | `npx tsx --test` | **FAIL** — same migration drift |
| `tests/bank-account-resolution.test.ts` | `npx tsx --test` | **FAIL** — same migration drift |

Plain `node --test` without `tsx` fails module resolution (expected; project docs use `npx tsx --test`).

### INSPECTION

Routes, services, schemas, Flutter router, admin host tools, migration files, notification credential-gated mocks, Next rewrite dual-path — all read from source.

### UNVERIFIED

- Browser walkthrough of `/host/dashboard` and onboarding.  
- Live Resend/Termii/FCM/Web Push delivery with production credentials.  
- Live Paystack transfer (intentionally not initiated).  
- Flutter device run of wallet screen against staging.

No diagnostic tests were added (existing coverage sufficient for gates; DB failures are environmental).

---

## 15. Proposed implementation sequence (later autonomous build)

Do **not** start this sequence until PO approves; preserve guest finance systems.

1. **Safety freeze:** patch `deleteProperty` to unlist/archive without deleting bookings/payouts; add regression test.  
2. **Schema sync:** apply `0005` (or equivalent) to Neon; re-run phase3 + phase7 + bank-resolution suites.  
3. **Dashboard truth:** fix earnings aggregation; wire overview cards to wallet + booking counts; fix misleading copy.  
4. **API parity:** register Fastify `unpublish` + `payout-account`; ensure Flutter and web share contracts.  
5. **Web IA split:** extract tabs into routes without behavior change; then occupancy/upcoming widgets.  
6. **Flutter host MVP:** requests list + accept/decline + wallet (existing) + web deep links for KYC/bank/listings.  
7. **Notifications:** host dashboard unread for HOST_REQUEST_RECEIVED; document credential-gated channels honestly in UI.  
8. **Hardening:** media reorder, PENDING_HOST delete guards, admin recon clarity (`payouts` SoT).  
9. **E2E:** Playwright/browser host accept → guest pay → check-in → withdraw (mocked Paystack).  

---

## Appendix A — Status rollup for parent agent

| Area | Working | Broken / Partial | Missing |
|---|---|---|---|
| Auth/KYC/admin | Registration, OTP plumbing, onboarding, admin approve/reject/suspend/reinstate, publish gates | Live DB 0005 drift; middleware doesn’t require APPROVED | — |
| Web dashboard | Properties, accept/decline, calendar blocks, wallet/withdraw, bank modal, NGN | Earnings undercount; copy; monolith UX | Occupancy, host-local alerts |
| Backend finance/booking | Lifecycle, 120s, wallet projection, withdraw restore-on-fail, ownership | Property delete cascade; Fastify gaps | — |
| Flutter host | Wallet read/withdraw | Bank setup web-only | Dashboard, KYC, properties, requests, calendar |
| Tests | phase10 + phase7-web pass | phase3/7/bank DB suites blocked by migration | Browser E2E |

---

*End of audit. No production data modified. No Paystack transfers initiated. Guest booking/payment/refund/ledger/settlement systems left intact.*
