# Ilé Phase 7 — Financial Audit (mandatory, before coding)

**Date:** 2026-11-08  
**Scope:** Read-only inspection of earnings, payouts, refunds, ledger, transfers, bank verification, settlement.  
**PO rules in force:** admin-only refunds; guest check-in required for withdrawable earnings; wallet = payout projection; preserve ledger; no unsafe transfer retries.

---

## 1. States (verified in schema/code)

### `host_earnings.status`
`PENDING` (created at payment success) → `READY` (after check-in recognition) → `PAID` (after disbursement) | `CANCELLED` (refund).

### `payouts.status`
Documented: `HELD` | `READY_FOR_PAYOUT` | `PROCESSING` | `PAID` | `CANCELLED`.  
**Drift:** webhook `transfer.failed` writes `FAILED`; `transfer.reversed` writes `REVERSED` — not in the documented enum. Fail path should restore `READY_FOR_PAYOUT` for wallet availability (Phase 3 recommendation).

### `payouts.transfer_status`
`UNINITIATED` | `PENDING` | `SUCCESS` | `FAILED` | `REVERSED`.

### `refunds.status`
`REQUESTED` | `APPROVED` | `REJECTED` | `PROCESSED`.

### Booking check-in fields
**None today.** Only `checkInDate` / `checkOutDate` calendar strings. No guest confirmation timestamp/actor.

---

## 2. Money flow (actual)

1. **Pay success** → payment `SUCCESS`, booking `CONFIRMED`, `host_earnings` PENDING, payout `HELD` + `scheduledFor = checkIn + payoutHoldHours` (default 24h), ledger `BOOKING_PAYMENT_RECEIVED`.
2. **Settlement today** → `FinanceService.processDueSettlements()`: CONFIRMED + HELD + `checkInDate <= today` → ledger `CHECKIN_RECOGNITION`, payout → `READY_FOR_PAYOUT`, earnings → `READY`. **No guest check-in gate.**
3. **Disburse** → admin `disbursePayout` (FOR UPDATE): Paystack transfer or manual ref → `PROCESSING` (pending) or ledger `HOST_PAYOUT_DISBURSED` + `PAID`. Host self-withdraw **does not exist**.
4. **Refund** → admin-only `processRefund` → ledger refund journal, cancel payouts/earnings, cancel booking. Guests cannot execute refunds.

---

## 3. Wallet recommendation (reconfirmed)

| UI label | Source |
|---|---|
| Pending | `SUM(payouts.amount)` where `status=HELD` |
| Available | `status=READY_FOR_PAYOUT` |
| Processing | `status=PROCESSING` |
| Paid | `status=PAID` |

**No new wallet balance table.** Cancelled/refunded excluded via status. Option A from Phase 3 stands; audit does **not** prove need for a separate balance table.

---

## 4. Eligibility gaps (to close in Phase 7)

| Gap | Risk |
|---|---|
| Settlement on calendar alone | Host can withdraw without guest check-in confirm |
| No check-in confirm API/UI | Cannot enforce PO rule |
| `scheduledFor` not checked in `processDueSettlements` | Hold hours may be ignored at release |
| Active refunds not blocked at settlement | Could release then refund race |
| Host withdraw missing | Only admin can move READY → paid |
| `transfer.failed` → `FAILED` status | Funds leave Available without restore to READY |
| Transfer fee (5020) unused | Fee policy undefined — do not invent flat fee |

---

## 5. Existing controls to reuse

- Ledger idempotency: unique `(reference, event_type)`.
- Admin disburse: `SELECT … FOR UPDATE` on payout row.
- Bank: `profiles.bankAccountVerifiedAt` + Paystack NUBAN via `BankResolutionService`; recipient codes on profile/payout.
- Transfer webhooks: success posts ledger if missing; failed/reversed handlers exist (needs restore semantics).
- Admin finance UI already has payouts/refunds/settlements/ledger/recon tabs — extend, don’t remove.

---

## 6. Schema change justified for Phase 7

Add booking columns only (no new wallet/ledger tables):

- `guest_check_in_confirmed_at`
- `guest_check_in_confirmed_by`
- `settlement_override_reason` / `settlement_override_by` / `settlement_override_at` (admin exception path)

Preserve all ledger accounts and historical journals.

---

## 7. Fee policy (unresolved — no unilateral decision)

- Guest Paystack fee: recorded on booking; non-refundable on refund (existing).
- Host payout transfer fee (`5020`): **account exists; no deduction in transfer code.**
- **Phase 7 policy:** do not invent a flat host withdrawal fee; transfer full net payout amount; document fee policy as **unresolved for PO**.

---

## 8. Implementation order (after this audit)

1. Check-in confirm + fields  
2. Settlement eligibility (check-in + calendar + hold + no refund) + admin override  
3. Host wallet projection API + web/Flutter UI  
4. Host withdrawal (atomic reserve → PROCESSING → Paystack → PAID/restore)  
5. Fix failed-transfer restore; admin dashboard plain-language filters  
6. Tests + Phase 7 report — **STOP (no Phase 8)**
