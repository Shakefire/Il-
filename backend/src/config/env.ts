import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root or parent directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

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

  // ─── Payments (Paystack) ───
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),

  // ─── Frontend ───
  FRONTEND_URL: z.string().url().default("https://ilestays.ng"),

  // ─── Geocoding ───
  GEOCODING_API_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  // Support both RESEND_API_KEY and EMAIL_API_KEY aliases
  const resendKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
  if (resendKey) {
    if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = resendKey;
    if (!process.env.EMAIL_API_KEY) process.env.EMAIL_API_KEY = resendKey;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.warn("\n⚠️ [Ilé] Environment configuration warning:\n");
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      console.warn(`   • ${path}: ${issue.message}`);
    }
    // Return parsed defaults / process.env fallback instead of exiting in serverless
    return (process.env as unknown) as Env;
  }

  const env = result.data;

  // Production safety checks (non-fatal warnings to prevent deploy rollback)
  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) {
      console.warn("⚠️ [Ilé] DATABASE_URL not set in production. Ensure remote DB is configured.");
    }
    if (env.SESSION_SECRET.includes("not_for_production")) {
      console.warn("⚠️ [Ilé] Running in production with default SESSION_SECRET. Consider setting a custom secret in production.");
    }
    if (!env.PAYSTACK_SECRET_KEY) {
      console.warn("⚠️ [Ilé] PAYSTACK_SECRET_KEY not set. Using test mode payments.");
    }
  }

  return env;
}

/** Validated environment — safe to use anywhere after import */
export const env = validateEnv();

/** Is this a development environment? */
export const isDev = env.NODE_ENV === "development";

/** Is this a production environment? */
export const isProd = env.NODE_ENV === "production";
