import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Edge Middleware — Role-Based Access Control (RBAC)
 * 
 * Enforces strict routing isolation between Admin, Host, and Consumer roles.
 */
interface JwtSessionPayload {
  userId?: string;
  email?: string;
  role?: string;
  emailVerified?: boolean;
  exp?: number;
}

function parseJwtPayload(token: string): JwtSessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Decode base64url payload
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = atob(base64);
    const payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let /api/* requests be handled directly by rewrites to backend
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("session_token")?.value;
  const jwtPayload = sessionToken ? parseJwtPayload(sessionToken) : null;
  const userRole = jwtPayload?.role ? String(jwtPayload.role).toLowerCase() : null;

  const isAdminRoute = pathname.startsWith("/admin");
  const isHostRoute = pathname.startsWith("/host/") || pathname === "/become-a-host";
  const isUserAccountRoute = ["/trips", "/messages", "/profile"].some((p) => pathname.startsWith(p));
  const isMarketplaceRoute = pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/stay/");

  // 1. Admin route protection: Only admins can access /admin and subroutes
  if (isAdminRoute) {
    if (userRole !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Public marketplace routes: /stay/*, /search, / are open to all (including admin inspection)
  if (isMarketplaceRoute) {
    return NextResponse.next();
  }

  // 3. Host Workspace protection: Requires authenticated and verified session
  if (isHostRoute) {
    if (!sessionToken || !jwtPayload) {
      const signupUrl = new URL("/signup", request.url);
      signupUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(signupUrl);
    }
    if (jwtPayload.emailVerified === false) {
      const signupUrl = new URL("/signup", request.url);
      signupUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(signupUrl);
    }
    return NextResponse.next();
  }

  // 4. Private consumer account pages protection
  if (isUserAccountRoute) {
    // If accessing /trips with a booking reference or access token, allow access without login redirect
    if (pathname.startsWith("/trips")) {
      const searchParams = request.nextUrl.searchParams;
      const hasBookingKey =
        searchParams.has("ref") ||
        searchParams.has("reference") ||
        searchParams.has("trxref") ||
        searchParams.has("token") ||
        searchParams.has("payment");
      if (hasBookingKey) {
        return NextResponse.next();
      }
    }

    if (!sessionToken || !jwtPayload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
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
