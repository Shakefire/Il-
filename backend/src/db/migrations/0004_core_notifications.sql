-- Core platform: device tokens, in-app inbox, multi-channel delivery ledger.
-- Additive / safe. Provider failures never mutate booking/payment rows.

CREATE TABLE IF NOT EXISTS device_tokens (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(30) NOT NULL,
  provider VARCHAR(30) NOT NULL DEFAULT 'fcm',
  app_version VARCHAR(40),
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_uidx ON device_tokens (token);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON device_tokens (user_id);

CREATE TABLE IF NOT EXISTS notification_inbox (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'booking',
  entity_id VARCHAR(100),
  deep_link VARCHAR(500),
  idempotency_key VARCHAR(191) NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_inbox_idempotency_uidx
  ON notification_inbox (idempotency_key);
CREATE INDEX IF NOT EXISTS notification_inbox_user_created_idx
  ON notification_inbox (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id VARCHAR(100) PRIMARY KEY,
  idempotency_key VARCHAR(191) NOT NULL,
  channel VARCHAR(30) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL DEFAULT 'booking',
  entity_id VARCHAR(100),
  user_id VARCHAR(100),
  recipient VARCHAR(500) NOT NULL,
  payload_summary TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  provider_message_id VARCHAR(191),
  last_error TEXT,
  mock_mode BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_deliveries_idempotency_uidx
  ON notification_deliveries (idempotency_key);
CREATE INDEX IF NOT EXISTS notification_deliveries_entity_idx
  ON notification_deliveries (entity_type, entity_id);
