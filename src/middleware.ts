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

  // 1. Admin isolation: Admins are strictly contained in /admin
  if (userRole === "admin") {
    if (!pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 2. Unauthenticated access attempting to reach /admin
  if (isAdminRoute && userRole !== "admin") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/admin");
    return NextResponse.redirect(loginUrl);
  }

  // 3. Host isolation: Non-admin users are strictly contained in the Host Workspace
  // Completely isolated from consumer pages (/ , /search, /stay/*, /trips, /messages, etc.)
  if (userRole && userRole !== "admin") {
    const isHostAllowed =
      pathname.startsWith("/host/dashboard") ||
      pathname.startsWith("/host/onboarding") ||
      pathname === "/become-a-host";

    if (!isHostAllowed) {
      return NextResponse.redirect(new URL("/host/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 4. Unauthenticated access attempting to access Host Workspace or legacy guest pages
  // Routes directly to host account creation page (/signup), NOT admin login
  if (
    !userRole &&
    (pathname.startsWith("/host/dashboard") ||
      pathname.startsWith("/host/onboarding") ||
      pathname === "/become-a-host" ||
      pathname === "/trips" ||
      pathname === "/messages" ||
      pathname === "/profile")
  ) {
    const signupUrl = new URL("/signup", request.url);
    signupUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signupUrl);
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
