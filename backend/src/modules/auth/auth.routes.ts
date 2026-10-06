import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authService, RegisterSchema, RegisterOwnerSchema, LoginSchema } from "./auth.service";
import { createSessionToken, authenticateRequest } from "../../lib/security";
import { env } from "../../config/env";

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register-owner — Primary public signup for Property Owners
  fastify.post("/register-owner", async (request, reply) => {
    const parse = RegisterOwnerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.issues[0]?.message || "Validation failed" });
    }

    try {
      const { user, profile } = await authService.registerOwner(parse.data);
      const token = createSessionToken(user.id, user.email, user.role);

      reply.setCookie("session_token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
      });

      return reply.status(201).send({
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
      });
    } catch (err: any) {
      const status = err.message.includes("already exists") ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // POST /api/auth/verify-email
  fastify.post("/verify-email", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { code } = (request.body || {}) as { code?: string };
    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return reply.status(400).send({ error: "Please provide a valid 6-digit verification code." });
    }

    try {
      const result = await authService.verifyEmailOtp(session.userId, code.trim());
      return reply.send({
        success: true,
        message: "Email successfully verified. You can now proceed with your owner profile.",
        ...result,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/auth/resend-email-otp
  fastify.post("/resend-email-otp", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    try {
      const result = await authService.resendEmailOtp(session.userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/auth/send-phone-otp
  fastify.post("/send-phone-otp", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { phone } = (request.body || {}) as { phone?: string };
    if (!phone || typeof phone !== "string" || phone.trim().length < 9) {
      return reply.status(400).send({ error: "Please enter a valid phone number." });
    }

    try {
      const result = await authService.sendPhoneOtp(session.userId, phone.trim());
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/auth/verify-phone
  fastify.post("/verify-phone", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const { code } = (request.body || {}) as { code?: string };
    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return reply.status(400).send({ error: "Please enter a valid 6-digit phone verification code." });
    }

    try {
      const result = await authService.verifyPhoneOtp(session.userId, code.trim());
      return reply.send({
        success: true,
        message: "Phone number verified successfully.",
        ...result,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // POST /api/auth/register (legacy / guest registration support)
  fastify.post("/register", async (request, reply) => {
    const parse = RegisterSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.issues[0]?.message || "Validation failed" });
    }

    try {
      const user = await authService.registerUser(parse.data);
      const token = createSessionToken(user.id, user.email, user.role);

      reply.setCookie("session_token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
      });

      return reply.status(201).send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err: any) {
      const status = err.message.includes("already exists") ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // POST /api/auth/login
  fastify.post("/login", async (request, reply) => {
    const parse = LoginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: parse.error.issues[0]?.message || "Validation failed" });
    }

    try {
      const user = await authService.loginUser(parse.data.email, parse.data.password);
      const token = createSessionToken(user.id, user.email, user.role);

      reply.setCookie("session_token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  });

  // POST /api/auth/logout
  fastify.post("/logout", async (_request, reply) => {
    reply.clearCookie("session_token", { path: "/" });
    return reply.send({ success: true, message: "Logged out successfully." });
  });

  // GET /api/auth/me
  fastify.get("/me", async (request, reply) => {
    const session = await authenticateRequest(request, reply);
    if (!session) return;

    const user = await authService.getCurrentUser(session.userId);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return reply.send({ user });
  });

  // POST /api/auth/forgot-password
  fastify.post("/forgot-password", async (request, reply) => {
    const { email } = request.body as any;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return reply.status(400).send({ error: "Please enter a valid email address." });
    }

    await authService.requestPasswordReset(email);
    return reply.send({
      success: true,
      message: `If an account exists for ${email.trim()}, a password reset link has been dispatched.`,
    });
  });

  // POST /api/auth/reset-password
  fastify.post("/reset-password", async (request, reply) => {
    const { token, password } = (request.body || {}) as any;
    if (!token || typeof token !== "string") {
      return reply.status(400).send({ error: "A valid password reset token is required." });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters long." });
    }

    try {
      await authService.resetPassword(token, password);
      return reply.send({
        success: true,
        message: "Your password has been reset successfully. Please log in with your new credentials.",
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to reset password." });
    }
  });
}
