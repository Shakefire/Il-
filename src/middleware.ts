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
  const isHostDashboard = pathname === "/host/dashboard";
  const isAuthRoute = ["/login", "/register", "/signup"].includes(pathname);

  // 1. Unauthenticated or non-admin access to Admin Workspace
  if (isAdminRoute) {
    if (!userRole) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (userRole !== "admin") {
      // Divert hosts or guests away from isolated admin portal
      return NextResponse.redirect(
        new URL(userRole === "host" ? "/host/dashboard" : "/", request.url)
      );
    }
  }

  // 2. Admin attempting to navigate to consumer or host portals
  if (userRole === "admin") {
    const isConsumerOnly =
      pathname === "/trips" ||
      pathname === "/become-a-host" ||
      pathname.startsWith("/host/onboarding");
    if (isConsumerOnly || isAuthRoute) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // 3. Host accessing auth routes -> divert to Host Dashboard
  if (userRole === "host" && isAuthRoute) {
    return NextResponse.redirect(new URL("/host/dashboard", request.url));
  }

  // 4. Unauthenticated access to Host Dashboard
  if (isHostDashboard && !userRole) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/host/dashboard");
    return NextResponse.redirect(loginUrl);
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
