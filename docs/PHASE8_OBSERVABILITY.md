# Ilé Phase 8 — Observability & Recovery Notes

**Date:** 2026-11-09  
**Scope:** Operational error understandability — no new paid services.

---

## Failed payment handling

| Signal | Where | Recovery |
|---|---|---|
| Paystack init fails | `payments.service` initialize | Booking stays `PAYMENT_PENDING`; guest retries init before `payment_deadline_at` |
| Verify/callback fail | webhook / verify routes | Payment not SUCCESS; booking not confirmed; guest can retry while window open |
| Invalid HMAC | Paystack webhook | Rejected; no state change |

## Late payment reconciliation

| Signal | Behavior |
|---|---|
| Paystack SUCCESS after cancel/expire | Payment recorded; refund `REQUESTED`; booking **not** revived; no host earnings |
| Guest UX | `recovery.reconciliationRequired` / `resolutionPending` — admin resolution pending |
| Admin | Finance refunds queue — approve → process (Paystack refund) |

Audit: `LATE_PAYMENT_RECON_REQUESTED`.

## Uncertain Paystack transfers

| Signal | Behavior |
|---|---|
| Transfer response ambiguous / unknown | Payout stays `PROCESSING` — **no auto-retry** (approved) |
| Explicit transfer fail | Restore to `READY_FOR_PAYOUT` for host retry |
| Success | `PAID` + ledger `HOST_PAYOUT_DISBURSED` (idempotent) |

## Settlement job failures

| Signal | Behavior |
|---|---|
| Missing check-in / hold / open refund | Skipped with reason in job `skipped[]` |
| Imbalanced snapshot (`accommodation ≠ hostNet + commission`) | Skipped (integrity guard) — not released |
| Eligible | One journal + conditional `HELD` → `READY_FOR_PAYOUT` |

## Notification delivery failures

| Signal | Behavior |
|---|---|
| Resend failure | Logged on `email_deliveries`; booking transaction not rolled back |
| Idempotency | Unique `idempotency_key`; retries bounded (`max_attempts`) |

## Admin recovery steps (existing)

1. **Late pay / guest paid cancel:** Refunds tab → REQUESTED → APPROVE → PROCESS (Paystack).
2. **Settlement stuck without check-in:** Ops override with reason ≥ 8 chars (still blocks open refunds).
3. **Withdrawal stuck PROCESSING:** Do not invent auto-retry; inspect Paystack transfer + audit logs; restore only on confirmed fail path.
4. **Audit:** `audit_logs` + booking audit helpers (`GUEST_CHECK_IN_CONFIRMED`, `HOST_WITHDRAWAL_REQUESTED`, refund actions).

## Relevant audit events

- `GUEST_CANCELLED_BEFORE_PAYMENT`
- `LATE_PAYMENT_RECON_REQUESTED` / `REFUND_REQUESTED`
- `ADMIN_APPROVE_REFUND` / `ADMIN_REJECT_REFUND`
- `GUEST_CHECK_IN_CONFIRMED`
- `SETTLEMENT_ADMIN_OVERRIDE`
- `HOST_WITHDRAWAL_REQUESTED`

## Explicit non-goals

- No SMS / push providers  
- No automatic uncertain-transfer retry  
- No new observability SaaS
