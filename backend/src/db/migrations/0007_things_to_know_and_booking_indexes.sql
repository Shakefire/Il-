-- Add things_to_know JSONB to properties (if not present)
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS things_to_know JSONB;

-- Add indexes on bookings for expiration and deadline queries
CREATE INDEX IF NOT EXISTS idx_bookings_host_deadline ON bookings(status, host_response_deadline_at);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_deadline ON bookings(status, payment_deadline_at);
