-- Phone OTP rate-limit columns + notification preferences.
-- Additive / safe. Critical security prefs enforced in application layer.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verification_attempts INT NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verification_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(60) NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  inbox_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_category_uidx
  ON notification_preferences (user_id, category);
