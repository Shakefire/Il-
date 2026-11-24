# Ilé Phase 2 — Finance

Status of this pass: local code and mocked tests only. Not committed, not deployed, not production-ready. Migration `0009` was not applied to any configured database. No live Paystack payment, transfer, or refund was sent.

The earlier write-up in this folder was re-checked against the code. Rules that already held were left in place. Gaps that were still open were implemented and tested on an embedded PGlite database (`DATABASE_URL` forced empty, email forced to the console provider).

## Verdict

| Rule | Verdict |
|---|---|
| Guest price is `round(hostBase × (1 + rate))` once, commission is the difference, host entitlement is the host base | PASS in `resolveStayPricing` and booking creation. A later settings change does not rewrite the booking row. |
| Commission percent and amount hidden from guests and the normal host earnings screen | PASS in source. Guest estimate copy omits commission. Host wallet history strips `hostCommissionAmount`. Admin finance still shows it. |
| No second 45/10/45 or 50/40/10 cut | PASS. `hostPayoutPct` is stored and is not applied to host net. |
| Settlement timing unchanged | PASS, documented below. Not a new clock. |
| Host wallet totals | PASS in source for web and Flutter: total, held, available, in progress, successful, failed count, history, partial amount. Available is the sum of that host's `READY_FOR_PAYOUT` rows, which is what withdrawal locks. It is not a forecast and it is not the pooled ledger account 2020. |
| Admin-only refunds from account 1040 | PASS. Guest, host, and approve/reject calls without an admin role are rejected in the service, not only in the page. Short 1040 balance blocks and returns the shortfall. Host payable is not debited. Cancelled and expired bookings are refused. Success is `SUCCESSFUL` only after a verified mock provider result. |
| Admin refund screen | PASS in source, UNVERIFIED in a browser. The modal loads `GET /api/admin/finance/refunds/preview` and shows the verified payment, prior refunds, remaining refundable amount, commission balance, amount, reason, and confirm. Insufficient commission or an amount above refundable disables confirm and shows a block. |
| One double-entry ledger | PASS. Same journals. Accounts 1040, 1050, and 5030. Entries are insert-only. Webhook event id is unique. |
| Partial withdrawals | PASS. The requested slice moves to `PROCESSING`. The remainder stays `READY_FOR_PAYOUT`. A verified mock failure restores `READY_FOR_PAYOUT`. Over available is rejected. Another host's payout id cannot be reserved. |
| Caution fee | PASS for active pricing and customer copy that was searched. `cautionFeeNgn` defaults to 0. The mobile property screen does not advertise a refundable caution fee. Legacy columns stay unused. |
| Flutter banks | PASS in source, NOT RUN as an app. Host bank and onboarding load `/api/banks`, search, account number, and resolve. Banks are not hardcoded. |
| Flutter wallet | PASS in source, NOT RUN. |
| Admin finance dashboard | PASS in source for position, commission 1040, host liabilities, payout states, refund queue, failed transfer fields, reconciliation discrepancies, ledger, and commission settings. UNVERIFIED in a browser. |
| Commission settings audit | PASS. The settings log stores actor, previous percent, new percent, timestamp, and `appliesToNewBookingsOnly`. |
| Exports | PASS in source. Collection CSV headers say gross collected, not platform revenue. |
| Security | PASS for the paths reviewed: admin role on refund execute/approve/reject, host id on withdrawal, webhook HMAC, server-side price, masked host payout account numbers. Full account numbers are still stored for payout execution. They are not written into the withdrawal audit payload. |

## What this pass changed

- Admin refund preview: `getAdminRefundPreview` and `GET /api/admin/finance/refunds/preview`.
- Approve and reject now require an admin user in the service.
- Commission setting audit stores the previous rate, the actor, and the time.
- Reconciliation returns `discrepancies` when successful refund rows do not match account 5030, or when the trial balance does not balance. The admin reconciliation tab lists them.
- Host payout history returned to the host masks the account number.
- Collection CSV columns are labelled gross collected.
- Tests cover the cases that the six-case file did not isolate. The older ledger file was re-run. Its disbursement fixture now supplies a bank account so the existing bank check can succeed. The check itself was not removed.

## Settlement

Existing release rules were kept.

- Manual: host entitlement stays `HELD` until guest check-in and the configured hold, then `READY_FOR_PAYOUT`.
- Automatic: after a verified guest payment, host entitlement can be released without a new check-in gate. That behaviour already existed.
- The amount released is the snapshotted host base.

## Refund funding

1. Reserve: debit 1050, credit 1040.
2. Verified provider success: debit 5030, credit 1050, status `SUCCESSFUL`.
3. Verified provider failure or reversal: debit 1040, credit 1050, status `FAILED` or `REVERSED`.
4. Unverified provider result: status `RECONCILIATION_REQUIRED`. The reservation stays. The row is not `SUCCESSFUL`.

Host payable 2020 is not in those journals. A guest cancel of a paid stay still files `REQUESTED` and does not execute a refund. Booking status is not changed by refund execution.

## Caution fee and retained fields

Active calculators do not add ₦50,000. Retained and unused by the price:

- `thingsToKnow.cautionFeeNgn` (default 0, still readable on old JSON)
- `properties.cleaningFee` / `bookings.cleaning_fee` (booking create writes 0)
- `bookings.service_fee` stores the existing Paystack pass-through, not a cleaning or caution fee
- `docs/audits/README.md` still describes the old mobile advertisement. That file is a historical audit.

## Migrations

`backend/src/db/migrations/0009_phase2_commission_account.sql` was not applied. Seed and `ensurePhase2Accounts` insert 1040, 1050, and 5030 on the local embedded database only.

## Tests

All of these used mocked Paystack and the console email provider. Working directory: `C:\Users\user\Desktop\NEXT_HOME`.

| Command | Exit | Result |
|---|---|---|
| `npx tsx --import ./tests/force-local-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase2-finance-rules.test.ts` | 0 | 6 pass, 0 fail |
| `npx tsx --import ./tests/force-local-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase2-finance-gaps.test.ts` | 0 | 10 pass, 0 fail |
| `npx tsx --import ./tests/force-local-db.mjs --test --test-concurrency=1 --test-force-exit tests/phase2-ledger-and-reconciliation.test.ts` | 0 | 9 pass, 0 fail. Case 6 (commission-funded refund, host payable unchanged) passed. |
| `npx tsc --noEmit --pretty false --skipLibCheck` | 0 | pass |

Gap cases that passed: odd commission rounding, snapshot audit of old/new rate, guest price, host entitlement, full refund, refund above refundable, refund without a verified payment, expired booking, guest and host approval rejected, authorized admin on the mock provider, failed refund, reversed refund, unreconciled refund, concurrent refunds, failed withdrawal restored, concurrent withdrawals, cross-user withdrawal, duplicate charge/transfer/refund webhooks, reversed transfer once, reconciliation mismatch, caution fee absent from the pricing source.

## Still blocked or not run

- Apply migration `0009` on a configured database. Not done.
- Flutter was not launched.
- The admin refund modal and finance dashboard were not clicked in a browser.
- This is not a production sign-off. Live Paystack refunds and transfers were not exercised.
