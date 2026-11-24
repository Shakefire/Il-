-- Phase 2: reconcilable platform commission cash inside the existing ledger.
-- Legacy caution-fee columns are not added. cautionFeeNgn is a retained display field
-- and is not used in booking or payment math.

INSERT INTO ledger_accounts (id, code, name, type, description)
VALUES
  ('acc_1040', '1040', 'Platform Commission Funds', 'ASSET', 'Reconcilable commission cash. The only account that may fund an admin guest refund.'),
  ('acc_1050', '1050', 'Commission Funds Reserved', 'ASSET', 'Commission cash reserved for an in-flight admin refund.'),
  ('acc_5030', '5030', 'Guest Refunds From Commission', 'EXPENSE', 'Guest refunds settled from platform commission funds. Host payable is not used.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS host_base_price INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_verified_at TIMESTAMPTZ;
