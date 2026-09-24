import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

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
  R2_BUCKET_NAME: z.string().default("ile-media"),
  R2_PUBLIC_URL: z.string().url().optional(),

  R2_FOLDER_PREFIX: z.string().default("9jaroommate.com/"),

  // ─── Email (Transactional) ───
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("noreply@ile.ng"),
  EMAIL_PROVIDER: z.enum(["resend", "sendgrid", "console"]).default("console"),
  RESEND_DOMAIN: z.string().default("notifications.9jaroommate.com"),

  // ─── Payments (Paystack) ───
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),

  // ─── Supabase ───
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),

  // ─── Frontend ───
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // ─── Geocoding ───
  GEOCODING_API_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ [Ilé] Invalid environment configuration:\n");
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      console.error(`   • ${path}: ${issue.message}`);
    }
    console.error("\n   See .env.example for required variables.\n");
    process.exit(1);
  }

  const env = result.data;

  // Production safety checks
  if (env.NODE_ENV === "production") {
    const missing: string[] = [];

    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (env.SESSION_SECRET.includes("not_for_production")) missing.push("SESSION_SECRET");
    if (!env.PAYSTACK_SECRET_KEY) missing.push("PAYSTACK_SECRET_KEY");

    if (missing.length > 0) {
      console.error("\n❌ [Ilé] Missing required production environment variables:");
      missing.forEach((v) => console.error(`   • ${v}`));
      console.error("");
      process.exit(1);
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
