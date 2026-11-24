-- Phase 1: retain booking and payment history. Missing tables are skipped
-- because payouts, refunds, webhook_events, and ledger journals are created
-- by the application seed on databases that predate those SQL files.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_property_id_properties_id_fk;
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_property_id_properties_id_fk
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_booking_id_bookings_id_fk;
    ALTER TABLE payments
      ADD CONSTRAINT payments_booking_id_bookings_id_fk
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'host_earnings') THEN
    ALTER TABLE host_earnings DROP CONSTRAINT IF EXISTS host_earnings_booking_id_bookings_id_fk;
    ALTER TABLE host_earnings
      ADD CONSTRAINT host_earnings_booking_id_bookings_id_fk
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
    ALTER TABLE host_earnings DROP CONSTRAINT IF EXISTS host_earnings_host_id_users_id_fk;
    ALTER TABLE host_earnings
      ADD CONSTRAINT host_earnings_host_id_users_id_fk
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') THEN
    ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_booking_id_bookings_id_fk;
    ALTER TABLE payouts
      ADD CONSTRAINT payouts_booking_id_bookings_id_fk
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
    ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_host_id_users_id_fk;
    ALTER TABLE payouts
      ADD CONSTRAINT payouts_host_id_users_id_fk
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refunds') THEN
    ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_booking_id_bookings_id_fk;
    ALTER TABLE refunds
      ADD CONSTRAINT refunds_booking_id_bookings_id_fk
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
    ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_bookings_id_fk;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'reviews' AND column_name = 'booking_id'
    ) THEN
      ALTER TABLE reviews
        ADD CONSTRAINT reviews_booking_id_bookings_id_fk
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_events') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_uidx
      ON webhook_events (gateway_provider, event_id)
      WHERE event_id IS NOT NULL;
  END IF;
EXCEPTION WHEN unique_violation OR duplicate_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_journals') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ledger_journals_reference_event_type_unique
      ON ledger_journals (reference, event_type);
  END IF;
EXCEPTION WHEN unique_violation OR duplicate_table THEN
  NULL;
END $$;
