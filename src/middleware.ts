import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Edge Middleware
 * 
 * Routes /api/* directly to the Fastify backend via Next.js rewrites.
 * Authentication is strictly handled server-side by the Fastify API
 * via HTTP-only session cookies and bcrypt-verified sessions.
 */
export function middleware(request: NextRequest) {
  // Let /api/* requests be handled directly by rewrites to backend
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/assets extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
