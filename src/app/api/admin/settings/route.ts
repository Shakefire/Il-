import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/../backend/src/db/client";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/admin/settings — fetch platform settings
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const [settings] = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);

    if (!settings) {
      // Return defaults if no row exists yet
      return NextResponse.json({
        defaultHostCommissionPct: 10,
        payoutHoldHours: 24,
      });
    }

    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/admin/settings — update platform settings
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();

    const commissionPct = body.defaultHostCommissionPct;
    const payoutHoldHours = body.payoutHoldHours;

    if (commissionPct !== undefined && (commissionPct < 0 || commissionPct > 50)) {
      return NextResponse.json(
        { error: "Commission percentage must be between 0 and 50." },
        { status: 400 }
      );
    }

    // Upsert the default settings row
    const [existing] = await db
      .select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.id, "default"))
      .limit(1);

    const updates: any = { updatedAt: new Date() };
    if (commissionPct !== undefined) updates.defaultHostCommissionPct = Math.round(commissionPct);
    if (payoutHoldHours !== undefined) updates.payoutHoldHours = Math.round(payoutHoldHours);

    if (existing) {
      const [updated] = await db
        .update(schema.platformSettings)
        .set(updates)
        .where(eq(schema.platformSettings.id, "default"))
        .returning();
      return NextResponse.json({ success: true, settings: updated });
    } else {
      const [created] = await db
        .insert(schema.platformSettings)
        .values({
          id: "default",
          defaultHostCommissionPct: commissionPct ?? 10,
          payoutHoldHours: payoutHoldHours ?? 24,
          updatedAt: new Date(),
        })
        .returning();
      return NextResponse.json({ success: true, settings: created });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
