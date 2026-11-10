# Ilé Phase 3 — Ledger audit & host wallet recommendation

**Status:** Audit / architecture only. No ledger rewrite. No wallet implementation.  
**Audience:** Product owner (plain English).

---

## 1. What the money systaem is today

Think of three layers that all talk about the same booking money:

1. **Booking snapshot** (`bookings` columns) — the frozen price: guest total, Paystack fee, commission, host net, payout %.
2. **Operational queues** — `host_earnings` (what the host is owed) and `payouts` (when/how we send it) and `refunds` (guest money back).
3. **Double-entry ledger** — journal “stories” that debit and credit named accounts so every naira is explained twice.

Authoritative for guest charge and host entitlement at booking time: **booking snapshot**.  
Authoritative for “has money been paid / refunded / transferred”: **payments + payouts + refunds**.  
Authoritative for accounting reconciliation: **ledger journals**.

---

## 2. Ledger accounts (chart of accounts)

| Code | Name | Plain meaning |
|---|---|---|
| 1010 | Paystack Clearing | Money that just arrived from Paystack (holding tray) |
| 1020 | Operating Bank | Ilé’s real bank / operating cash |
| 2010 | Advance Guest Deposits | “We still owe the guest a stay” (escrow liability) |
| 2020 | Host Settlement Payable | “We owe the host this payout” |
| 2030 | Paystack Fee Escrow | Guest-paid processing fee sitting aside |
| 4010 | Platform Commission Revenue | Ilé’s cut (recognized at settlement) |
| 5010 | Payment Processing Expense | Paystack fee recognized as expense |
| 5020 | Payout Transfer Fee | Bank transfer fee when paying hosts |

---

## 3. Example: guest pays ₦100,000 (simplified)

Assume accommodation ₦98,000 + Paystack fee ₦2,000 = **₦100,000** guest total.  
Classic host earnings ₦90,000; host payout % = 100% → host net ₦90,000; platform keeps ₦8,000 of accommodation.

### When Paystack says “success”

1. `payments` → SUCCESS; booking → CONFIRMED.
2. `host_earnings` created (PENDING) for ₦90,000.
3. Ledger journal **BOOKING_PAYMENT_RECEIVED**:
   - Debit 1010 Paystack Clearing **₦100,000**
   - Credit 2010 Guest Deposits **₦98,000**
   - Credit 2030 Fee Escrow **₦2,000**
4. `payouts` row created **HELD** for ₦90,000 (not withdrawable yet).

### At check-in settlement (existing calendar job)

Journal **CHECKIN_RECOGNITION**:

- Debit 2010 Guest Deposits ₦98,000  
- Credit 2020 Host Payable ₦90,000  
- Credit 4010 Commission ₦8,000

Payout moves HELD → READY_FOR_PAYOUT; earnings → READY.

### When admin disburses Paystack transfer

Journal **HOST_PAYOUT_DISBURSED** (and fee expense if any):

- Debit 2020 Host Payable ₦90,000  
- Credit 1020 Operating Bank ₦90,000 (simplified)

Payout → PAID; transfer codes stored for reconciliation.

---

## 4. Example: refund after pay

Policy (Phase 3): refund **paid amount minus recorded non-refundable Paystack fee**.  
If fee unknown → do not guess; mark reconciliation.

Existing `FinanceService.processRefund`:

- Creates/processes `refunds` row.  
- Ledger **BOOKING_REFUND_CONFIRMED** reverses guest liability / clearing appropriately.  
- Cancels related `host_earnings` and `payouts` so host cannot be paid on refunded stay.  
- Releases availability.

---

## 5. Problems with the current design (plain English)

1. **Three places say “host is owed money”** — booking snapshot, host_earnings, payouts, plus ledger 2020. Easy to confuse which to trust for a wallet UI.
2. **Guest deposit (2010) vs host payable (2020)** is correct accounting but hard for non-accountants.
3. **Settlement still calendar-based** — check-in confirm is not the gate yet (deferred past Phase 3).
4. **Fee escrow (2030) vs expense (5010)** timing can confuse “where did the ₦2,000 fee go?”
5. **Late payments** now correctly flag `refunds.status=REQUESTED` instead of silent confirm — good — but admin must act.
6. Naming drift: payment status `SUCCESS` in code vs `VERIFIED` in constants.

---

## 6. What to keep

- Double-entry journals with zero-sum validation.  
- Idempotent journal keys `(reference, event_type)`.  
- Payout `FOR UPDATE` on disburse.  
- Booking financial snapshots (never rewrite history when admin changes %).  
- Separate `refunds` queue for admin visibility.

---

## 7. Simplified design recommendation (for later approval — do not implement now)

Keep one ledger, but present a **product view**:

| Product concept | Backed by |
|---|---|
| Guest paid | `payments.status=SUCCESS` |
| Host pending | `payouts.status in (HELD)` |
| Host available | `payouts.status=READY_FOR_PAYOUT` |
| Host paid out | `payouts.status=PAID` |
| Needs refund | `refunds.status=REQUESTED` |

Optional later: reduce day-to-day reliance on reading raw ledger by building reports from queues, while ledger remains the audit trail.

Do **not** replace double-entry with a single “balance” column as the only source of truth.

---

## 8. Host wallet — architecture recommendation (no implementation)

### Intended product flow

Guest pays Paystack → booking confirmed → earnings held → become available → host withdraws → Paystack transfer → reconcile → balance down.

### Can existing tables support balances?

**Yes, as a projection:**

```
available = SUM(payouts.amount where host_id=X and status='READY_FOR_PAYOUT')
pending   = SUM(payouts.amount where host_id=X and status='HELD')
paid      = SUM(payouts.amount where host_id=X and status='PAID')
in_flight = SUM(payouts.amount where host_id=X and status='PROCESSING')
```

Refunded/cancelled payouts excluded via status `CANCELLED`.

### New table needed?

| Option | Verdict |
|---|---|
| **A. No new balance table** — wallet = sum of payout rows | **Recommended start** |
| B. `host_wallet_accounts` + `wallet_ledger_entries` | Only if you need cash-outs not tied 1:1 to bookings (tips, adjustments, advances) |
| C. Cached `hosts.available_balance` column | Risky unless updated in same DB transaction as payout status changes |

**Recommendation:** Option A first. Add Option B only when non-booking money appears.

### Paystack transfer reconciliation

Already partially present: `paystackTransferRef`, `transferStatus`, webhook handlers for transfer success/fail.  
On fail: return payout to READY_FOR_PAYOUT (existing pattern) so funds remain withdrawable.

### Concurrent withdraw prevention

Reuse payout disburse pattern: `SELECT … FOR UPDATE` on candidate payout rows (or a single withdraw request row) before initiating transfer.  
One open `PROCESSING` withdraw per host (or per payout) prevents double-spend.

### What Phase 3 did NOT implement

Host withdraw API, wallet UI, balance cache table, SMS/push for wallet events.

---

## 9. PO approvals still useful before financial phases

1. Auto-refund late Paystack successes vs admin-only REQUESTED (Phase 3 uses admin-visible REQUESTED).
2. Whether wallet available = READY_FOR_PAYOUT only, or also include some HELD after check-in.
3. Settlement gate: guest check-in required vs calendar-only (Phase 2 open item; deferred).
4. Whether Option B wallet ledger is needed in Phase 5+.
