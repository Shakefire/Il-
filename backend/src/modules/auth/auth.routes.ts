import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authService, RegisterSchema, LoginSchema } from "./auth.service";
import { createSessionToken, authenticateRequest } from "../../lib/security";
import { env } from "../../config/env";

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
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
    const { token, password } = request.body as any;
    if (!password || typeof password !== "string" || password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters long." });
    }

    await authService.resetPassword(token, password);
    return reply.send({
      success: true,
      message: "Your password has been reset successfully. Please log in with your new credentials.",
    });
  });
}
