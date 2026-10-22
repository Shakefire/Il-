import { NextRequest, NextResponse } from "next/server";
import { authService, RegisterOwnerSchema } from "@/../backend/src/modules/auth/auth.service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = RegisterOwnerSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { user, profile } = await authService.registerOwner(parse.data);

    // CRITICAL SECURITY FIX: Do NOT create a session token or set session cookies here.
    // The session must only be issued after the user verifies their email via OTP.
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
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          status: user.status,
        },
        profile,
        message: "Owner account created. Please verify your email with the 6-digit code sent.",
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
