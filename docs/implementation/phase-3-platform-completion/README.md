# ILÉ Phase 3 — Guest and host experience, parity, admin, security

This report is from the code and the commands run in this workspace on 23 Nov 2026. Phase 1 and Phase 2 write-ups were not treated as evidence.

## 1. Audit

The repo is a Next.js 14 app in `src/`, a Fastify service in `backend/src/`, and a Flutter app in `apps/mobile/`. Booking state stays in `backend/src/modules/bookings/bookings.service.ts`. Finance stays in `backend/src/modules/finance/`. This phase did not add a second booking machine or a second refund executor.

Verified before changing code:

- Booking path is still `PENDING_HOST` (120s host window) then `PAYMENT_PENDING` (10 minute guest window) then `CONFIRMED` only after server-side payment success. Decline and expiry release inventory. Late payment is reconciliation. The host does not check in for the guest.
- Guest price is host base times `(1 + commission rate)`. Host earnings are the host base. Caution, cleaning, service, and extra-guest fees are not in the pricing path. Refunds are admin-only and funded from the commission account.
- Public property payloads go through `enrichProperty` in `backend/src/modules/properties/properties.service.ts`, which offsets coordinates. Private arrival fields live on `property_private_details`.
- `src/data/properties.ts` is seed and demo data. Live pages must not import `PROPERTIES`.
- `src/app/messages/page.tsx` is a coming-soon page with a mailto link. There is no messages table, API, or thread model.
- Reviews already existed (`backend/src/modules/reviews/reviews.routes.ts`) with one review per booking and a host reply column. They did not require checkout to have passed, did not sanitize text, and had no admin hide path.
- House pass was a contact endpoint that accepted an access token and did not structure map, wifi, rules, and times from stored rows.
- Favourites existed only as a local Flutter wishlist. The web heart did not persist.
- Support was mailto only.
- KYC is already required before publish in `hosts.service.ts` (`submitPropertyForReview`). A verified host publishes straight to `PUBLISHED`.
- Admin stats, KYC approve/reject, listing moderation, booking search, late-payment reconciliation, and the Phase 2 finance UI were already present. Audit logs were readable and not explicitly append-only on the HTTP routes.
- Global rate limit was missing. Per-route limits existed.
- Genesis foreign keys still cascade from users and properties into reviews. Migration `0008` already restricts bookings, payments, earnings, payouts, and refunds.
- Notification code already has inbox, Resend email, Termii SMS, FCM, and VAPID web push. No live delivery was attempted.
- `9jaroommate.com` is not in the tree. Public copy uses `ilestays.ng`.
- `defaultThingsToKnow().cautionFeeNgn` is `0`. A stored JSON spread could still have put `50000` back on the public payload. That spread is now forced back to `0`.
- The public stay page invented Abuja coordinates, a solar power label, a 5.0 rating, and host response stats when the API omitted them.

## 2. Gap matrix

| Area | Before this phase | What was done |
| --- | --- | --- |
| House pass | Token-capable contact payload | Session-only pass after confirmed/completed stay and a `SUCCESS` payment. Web and Flutter. |
| Reviews | Pre-checkout confirmed stays could be reviewed | Checkout must be before today. Text sanitized. Admin can hide. Guest can read own review. Web and Flutter forms. |
| Favourites | Local only | `favourites` table, `/api/favourites`, `/saved`, Flutter sync when the API is attached. |
| Support | Mailto | `support_cases`. Guest, host, and admin review. No refund execution. |
| Guest finance fields | Commission fields on some booking payloads | Stripped for guest and normal host earnings UI. Admin still sees commission. |
| Public listing fiction | Fallback coordinates, power, rating, host stats | Removed on the stay page and booking panels. |
| Rate limit | Per route | 240 requests / 60s per IP, with health and Paystack webhook exempt. |
| Audit edits | GET only, mutations not rejected | PUT/PATCH/DELETE on audit logs return 405. |
| Cascades | Reviews and property host still cascade in old SQL | Drizzle `onDelete: restrict` plus migration file `0010`. Not applied to a configured database. |
| Messaging | Coming soon | Not built. Owner decision below. |
| Paystack test init | Any non-empty key called `api.paystack.co` | Keys containing `local_only_not_live` stay on the existing test mock path. |

## 3. Plan that was executed

1. Keep booking and finance services as the only writers of those states.
2. Add house pass, reviews hardening, favourites, and a minimal support case flow on the existing Fastify and Next route style.
3. Redact commission on guest and host presentation. Leave admin finance as it is.
4. Do not build messaging.
5. Write migration `0010` and do not run it against `DATABASE_URL`.
6. Prove the new gates with `tests/phase3-platform-completion.test.ts` on an isolated PGlite directory.
7. Typecheck and production-build the web app with `ignoreBuildErrors` and `ignoreDuringBuilds` left `false`.
8. Analyze Flutter and build a release APK with the existing debug signing config. Do not create a keystore.

## 4. Work by surface

Backend:

- `backend/src/modules/bookings/house-pass.ts`
- `backend/src/modules/bookings/bookings.routes.ts` — `GET /api/bookings/:id/house-pass` and `GET /api/bookings/:id/contact` require a session
- `backend/src/modules/reviews/reviews.routes.ts`
- `backend/src/modules/support/support.service.ts` and `support.routes.ts` — `/api/support`
- `backend/src/modules/favourites/favourites.service.ts` and routes — `/api/favourites`
- `backend/src/lib/guest-finance-redaction.ts`
- `backend/src/lib/plain-text.ts`
- `backend/src/db/schema/platform.ts`
- `backend/src/db/migrations/0010_phase3_platform.sql`
- `backend/src/app.ts` global rate limit and route registration
- `backend/src/modules/admin/admin.routes.ts` audit log 405
- `backend/src/modules/payments/payments.service.ts` placeholder key does not call Paystack

Web (Next route handlers call the same services in process):

- `src/app/api/bookings/[id]/house-pass/route.ts`
- `src/app/api/support/cases/route.ts` and `.../respond/route.ts`
- `src/app/api/favourites/route.ts` and `[propertyId]/route.ts`
- `src/app/api/reviews/route.ts` and `reviews/property/[propertyId]/route.ts`
- `src/app/trips/page.tsx`, `src/components/StayFollowUp.tsx`, `src/app/support/page.tsx`
- `src/app/saved/page.tsx`, `src/app/admin/support/page.tsx`
- `src/app/stay/[slug]/StayDetailClient.tsx`
- `src/app/host/dashboard/page.tsx` link to `/support`

Flutter:

- `apps/mobile/lib/core/api/ile_api.dart` — house pass, review, support, favourites
- `apps/mobile/lib/features/bookings/reservation_status_screen.dart` — house pass sheet, review and support sheet
- Wishlist store syncs favourites when an API client is attached

A Fastify process that was already running does not load these routes until it is restarted. This work did not restart it. Next.js route handlers do not need that restart. The Flutter client defaults to `http://127.0.0.1:4000`, so mobile calls to the new routes need a restarted API. That restart was not done here.

## 5. Guest results

Search and listing pages read the property API. They do not import the fixture catalog. Public detail omits exact address, gate code, wifi, KYC, and bank fields. Those fields are loaded only inside `getHousePass`.

Favourites: `POST/GET /api/favourites` and `DELETE /api/favourites/:propertyId`. `/saved` lists and removes them. Flutter keeps the local cache if the API returns 401 or is offline.

Trips still follow the Phase 1 booking statuses. Late payment copy explains reconciliation and does not revive an expired stay. `StayFollowUp` and `/support` create a case. `refundExecuted` on the create result is always `false`.

The stay page no longer fills missing coordinates with Abuja, missing power with “Solar + Inverter”, missing rating with 5.0, or missing host stats with a 100% response rate. Booking panel and booking modal show power only when the listing has a power type.

## 6. Host results

Publish still goes through `submitPropertyForReview` in `backend/src/modules/hosts/hosts.service.ts`. Unverified hosts are rejected. Verified hosts go to `PUBLISHED` without a per-listing approval queue. Admin suspend, delist, and delete remain separate moderation actions and do not delete booking, payment, review, or ledger rows.

Listing CRUD, photos, amenities, price, rules, public location, and private arrival instructions were already on the host dashboard and host service. This phase did not replace that editor.

Calendar holds for `PENDING_HOST` and `PAYMENT_PENDING`, release on decline or expiry, overlap rejection, and the rule that a host cannot reopen a confirmed date are the Phase 1 booking service. Phase 1 core tests that cover accept, decline, overlap, and expiry passed in the run recorded in section 17. The host booking table shows a display-only countdown from `hostResponseDeadlineAt`.

Host booking rows and the dashboard recent list return `hostNetAmount` and do not return commission percent or commission amount. Wallet available balance is `READY_FOR_PAYOUT` for that host only. The Flutter help screen no longer describes a commission amount on payouts.

Host support: the bookings tab links to `/support`. The API allows the listing host to open a case on their booking and returns 404 for everyone else.

## 7. House pass access control

`getHousePass` in `backend/src/modules/bookings/house-pass.ts`:

- No user id or unknown user: 401 “Sign in to view the house pass.”
- Missing booking, missing property, or actor who is not the guest, the listing host, or an admin: 404 “Booking not found.”
- Status other than `CONFIRMED` or `COMPLETED`: 403.
- No `payments.status = SUCCESS` row: 403 “Verified payment is required before arrival details can be shown.”
- Map coordinates are returned only when both latitude and longitude are finite and non-zero. Nothing is invented.
- Address, gate, wifi, house rules, check-in/out text, and arrival notes are returned only when stored.
- Access tokens are not accepted.

Routes: Fastify `GET /api/bookings/:id/house-pass` and `GET /api/bookings/:id/contact`. Next `src/app/api/bookings/[id]/house-pass/route.ts` and the contact route. Web trips modal. Flutter house-pass sheet on confirmed or completed reservations.

Test: `house pass requires auth, ownership, confirmed status, and a successful payment` in `tests/phase3-platform-completion.test.ts`. Passed.

Public listing code does not call `getHousePass`.

## 8. Reviews

`createReview` in `backend/src/modules/reviews/reviews.routes.ts`:

- Booking must belong to the guest.
- Status must be `CONFIRMED` or `COMPLETED`.
- `checkOutDate` must be strictly before today (UTC date string).
- A second review for the same booking returns 409. There is no edit route.
- Title and body go through `toPlainText`.
- Host reply remains, and the reply text is sanitized. It was already in the schema, so it was kept.
- `POST /api/reviews/:id/moderate` is admin-only. Hiding requires a reason. Hidden reviews drop out of the public list and the property average. The guest `GET /api/reviews/mine` still returns their review.
- If `review_moderation` is missing, hide returns 503 and public reads treat the hidden set as empty rather than failing the page.

Web: `StayFollowUp` on past trips, and public reviews on the stay page via `GET /api/reviews/property/:propertyId`.

Flutter: reservation sheet “Review or contact support” calls `POST /api/reviews` only when checkout is before today. The API remains the authority if the device clock is wrong.

Test: `reviews require a completed stay, reject duplicates, sanitize text, and hide from the public list`. Passed.

## 9. Messaging assessment

Messaging is not an approved, implemented feature.

What exists: `src/app/messages/page.tsx` (“Messages is coming soon”) and `mailto:hello@ilestays.ng`. No schema, no API, no thread UI on web or Flutter.

This phase did not build messaging.

Owner decision: a real inbox would need retention, block/report, host-guest identity disclosure, staff access, and notification cost on email, SMS, and push. None of that policy exists. Support cases are the request path until an owner approves a messaging product. A mailto link is not that product.

## 10. KYC and multiple listings

`hosts.service.ts` refuses publish unless `profile.isVerified` or `verificationStatus === "APPROVED"`. Approved hosts are written as `PUBLISHED` in the same function. There is no second “awaiting admin” status for each new listing.

Test: `KYC blocks publish and a verified host can publish more than one listing`. Passed. The test log can include missing `notification_deliveries` on the empty PGlite database. Publish still succeeds because that notify path is non-fatal and email is `console` in the test loader. That is not a production delivery claim.

Admin can still change listing status with an actor and a reason. The audit details for that action are JSON with old status, new status, and reason (`admin.service.ts`).

## 11. Admin operations

Already enforced with `requireRole("admin")` on `backend/src/modules/admin/admin.routes.ts`:

- `getStats` counts users, properties, bookings, hosts under review, and sums `SUCCESS` payments.
- KYC approve and reject with a reason.
- Listing moderation with actor and reason.
- Booking search by reference, guest, host, property, and Paystack reference.
- Late-payment reconciliation remains the Phase 2 finance screen. It was not copied into a second UI.
- Notification delivery rows remain the inspection surface for failed sends.
- Audit log mutations return 405 “Audit logs are append-only.”

New admin surface: `src/app/admin/support/page.tsx` and `POST /api/support/cases/:id/respond`. Replies write an audit record and an in-app inbox item. They do not call the refund service.

Support responses are inbox-only on purpose, so opening a case does not send email or SMS.

## 12. Five notification channels

Verified in source. Not sent to live providers.

| Channel | Code | Destination |
| --- | --- | --- |
| In-app | `inboxService.upsertInboxItem` in `backend/src/modules/notifications/orchestrator.ts` | User id |
| Email | Resend when `EMAIL_PROVIDER=resend` | Email address |
| SMS | `backend/src/modules/notifications/termii.service.ts` | E.164 phone. `SMS_PROVIDER` is `termii` or `console` only. |
| FCM | `sendFcmPush` when `device.platform !== "web"` | Device token |
| VAPID web push | `sendWebPush` when `device.platform === "web"` | Web push subscription |

Env names only: `RESEND_API_KEY`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_SUPPORT`, `EMAIL_PROVIDER`, `RESEND_DOMAIN`, `SMS_PROVIDER`, `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`, `PUSH_PROVIDER`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `WEB_PUSH_PROVIDER`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`.

Test: `notification routing still names inbox, resend email, termii sms, fcm, and vapid web push`. Passed. It reads source. It does not deliver.

The production build log printed `SMS_PROVIDER=console` while Next loaded the environment for static generation. That is a configuration fact, not a live send.

## 13. Security

Global limit: `backend/src/app.ts` `onRequest`, `consumeRateLimit` 240 per 60 seconds per IP. Exempt: `OPTIONS`, `/health`, `/api/health`, `/api/payments/webhook`. Test: `global rate limit exempts health and paystack webhooks`. Passed.

IDOR:

- House pass: unrelated user gets 404. Test covered.
- Support: `getSupportCase` returns 404 when the requester is not the owner and not admin. Create with another person’s booking id returns 404. Test: `support cases are own-booking only and do not create refunds`. Passed.
- Host wallet: `getHostWallet` filters by that host. Test: `host wallet available balance is scoped to that host`. Passed.
- Guest booking reads go through `authorizeBookingView` and then finance redaction.
- Payout creation stays on the finance service for the authenticated host. This phase did not add a second payout route.

Cascade: `deleting a guest does not cascade-delete their review`. Passed on the isolated test database created with `ON DELETE RESTRICT`.

Logs: support and house pass errors are short messages. Bank numbers stay masked in the existing wallet presenter. OTP and secrets are not written by the new routes. The Paystack initialize error log prints the provider message (`Invalid key` in the phase 1 run), not the secret.

`9jaroommate.com`: no matches in application source. Domain strings in product code use `ilestays.ng`. DNS and hosting were not changed. API base URLs were not invented. Next rewrites still use `BACKEND_URL`, or `https://il-production.up.railway.app` in production, or `http://127.0.0.1:4000` in development (`next.config.mjs`).

Caution fee: `cautionFeeNgn` is forced to `0` after the things-to-know spread in `enrichProperty`. It is not in the pricing math. Test: `guest create payload and public defaults hide commission and the caution fee`. Passed.

`next.config.mjs` has `eslint.ignoreDuringBuilds: false` and `typescript.ignoreBuildErrors: false`.

## 14. Database and migrations

`backend/src/db/migrations/0010_phase3_platform.sql` creates `review_moderation`, `support_cases`, and `favourites` if they are missing, and changes the reviews property/guest foreign keys and the properties host foreign key to `RESTRICT` when the old constraints are present. It also adds optional `audit_logs` columns `reason`, `old_value`, and `new_value`. Statements are guarded and do not delete rows.

This file was not applied to `DATABASE_URL` or to any configured database. Drizzle schema matches the new tables so new installs and the Phase 3 PGlite bootstrap can create them. A database that has not run `0010` will fail favourites and support inserts, and review hide will return 503, until an operator applies the file.

`0008` already restricts bookings, payments, host earnings, payouts, refunds, and `reviews.booking_id`. Genesis `0000` still contains the historical `CASCADE` definitions. `0010` is the repair for the remaining dangerous keys. Applying it is an operator step.

Journal entries for `0009` and `0010` were added so the files are visible to Drizzle. Adding a journal row does not execute SQL.

The production `next build` logged `Connecting to PostgreSQL via DATABASE_URL` because `backend/src/db/client.ts` opens a pool when a route module is imported. That is a connection during static generation. No migration and no payment call were issued by this work.

## 15. Performance claims

Checked in source. Not re-benchmarked.

- Flutter reservation clock is a `ValueNotifier`. Poll delay is 4 seconds for the first 15 polls, then 8 seconds (`reservation_status_screen.dart`).
- Polling stops on `paused` and `inactive`.
- Host ticker starts only when a `PENDING_HOST` row still has seconds left (`host_reservations_screen.dart` `_syncTick`).
- Explore summaries slice description, images (5), and amenities (8) in `enrichProperty` when `isSummary` is true.
- Booking overlap uses `pg_try_advisory_lock(99281)` in `bookings.service.ts`.
- Fastify route registration in `app.ts` uses static imports. Bank resolution is still a dynamic import.

## 16. Parity matrix

| Capability | Backend | Web | Flutter |
| --- | --- | --- | --- |
| Search and public listing | Enforced | Uses API | Uses API |
| House pass | Enforced | Trips modal | Reservation sheet |
| Review after checkout | Enforced | StayFollowUp | Reservation sheet |
| Support request, no refund execution | Enforced | `/support`, trips, admin reply | Reservation sheet |
| Favourites | Enforced | `/saved` | Wishlist sync |
| Host 120s countdown | Server deadline | Dashboard text | Ticker when pending |
| Earnings without commission | Enforced on host payloads | Dashboard | Help copy |
| Admin stats, KYC, finance | Enforced | Admin pages | No admin app |
| Messaging | Not built | Coming soon | Not built |

A screen is not treated as complete unless the backend rejects the wrong caller. Flutter house pass and support still depend on a restarted API process, which was not done.

## 17. Typecheck, lint, build, and tests

Statuses: PASS, FAIL, BLOCKED, NOT RUN, UNVERIFIED.

| Command | cwd | Exit | Result |
| --- | --- | --- | --- |
| `npx tsx --import ./tests/force-phase3-db.mjs --test tests/phase3-platform-completion.test.ts` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | PASS. 10 tests, 0 failed. Duration about 35.9s. Loader sets `DATABASE_URL` empty and `ILE_PGLITE_DIR=.data/phase3-platform-test`. |
| `npx next build` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | PASS. Next.js 14.2.35. Compiled, linted, and typechecked with ignore flags false. Elapsed about 546s. `/support` and `/saved` are in the route list. The build opened the configured Postgres pool. |
| `npx tsc --noEmit --pretty false` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | PASS. Elapsed about 194s. No diagnostics. |
| `flutter analyze --no-fatal-infos` | `apps\mobile` | 1 | FAIL as a gate because warnings fail the command. 56 issues. No `error` diagnostics in the output. Infos and warnings are mostly existing unused imports and deprecations. |
| `flutter analyze --no-fatal-infos lib/features/bookings/reservation_status_screen.dart` | `apps\mobile` | 0 | PASS for that file. 2 infos (`unnecessary_underscores`) that were already in the file. |
| `flutter build apk --release` with `GRADLE_USER_HOME=C:\Users\user\.gradle` | `apps\mobile` | 0 | PASS. Gradle `assembleRelease` about 1254s. `app-release.apk` is 60.4MB. Debug signing. Not installed. |
| Phase 1 and 2 suite below | `C:\Users\user\Desktop\NEXT_HOME` | Not finished | See the next paragraph. Notification routing and the four Phase 2 files stay UNVERIFIED. |
| `$env:ILE_PGLITE_DIR = ".data/phase1-financial-engine-copy"; npx tsx --import ./tests/force-local-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase1-financial-engine.test.ts` | `C:\Users\user\Desktop\NEXT_HOME` | 0 | PASS. 5 tests, 0 failed, 0 cancelled, 0 skipped. Runner `duration_ms` 10330.4686. No `[Paystack] Initialization error` line. |

Phase 1 and 2 command. Output stopped after the pricing failure. The process was later aborted with no final pass/fail summary:

`npx tsx --import ./tests/force-local-db.mjs --test tests/phase1-financial-engine.test.ts tests/phase1-core-transaction.test.ts tests/phase1-notification-routing.test.ts tests/phase2-finance-rules.test.ts tests/phase2-finance-gaps.test.ts tests/phase2-ledger-and-reconciliation.test.ts tests/phase2-finance-redesign.test.ts`

Phase 1 core transaction reliability: PASS, 10 tests (request/accept/decline, concurrent accept, overlap, payment idempotency, failed attempt keeps the hold, late and mismatched payments, webhook HMAC, email lookup cannot read the house pass, admin cannot hard-delete booking or payment history, expiry releases an unpaid hold).

Financial engine: tests 1 and 2 PASS. Test 3 FAIL after about 26.2s. The log line is `[Paystack] Initialization error: Invalid key`. `initializeBookingPayment` called `https://api.paystack.co/transaction/initialize` because `tests/force-local-db.mjs` sets `PAYSTACK_SECRET_KEY` to a local placeholder. Paystack rejected the key. The pricing assertions sit before that call. The failure is the `init.success` check, not a change to the commission formula. No charge was created. Tests 4 and 5 of that file, the notification routing file, and the four Phase 2 files had not printed a result. Another Node process was already using `.data/phase2-finance-test`, so this run was not started again.

After that failure, `initializeBookingPayment` skips the live call when the key contains `local_only_not_live` and uses the existing `canUsePaystackDevMocks` path. Production keys are unchanged. No application code was changed for the re-run below.

Financial engine re-run, this file only. Other Node processes still had `.data/phase2-finance-test` open, so that directory was not opened again and nothing was killed. The command used a copy of that local database, `.data/phase1-financial-engine-copy`. No migration was applied. `tests/force-local-db.mjs` still set `PAYSTACK_SECRET_KEY` to `sk_test_phase2_local_only_not_live` and left the already-set `ILE_PGLITE_DIR` in place.

Command: `$env:ILE_PGLITE_DIR = ".data/phase1-financial-engine-copy"; npx tsx --import ./tests/force-local-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase1-financial-engine.test.ts`

cwd: `C:\Users\user\Desktop\NEXT_HOME`. Exit code 0. Runner summary: tests 5, pass 5, fail 0, cancelled 0, skipped 0, todo 0, `duration_ms` 10330.4686. Tests 1 through 5 passed, including pricing test 3 (`init.success`). The log has SMS and email mocks only. It does not contain `[Paystack] Initialization error: Invalid key`.

An earlier attempt with an empty `ILE_PGLITE_DIR=.data/phase1-financial-engine-rerun` exited 1 (tests 5, pass 0, fail 5) because the relations were missing. That directory is not the suite database and is not this result.

Notification routing and the four Phase 2 files from the combined command were not part of this re-run. They stay UNVERIFIED.

## 18. APK

Command: `flutter build apk --release` in `C:\Users\user\Desktop\NEXT_HOME\apps\mobile` with `GRADLE_USER_HOME=C:\Users\user\.gradle`. Exit 0. Gradle `assembleRelease` took about 1254s.

`apps/mobile/android/app/build.gradle.kts` sets the release build type to `signingConfigs.getByName("debug")`. No production keystore was created. A debug-signed APK is not a Play upload.

File: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (60.4MB). It was not installed on a device.

## 19. Unverified external services

Not called, or not claimed as delivered:

- Live Paystack charges, transfers, and refunds. One initialize request with the placeholder key returned `Invalid key` during the aborted Phase 1 run. That is not a payment. The later financial-engine file re-run did not log a Paystack error. Live charges, transfers, and refunds are still not claimed.
- Resend delivery.
- Termii delivery.
- FCM and VAPID delivery.
- Device install of the APK.
- Restart of an already running Fastify process on port 4000. Nothing was listening on 3000, 4000, or 8080 when those ports were checked before the production build. `next start` on port 3210 was used only for local page checks and is not a deploy.
- Operator application of migration `0010`.
- Guest booking, payment, and house-pass journeys on a device.

## 20. Remaining defects and owner decisions

Owner decisions:

- Messaging stays unbuilt until an owner approves scope, retention, and who may read a thread. Support cases are the interim path.
- Migration `0010` must be applied by an operator. This project will not apply it to a configured database.
- Support notifications are in-app only. Email, SMS, and push are not fired for a new case.
- House pass links that used to work with only an access token now require a signed-in guest, host, or admin.
- Debug APK signing is not store signing.

Remaining defects:

- Databases that have not run `0010` cannot persist favourites, support cases, or review hides.
- Flutter against an old Fastify process will 404 the new routes until that process is restarted.
- The combined Phase 1 and 2 test process did not finish. Notification routing and the four Phase 2 files in that command are UNVERIFIED for this session. Only `tests/phase1-financial-engine.test.ts` was re-run, and that file passed (5 pass, 0 fail, exit 0).
- Full `flutter analyze` exits 1 on existing warnings.
- Host onboarding still offers “Solar + Inverter” as a form default the host submits. That is an input default, not a public fallback. Public pages no longer invent it when the field is empty.
- `defaultThingsToKnow` still fills some public check-in copy when a listing has no stored text. The house pass does not use those defaults.
- Web support on a trip sends the selected category. The host dashboard links to `/support` rather than embedding the form on each row.
- Browser checks, if recorded below, are unauthenticated page loads. They are not a paid booking.

### Local page check

`npx next start -p 3210` was ready in about 3.3s. Checked in the browser while signed out. No account, no booking, no payment.

- `/support` shows the request form, including Refund request, and the sentence that sending a request does not move money. The case list says “Sign in required.” Submitting a filled form also returns “Sign in required.” The button shows “Sending…” while the request is in flight.
- `/saved` says stays are stored on the account, then “Sign in required.” No fixture cards.
- `/search` rendered “0 stays available across Nigeria” and “No stays match your criteria.” It did not render the seed catalog. This does not prove the configured database is empty. It proves this page did not invent listings.
- `/messages` redirected to `/login?next=/messages`. The source page is still the coming-soon screen. It was not opened while signed in. Messaging was not built.

### APK result

PASS. `flutter build apk --release` in `apps/mobile` exited 0. Gradle `assembleRelease` took about 1254s. `GRADLE_USER_HOME` was `C:\Users\user\.gradle`.

File: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk` (60.4MB).

Release signing in `android/app/build.gradle.kts` is the debug keystore. No production keystore was created. This APK is not a Play upload. It was not installed on a device.
