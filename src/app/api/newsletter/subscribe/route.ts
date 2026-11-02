import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiting: max 5 requests per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[Newsletter] DATABASE_URL is not set.");
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { newsletterSubscribers } = await import(
      "@/../backend/src/db/schema/newsletter"
    );
    const { eq } = await import("drizzle-orm");
    const crypto = await import("crypto");

    const pool = new Pool({ connectionString: dbUrl, max: 2 });
    const db = drizzle(pool, { schema: { newsletterSubscribers } });

    // Check for existing subscriber
    const existing = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    if (existing.length > 0) {
      const sub = existing[0];
      if (sub.status === "active") {
        await pool.end();
        return NextResponse.json(
          {
            success: true,
            message: "You're already subscribed to Ilé updates.",
            alreadySubscribed: true,
          },
          { status: 200 }
        );
      }
      // Reactivate unsubscribed
      await db
        .update(newsletterSubscribers)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(newsletterSubscribers.email, email));
      await pool.end();
      return NextResponse.json(
        {
          success: true,
          message: "You're on the list! Look out for updates from Ilé.",
          alreadySubscribed: false,
        },
        { status: 201 }
      );
    }

    // New subscriber
    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      status: "active",
      subscribedAt: new Date(),
      updatedAt: new Date(),
    });

    await pool.end();
    return NextResponse.json(
      {
        success: true,
        message: "You're on the list! Look out for updates from Ilé.",
        alreadySubscribed: false,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Newsletter] Subscribe error:", msg);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
