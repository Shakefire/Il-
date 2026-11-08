-- Phase 3: Host-confirm-before-pay reservation lifecycle (additive, safe backfill)

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_payout_pct INT DEFAULT 100;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response_deadline_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_responded_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_response VARCHAR(30);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ;

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS default_host_payout_pct INT NOT NULL DEFAULT 100;

-- Backfill active PAYMENT_PENDING holds with a payment deadline from created_at + 10m
-- Do NOT extend already-stale unpaid bookings (deadline already in the past → expire job handles them)
UPDATE bookings
SET payment_deadline_at = created_at + INTERVAL '10 minutes',
    host_payout_pct = COALESCE(host_payout_pct, 100)
WHERE status = 'PAYMENT_PENDING'
  AND payment_deadline_at IS NULL;

-- Snapshot payout % on historical confirmed/completed rows without inventing new money math
UPDATE bookings
SET host_payout_pct = COALESCE(host_payout_pct, 100)
WHERE host_payout_pct IS NULL;

INSERT INTO platform_settings (id, default_host_commission_pct, default_host_payout_pct, payout_hold_hours, updated_at)
VALUES ('default', 10, 100, 24, NOW())
ON CONFLICT (id) DO UPDATE
SET default_host_payout_pct = COALESCE(platform_settings.default_host_payout_pct, 100);
