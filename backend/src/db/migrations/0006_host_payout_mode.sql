-- Host payout AUTOMATIC | MANUAL configuration + per-payout mode stamp / exceptions.
-- Additive / safe. DO NOT apply to production without explicit PO approval.
-- Default MANUAL preserves existing check-in settlement gates for new payouts until admin opts in.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS host_payout_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS payout_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS exception_code VARCHAR(60);

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS exception_reason TEXT;

-- Backfill stamp for historical rows (informational only — does not change status/transfer).
UPDATE payouts
SET payout_mode = COALESCE(payout_mode, 'MANUAL')
WHERE payout_mode IS NULL OR payout_mode = '';

UPDATE platform_settings
SET host_payout_mode = COALESCE(host_payout_mode, 'MANUAL')
WHERE id = 'default';
