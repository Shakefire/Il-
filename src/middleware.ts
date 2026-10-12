import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Edge Middleware — Role-Based Access Control (RBAC)
 * 
 * Enforces strict routing isolation between Admin, Host, and Consumer roles.
 */
function parseJwtRole(token: string): string | null {
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
    return payload.role ? String(payload.role).toLowerCase() : null;
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
  const userRole = sessionToken ? parseJwtRole(sessionToken) : null;

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

  // 3. Host Workspace protection: Requires authentication
  if (isHostRoute) {
    if (!sessionToken) {
      const signupUrl = new URL("/signup", request.url);
      signupUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(signupUrl);
    }
    return NextResponse.next();
  }

  // 4. Private consumer account pages protection
  if (isUserAccountRoute) {
    if (!sessionToken) {
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
