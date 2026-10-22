import { NextRequest, NextResponse } from "next/server";
import { authService, RegisterSchema } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = RegisterSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const user = await authService.registerUser(parse.data);

    // CRITICAL SECURITY FIX: Do NOT create a session token or set session cookies here.
    // The session must only be issued after successful email verification.
    return NextResponse.json(
      {
        success: true,
        requiresEmailVerification: true,
        email: user.email,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
        },
        message: "Account created. Please verify your email to continue.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    const isConflict =
      err?.code === "23505" ||
      err?.message?.includes("already exists") ||
      err?.message?.includes("duplicate");
    const status = isConflict ? 409 : 400;
    return NextResponse.json({ error: err.message || "Failed to register" }, { status });
  }
}
