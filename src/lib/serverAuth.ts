import { NextRequest } from "next/server";
import { verifySessionToken, SessionPayload } from "@/../backend/src/lib/security";

export function authenticateNextRequest(req: NextRequest): SessionPayload | null {
  // 1. Check Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const payload = verifySessionToken(token);
    if (payload) return payload;
  }

  // 2. Check session_token cookie
  const cookieToken = req.cookies.get("session_token")?.value;
  if (cookieToken) {
    const payload = verifySessionToken(cookieToken);
    if (payload) return payload;
  }

  return null;
}
