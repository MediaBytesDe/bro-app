import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTE_ACCESS, type UserRole } from "@/types/auth";

// Öffentliche Routen (keine Auth erforderlich)
const PUBLIC_ROUTES = ["/login", "/auth", "/pwa-start"];

// API-Routen die spezielle Behandlung brauchen
const API_ROUTES = ["/api"];

// Statische Dateien die nie durch Auth gehen sollen
const STATIC_FILES = ["/manifest.json", "/sw.js", "/favicon.ico", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/logo.png"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check route type
  const { pathname } = request.nextUrl;
  
  // Skip middleware entirely for static files
  const isStaticFile = STATIC_FILES.includes(pathname) || pathname.startsWith("/_next/");
  if (isStaticFile) {
    return supabaseResponse;
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isApiRoute = API_ROUTES.some((route) => pathname.startsWith(route));

  // API routes handle their own auth, but we still need to refresh the session
  // so that cookies stay valid for server-side auth checks in API routes
  if (isApiRoute) {
    await supabase.auth.getUser();
    return supabaseResponse;
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in
  if (!user) {
    // Allow public routes
    if (isPublicRoute) {
      return supabaseResponse;
    }
    // Redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Logged in but on login page -> redirect to role-based home
  if (pathname === "/login") {
    // Need to get role first
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();
    
    const url = request.nextUrl.clone();
    if (profile?.role === "customer") {
      url.pathname = "/portal";
    } else if (profile?.role === "subcontractor") {
      url.pathname = "/partner";
    } else {
      url.pathname = "/";
    }
    return NextResponse.redirect(url);
  }

  // Get user profile and role
  const { data: profile } = await supabase
    .from("users")
    .select("role, active")
    .eq("auth_id", user.id)
    .single();

  // No profile or inactive
  if (!profile || !profile.active) {
    // Sign out and redirect to login
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "inactive");
    return NextResponse.redirect(url);
  }

  const role = profile.role as UserRole;

  // Check route access
  const hasAccess = checkRouteAccess(pathname, role);

  if (!hasAccess) {
    // Redirect to appropriate home based on role
    const url = request.nextUrl.clone();
    
    if (role === "customer") {
      url.pathname = "/portal";
    } else if (role === "subcontractor") {
      url.pathname = "/partner";
    } else {
      url.pathname = "/";
    }
    
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

/**
 * Check if a role can access a path
 */
function checkRouteAccess(pathname: string, role: UserRole): boolean {
  // Normalize path
  const normalizedPath = pathname.replace(/\/$/, "") || "/";

  // Try exact match
  if (ROUTE_ACCESS[normalizedPath]) {
    return ROUTE_ACCESS[normalizedPath].includes(role);
  }

  // Try pattern match for dynamic routes
  for (const [pattern, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
    const regex = new RegExp(
      "^" + pattern.replace(/\[.*?\]/g, "[^/]+") + "$"
    );
    if (regex.test(normalizedPath)) {
      return allowedRoles.includes(role);
    }
  }

  // Default: allow admins, deny others for unlisted routes
  return role === "admin";
}
