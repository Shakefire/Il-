-- Phase 3: platform tables (support, favourites, review moderation).
-- House Pass product was later removed in 0011; this file never created pass tables.
-- Financial and review history must not disappear when a user or listing is removed.
-- Do not apply this file to a configured or production database from automation.
-- An operator applies it deliberately. Statements are guarded and do not delete rows.

CREATE TABLE IF NOT EXISTS review_moderation (
  review_id VARCHAR(100) PRIMARY KEY REFERENCES reviews(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE',
  reason TEXT,
  moderated_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_cases (
  id VARCHAR(100) PRIMARY KEY,
  requester_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  booking_id VARCHAR(100) REFERENCES bookings(id) ON DELETE RESTRICT,
  property_id VARCHAR(100) REFERENCES properties(id) ON DELETE RESTRICT,
  category VARCHAR(40) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  admin_response TEXT,
  admin_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favourites (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id VARCHAR(100) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS favourites_user_property_uidx ON favourites (user_id, property_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_property_id_properties_id_fk;
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_property_id_properties_id_fk
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;
    ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_guest_id_users_id_fk;
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_guest_id_users_id_fk
      FOREIGN KEY (guest_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN
    ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_host_id_users_id_fk;
    ALTER TABLE properties
      ADD CONSTRAINT properties_host_id_users_id_fk
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
