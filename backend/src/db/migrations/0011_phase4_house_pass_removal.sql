-- Phase 4: House Pass product removal + shared rate-limit store.
-- No exclusive house_pass tables existed. Private property fields (gate codes,
-- exact address) remain for host operations and are not a guest House Pass product.
-- Do not apply this file to production/shared Neon from automation.
-- Safe target: local PGlite or an explicitly approved disposable database.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key VARCHAR(200) PRIMARY KEY,
  hit_count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

-- Marker for operators: House Pass product removed; residual 410 stubs deleted in Phase 5.
COMMENT ON TABLE rate_limit_buckets IS 'Shared fixed-window rate limits (auth/booking/payment/admin). Webhooks exempt.';
