import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

/**
 * Write process.env without dot access on keys Next/webpack may inline
 * (especially NODE_ENV → `"development" = "..."` SyntaxError).
 */
const setProcessEnv = (key: string, value: string): void => {
  process.env[key] = value;
};

const getProcessEnv = (key: string): string | undefined => process.env[key];

// Load .env from project root or parent directory.
// Preserve an explicit NODE_ENV=test so suites are not flipped to production by .env.
const priorNodeEnv = getProcessEnv("NODE" + "_ENV");
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
if (priorNodeEnv === "test") {
  setProcessEnv("NODE" + "_ENV", "test");
}

const envSchema = z.object({
  // ─── Core ───
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // ─── Database ───
  DATABASE_URL: z.string().optional(),

  // ─── Auth / Security ───
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters").default(
    "ile_dev_session_secret_not_for_production_use_change_me_now_2026"
  ),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(7),

  // ─── Cloudflare R2 (Image Storage) ───
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("storageapp"),
  R2_PUBLIC_URL: z.string().url().optional(),

  R2_FOLDER_PREFIX: z.string().default("storageapp/ilestays.ng/"),

  // ─── Email (Transactional) ───
  RESEND_API_KEY: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Ilé <hello@notifications.ilestays.ng>"),
  EMAIL_SUPPORT: z.string().default("support@ilestays.ng"),
  EMAIL_ENQUIRIES: z.string().default("info@ilestays.ng"),
  EMAIL_PROVIDER: z.enum(["resend", "sendgrid", "console"]).default("resend"),
  RESEND_DOMAIN: z.string().default("notifications.ilestays.ng"),

  // ─── SMS (Termii) ───
  SMS_PROVIDER: z.enum(["termii", "console"]).default("console"),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default("IleStays"),
  TERMII_BASE_URL: z.string().url().default("https://api.ng.termii.com"),

  // ─── Push (FCM Admin) ───
  PUSH_PROVIDER: z.enum(["fcm", "console"]).default("console"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // ─── Web Push (VAPID) ───
  WEB_PUSH_PROVIDER: z.enum(["webpush", "console"]).default("console"),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().default("mailto:support@ilestays.ng"),

  // ─── Payments (Paystack) ───
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_MOCK_TRANSFERS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),

  // ─── Frontend ───
  FRONTEND_URL: z.string().url().default("https://ilestays.ng"),

  // ─── Geocoding ───
  GEOCODING_API_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // Support both RESEND_API_KEY and EMAIL_API_KEY aliases
  const resendKey = getProcessEnv("RESEND_API_KEY") || getProcessEnv("EMAIL_API_KEY");
  if (resendKey) {
    if (!getProcessEnv("RESEND_API_KEY")) setProcessEnv("RESEND_API_KEY", resendKey);
    if (!getProcessEnv("EMAIL_API_KEY")) setProcessEnv("EMAIL_API_KEY", resendKey);
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.warn("\n⚠️ [Ilé] Environment configuration warning:\n");
    for (const issue of result.error.issues) {
      const issuePath = issue.path.join(".");
      console.warn(`   • ${issuePath}: ${issue.message}`);
    }
    // Return parsed defaults / process.env fallback instead of exiting in serverless
    return (process.env as unknown) as Env;
  }

  let validated: Env = result.data;

  // Production safety: never allow mock payment mode; fail closed at call sites
  if (validated.NODE_ENV === "production") {
    if (validated.PAYSTACK_MOCK_TRANSFERS === true) {
      console.error(
        "❌ [Ilé] PAYSTACK_MOCK_TRANSFERS was set under NODE_ENV=production — forcing OFF. Mock Paystack transfers/refunds are forbidden."
      );
      // Immutable override (no const/property mutation); sync process.env via bracket key
      validated = { ...validated, PAYSTACK_MOCK_TRANSFERS: false };
      setProcessEnv("PAYSTACK_MOCK_TRANSFERS", "false");
    }
    if (!validated.DATABASE_URL) {
      console.warn("⚠️ [Ilé] DATABASE_URL not set in production. Ensure remote DB is configured.");
    }
    if (validated.SESSION_SECRET.includes("not_for_production")) {
      console.warn("⚠️ [Ilé] Running in production with default SESSION_SECRET. Consider setting a custom secret in production.");
    }
    if (!validated.PAYSTACK_SECRET_KEY) {
      console.error(
        "❌ [Ilé] PAYSTACK_SECRET_KEY not set in production. Payment init/verify will fail closed (no MOCK_DEV)."
      );
    }
    if (validated.EMAIL_PROVIDER === "console") {
      console.error(
        "❌ [Ilé] EMAIL_PROVIDER=console in production — transactional email will fail closed (no silent mock success)."
      );
    }
    if (validated.SMS_PROVIDER === "console") {
      console.error(
        "❌ [Ilé] SMS_PROVIDER=console in production — SMS OTP delivery will fail closed (no silent mock success)."
      );
    }
  }

  return validated;
}

/** Validated environment — safe to use anywhere after import */
export const env = validateEnv();

/** Is this a development environment? */
export const isDev = env.NODE_ENV === "development";

/** Is this a production environment? */
export const isProd = env.NODE_ENV === "production";
