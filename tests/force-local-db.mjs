process.env.DATABASE_URL = ""
if (!process.env.ILE_PGLITE_DIR) {
  process.env.ILE_PGLITE_DIR = ".data/phase2-finance-test"
}
process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = "console"
process.env.SMS_PROVIDER = "console"
process.env.PAYSTACK_SECRET_KEY = "sk_test_phase2_local_only_not_live"
process.env.PAYSTACK_REFUND_MOCK_RESULT = "success"
process.env.PAYSTACK_TRANSFER_MOCK_RESULT = "pending"
