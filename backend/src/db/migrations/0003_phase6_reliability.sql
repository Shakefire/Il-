-- Phase 6: Idempotent email delivery ledger (Resend). Additive / safe.

CREATE TABLE IF NOT EXISTS email_deliveries (
  id VARCHAR(100) PRIMARY KEY,
  idempotency_key VARCHAR(191) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'booking',
  entity_id VARCHAR(100),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  provider_message_id VARCHAR(191),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_idempotency_uidx
  ON email_deliveries (idempotency_key);

CREATE INDEX IF NOT EXISTS email_deliveries_entity_idx
  ON email_deliveries (entity_type, entity_id);
