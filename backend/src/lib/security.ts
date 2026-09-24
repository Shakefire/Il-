import crypto from "crypto";
import bcrypt from "bcryptjs";
import { FastifyRequest, FastifyReply } from "fastify";
import { getDb, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { BCRYPT_SALT_ROUNDS, SESSION_MAX_AGE_SECONDS } from "../config/constants";

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createSessionToken(userId: string, email: string, role: string): string {
  const maxAge = env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
  const payload: SessionPayload = {
    userId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", env.SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract session from request without sending error responses.
 * Returns null if no valid session found.
 */
export function extractSession(request: FastifyRequest): SessionPayload | null {
  const authHeader = request.headers.authorization;
  let token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token && (request as any).cookies?.session_token) {
    token = (request as any).cookies.session_token;
  }

  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Require authentication — sends 401 if not authenticated.
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SessionPayload | null> {
  const session = extractSession(request);

  if (!session) {
    reply.status(401).send({ error: "Unauthorized: Please log in to proceed." });
    return null;
  }

  return session;
}

/**
 * Require specific role(s) — sends 401/403 if not authorized.
 */
export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  roles: string[]
): Promise<SessionPayload | null> {
  const session = await authenticateRequest(request, reply);
  if (!session) return null;

  if (!roles.includes(session.role)) {
    reply.status(403).send({ error: "Forbidden: You do not have permissions for this action." });
    return null;
  }

  return session;
}
