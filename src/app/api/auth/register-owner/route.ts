import { NextRequest, NextResponse } from "next/server";
import { authService, RegisterOwnerSchema } from "@/../backend/src/modules/auth/auth.service";
import { createSessionToken } from "@/../backend/src/lib/security";

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
    const token = createSessionToken(user.id, user.email, user.role);

    const response = NextResponse.json(
      {
        success: true,
        token,
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

    response.cookies.set("session_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    const status = err.message?.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: err.message || "Failed to register" }, { status });
  }
}
