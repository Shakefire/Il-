# ILÉ Phase 2 — Finance system

This file is the earlier audit. The current verdict, including later fixes and the local test results, is `docs/implementation/phase-2-finance/README.md`. Do not treat the sections below as the latest pass.

Date: 2026-11-23. Workspace: `C:\Users\user\Desktop\NEXT_HOME`. No commit, no deploy, no live Paystack payment, transfer, or refund.

## 1. Audit (verified on the current tree)

Previous finance write-ups were not trusted. These defects were still in the code at the start of this phase:

1. **Partial withdrawals.** `requestHostWithdrawal` skipped a `READY_FOR_PAYOUT` row unless the row amount fit entirely inside the remaining request, then failed with no partial split. A withdrawal that was not equal to one payout row could not be reserved.
2. **Second host cut.** Guest price already included commission (`guest = host base × (1 + rate)`). `hostPayoutPct` (the old 59% style setting) was applied again to that host base. The 45/10/45 and 50/40/10 schedules were not in the code.
3. **Wallet vs ledger.** `getHostWallet` summed payout-row statuses. It was not a per-host ledger balance. Refunds could cancel payout rows without reversing account 2020 after check-in recognition.
4. **Mixed reports.** Admin “platform revenue” was derived from gross booking volume × commission percent. CSV export divided stored naira by 100. Amounts in this database are naira; kobo conversion happens only at the Paystack boundary.
5. **Auto vs manual.** Both modes exist and are intentional. `AUTOMATIC` releases host payable without guest check-in and may start a transfer. `MANUAL` keeps the payout `HELD` until check-in settlement. This phase did not merge or remove either mode.
6. **Check-in vs settlement.** Manual release still requires a settleable booking, guest check-in (unless an admin override), the check-in date, the hold (`scheduledFor` / `payoutHoldHours`), a `HELD` payout, and no open refund. That timing was left in place.
7. **Refunds did not reconcile to a commission cash account.** The old poster debited guest advance 2010 and cancelled host payouts. Success could be inferred from the request or a webhook. There was no reconcilable commission-cash account that refunds had to clear first.

Phase 1 booking states, Paystack verify, webhook signature checks, inventory, and notification routing were not reverted.

## 2. Plan

- One guest accommodation price, commission inside it, snapshotted on the booking.
- Host entitlement equals host base (100% of that base). Stop applying `hostPayoutPct` as a second cut. Keep the column as a snapshot.
- Add accounts 1040, 1050, and 5030 inside the existing ledger. Fund admin refunds only from 1040. Block when 1040 cannot cover the amount.
- Do not change settlement timing. Allocate commission cash into 1040 at the existing earnings-release moment.
- Split oversized payout rows so a partial withdrawal can reserve part of a row, lock that part, and restore it if transfer initiation fails.
- Remove the advertised ₦50,000 caution fee from active display and defaults. Do not add a replacement fee.
- Prove the controls with mocked Paystack and the existing node:test runner.

## 3. What changed

- `backend/src/modules/pricing/pricing.service.ts` — `resolveStayPricing`. Host base wins when `hostBasePrice` is set. Guest subtotal is rounded once. Commission is the difference. No cleaning or caution line.
- `backend/src/modules/bookings/bookings.service.ts` — new bookings use that snapshot. `hostNetAmount` is host base, not host base × payout percent.
- `backend/src/modules/finance/ledger.service.ts` — accounts 1040 / 1050 / 5030, commission cash allocation at release, host earnings marked paid only when paid payouts cover host net, legacy guest-deposit refund posting disabled unless an explicit flag is passed. Nothing passes that flag.
- `backend/src/modules/finance/admin-refund.service.ts` — admin-only execution, row locks, refundable cap, commission reservation, verified mock/live outcome, host-payable guard.
- `backend/src/modules/finance/paystack-refund.service.ts` — Paystack refund HTTP behind the mock. Success requires a verified processed/success result.
- `backend/src/modules/finance/finance.service.ts` — refund entry points delegate to the admin refund service. Withdrawal splits a larger ready row. Wallet totals omit commission. Open-refund settlement block includes in-flight refund statuses.
- `backend/src/modules/payments/payments.service.ts` — earnings use the snapshot when it balances. Transfer reversal of a paid payout credits 2020 once and returns the row to available. Refund webhooks do not mark success or change booking status by themselves.
- Admin finance summary and CSV routes report commission revenue and account 1040 separately from gross booking volume. Naira is not divided by 100.
- Host web earnings column is “Your earnings” only. Guest and host emails no longer print a commission line.
- Flutter property detail no longer shows a caution fee. Host bank screen searches the provider bank list. Host wallet shows total earnings and failed/reversed withdrawals.
- `scripts/reconcile_ledger.ts` no longer auto-refunds cancelled bookings.

## 4. Migrations

`backend/src/db/migrations/0009_phase2_commission_account.sql` inserts:

| Code | Name | Type |
| --- | --- | --- |
| 1040 | Platform Commission Funds | ASSET |
| 1050 | Commission Funds Reserved | ASSET |
| 5030 | Guest Refunds From Commission | EXPENSE |

`ON CONFLICT (id) DO NOTHING`. The same rows are inserted at runtime by `ensurePhase2Accounts` and by seed. No new booking or payout columns. `cautionFeeNgn` stays on the things-to-know JSON and defaults to 0. `cleaning_fee` remains a historical column and is not added in `resolveStayPricing`.

The SQL file is not applied by an automatic migrator in this pass. The first summary, refund, or check-in recognition calls `ensurePhase2Accounts`.

## 5. APIs

- `POST /api/admin/finance/refunds` and `POST /api/admin/finance/refunds/:id/process` (Next and Fastify). Role check on the route and again inside the transaction (`users.role === admin`). Errors use `financeControlHttp`: `code`, `shortfall`, `commissionAvailable`, `refundable`.
- Guests can still open a support/refund **request** (paid cancel stays `REQUESTED`). They cannot execute Paystack.
- Hosts: `GET` wallet and `POST` wallet withdraw. Withdraw accepts a partial naira amount, reserves it, and rejects amounts above available.
- Commission settings remain admin-only, 0–50%, audited, and apply to new bookings only.
- Report types include ledger and commission income. Gross booking volume is not labeled platform revenue.
- Banks stay on the existing backend list and account-resolve endpoints. Flutter does not hardcode the bank catalog.

## 6. Accounting model

Existing chart kept: 1010 Paystack clearing, 1020 operating bank, 2010 guest advances, 2020 host payable, 2030 Paystack fee escrow, 4010 commission revenue, 5010 processing expense, 5020 payout transfer fee.

New rows in that same ledger:

- Payment received: DR 1010, CR 2010 (accommodation), CR 2030 (Paystack fee when non-zero).
- Earnings release (existing check-in recognition, or the existing automatic release): DR 2010, CR 2020 host net, CR 4010 commission. Then, same moment, DR 1040, CR 1010 for the commission amount (`COMMISSION_ALLOCATION`).
- Admin refund reserve: DR 1050, CR 1040 (`ADMIN_REFUND_RESERVED`).
- Verified success: DR 5030, CR 1050 (`ADMIN_REFUND_SETTLED`).
- Verified failure or reversal before settle: DR 1040, CR 1050 (`ADMIN_REFUND_RESERVATION_RELEASED`).
- Host withdrawal success still uses the existing host payout journal (DR 2020). Transfer fees stay at the existing ₦0 host deduction. 5020 is unused.
- Journals stay unique on `(reference, event_type)`. Corrections are new journals, not deletes.

## 7. Refund design

Only an admin user can execute. Amount is a positive integer naira, at most verified successful NGN payments minus refunds in `SUCCESSFUL`, `PROCESSED`, `PENDING`, or `RECONCILIATION_REQUIRED`. `CANCELLED` and `EXPIRED` bookings are rejected. Booking status is not changed. Availability blocks are not deleted. Host payouts and host earnings are not cancelled.

Flow: lock booking and account 1040, reject if 1040 is short, compare host payable before and after the reservation (abort if it moved), insert or update the refund as `PENDING`, call Paystack (mock in tests), then settle, release, or leave `RECONCILIATION_REQUIRED`. The same idempotency key or the same mock provider reference returns the existing row and does not call the provider again. `PENDING` / `RECONCILIATION_REQUIRED` is not resent.

Statuses used: `PENDING`, `SUCCESSFUL`, `FAILED`, `REVERSED`, `REJECTED`, `RECONCILIATION_REQUIRED`, plus legacy `PROCESSED` as consuming.

## 8. Evidence refunds come only from the commissions account

`executeAdminRefund` posts the reservation as credit 1040 / debit 1050 and the settlement as debit 5030 / credit 1050. `recordBookingRefund` throws unless `allowLegacyGuestDepositFunding` is set, and no caller sets it. Tests assert the refund journals include 1040 and 5030 and do not include 2020 (`tests/phase2-finance-redesign.test.ts`).

## 9. Evidence insufficient funds block

Before any reservation, available 1040 (debits minus credits, row-locked) is compared with the requested amount. If it is short, the service throws `INSUFFICIENT_COMMISSION` with `shortfall`, `commissionAvailable`, and `refundable`. The message states that no other account was used. Both the redesign test and `tests/phase2-finance-rules.test.ts` reject that code. Phase 9 expects the same block before it posts a test funding journal.

## 10. Evidence host wallets are not debited for refunds

The reservation transaction reads account 2020 before and after and aborts with `HOST_PAYABLE_TOUCHED` if the net changed. Payout rows are not moved to `CANCELLED`. Host earnings stay `PENDING` (phase 1 test 4). The redesign test keeps the host payout `HELD` at the original amount and asserts 2020’s trial-balance net is unchanged. The rules test asserts `hostPayableBalance()` is unchanged across the shortfall and the successful partial refund.

## 11. Caution fee

Active default `defaultThingsToKnow().cautionFeeNgn` is 0. Flutter’s model default and JSON fallback are 0. The property detail screen no longer shows “Refundable Security Caution Fee” or a caution amount. Pricing does not add it. The field remains on the contract so old JSON can still be read. It is not an input to booking or payment math. `docs/audits/README.md` still describes the old advertisement; that file is a historical audit, not the calculator.

## 12. Tests

Mock gates: `NODE_ENV=test` and `PAYSTACK_MOCK_TRANSFERS=true`. Refund and transfer results come from `PAYSTACK_REFUND_MOCK_RESULT` and `PAYSTACK_TRANSFER_MOCK_RESULT`. No test called `api.paystack.co` for a refund or transfer. The rules file did post one locally signed `transfer.failed` webhook into the local handler, using the configured secret only as an HMAC key. That is not a live transfer.

Working directory for every command: `C:\Users\user\Desktop\NEXT_HOME`.

| Command | Exit | Counts |
| --- | --- | --- |
| `npx tsx --test tests/phase2-finance-redesign.test.ts` | 0 | 6 pass, 0 fail |
| `npx tsx --test tests/phase1-financial-engine.test.ts tests/phase3-reservation-lifecycle.test.ts tests/phase9-cancellation-refund.test.ts` | 1 | 20 pass, 2 fail. Both failures were phase 1 earnings `READY` vs `PENDING` while platform payout mode was `AUTOMATIC`. Phase 3 and phase 9 suites passed, including the 59% snapshot (host net stays host base) and the phase 9 commission-funded refund. |
| `npx tsx --test tests/phase1-financial-engine.test.ts` after pinning those two cases to `MANUAL` and restoring the previous mode | 0 | 5 pass, 0 fail |
| `npx tsx --test tests/phase2-finance-rules.test.ts` | 0 | 6 pass, 0 fail |

| Case | Result |
| --- | --- |
| Commission rounding, single markup | PASS |
| Historical commission snapshot | PASS |
| Guest price includes commission; no guest commission line in host history | PASS (API). Browser guest checkout not re-opened this pass: UNVERIFIED |
| Host entitlement = host base, not × payout % | PASS (phase 3 test 11 and booking snapshot tests) |
| Ledger stays balanced | PASS |
| Duplicate payment/transfer webhook | PASS for one replayed `transfer.failed` webhook (rules test). Duplicate refund webhook: NOT RUN |
| Full and partial admin refund, mocked Paystack | PASS |
| Over refundable | PASS |
| Refund without a verified payment | PASS |
| Guest and host execution rejected | PASS |
| Unauthorized / non-admin rejected | PASS |
| Authorized admin path | PASS |
| Insufficient 1040 blocks, shortfall returned | PASS |
| Host wallet / 2020 / payout not debited | PASS |
| Concurrent refunds on one booking | NOT RUN (same-key replay is PASS) |
| Concurrent withdrawals | PASS (one of two ₦7,000 requests reserved; outstanding stayed ₦10,000) |
| Partial withdrawal | PASS (₦10,000 row split to ₦4,000 processing + ₦6,000 ready) |
| Over-balance withdrawal | PASS |
| Failed transfer restores the reserved amount | PASS |
| Reversed transfer webhook | NOT RUN this pass |
| Failed refund releases 1040 and does not touch the payout | PASS |
| Reversed refund | NOT RUN (`PAYSTACK_REFUND_MOCK_RESULT=reversed` is implemented, not executed here) |
| Reconciliation-required (timeout / unknown) | NOT RUN |
| Commission config change does not rewrite the old booking | PASS |
| Caution fee absent from active calc | PASS |
| Cross-user withdrawal isolation | PASS |

## 13. Build / typecheck

`npx tsc --noEmit --pretty false` from `C:\Users\user\Desktop\NEXT_HOME`.

- First run, exit 2: phase 1 `hostPayoutMode` string was not narrowed to `"MANUAL" | "AUTOMATIC"`, and an older rules assertion read `amount` on the withdrawal result.
- After those type fixes, second run exit 0. No `error TS` lines.

`next build` was not run. The dev server and port 8080 were not killed.

## 14. Known limits

- Host wallet totals are still the sum of that host’s payout rows (available, processing, paid, failed). There is no `host_id` on ledger lines, so the UI is not a filtered slice of account 2020. A global tie-out of ready+processing payouts against 2020 is not on the admin dashboard. Historical cancelled payouts can still disagree with 2020.
- Flutter’s withdraw button still submits the full available balance. The API accepts a smaller amount and the tests cover that.
- `refund.failed` webhooks mark a `PENDING` refund `RECONCILIATION_REQUIRED` and do not release 1050. An admin must reconcile that reservation. There is no new one-click release tool.
- Idempotency is the admin note plus the mock provider reference, not a unique column. Keys must not contain SQL wildcard characters. Generated keys do not.
- Commission cash is not available at payment time. It is allocated when earnings are released. A refund before that release succeeds only if 1040 already holds enough cash from other released bookings. Otherwise execution blocks. That is the timing decision below, not a silent draw from 2010, 2020, or 1020.
- Admin and host screens were not clicked in a browser this pass. Flutter was not run on a device.
- Tests wrote rows into the configured Neon database (`ep-winter-bonus-b46e0tna-pooler.c-6.us-east-2.aws.neon.tech`), the same `DATABASE_URL` the existing suite uses. They inserted test users, bookings, payouts, and commission-funding journals (`TEST_COMMISSION_FUNDING` / test `COMMISSION_ALLOCATION`). Those journals are test artifacts. They are not live Paystack credits and they were not reversed.

## 15. Owner decisions

1. **Settlement timing was not changed.** Manual host entitlement still becomes wallet-available only inside the existing check-in recognition (guest check-in, date, hold, no open refund, unless the existing admin override). Automatic mode still releases without guest check-in. Commission cash moves into 1040 at that same release, not when the guest pays. Question for the owner: should a pre-check-in refund be allowed to use commission that is not yet allocated, or is “block until 1040 can pay” the rule you want to keep?
2. **`hostPayoutPct` no longer reduces new host entitlement.** The setting and the booking column are still snapshotted. Host net equals host base. A later change to the percent does not rewrite old `hostNetAmount`.
3. **When `hostBasePrice` and `pricePerNight` disagree, host base wins** and the guest subtotal is recomputed. If host base is missing, `pricePerNight` stays the guest nightly price (phase 1 fixtures unchanged).
4. **A successful refund does not cancel the stay, free dates, or cancel host payouts.** Booking status stays as it was. A separate lifecycle action is required to cancel.
5. **Legacy guest-deposit refund posting and the reconcile script’s auto-refund are disabled** so they cannot debit 2010 or cancel host payouts.
6. **Stored money is naira.** CSV export no longer divides by 100.
7. **A reversed paid transfer** returns that payout to `READY_FOR_PAYOUT` and credits 2020 once, so the wallet can show the funds again. A reversal of a payout that was not yet paid does not post a second credit.
8. **Host withdrawal transfer fees stay at the existing ₦0 deduction.** Account 5020 was not given a new policy.
9. **`cautionFeeNgn` is retained at 0** for old payloads. It is not collected and not replaced with another fee.
