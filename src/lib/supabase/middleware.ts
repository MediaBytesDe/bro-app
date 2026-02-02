import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTE_ACCESS, type UserRole } from "@/types/auth";

// Öffentliche Routen (keine Auth erforderlich)
const PUBLIC_ROUTES = ["/login", "/auth"];

// API-Routen die spezielle Behandlung brauchen
const API_ROUTES = ["/api"];

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

  // Check if public route
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isApiRoute = API_ROUTES.some((route) => pathname.startsWith(route));

  // Skip auth for API routes (they handle their own auth)
  if (isApiRoute) {
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

  // Logged in but on login page -> redirect to home
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
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
    // Redirect to appropriate page based on role
    const url = request.nextUrl.clone();
    
    // Subcontractors and customers go to projects
    if (role === "subcontractor" || role === "customer") {
      url.pathname = "/projects";
    } else {
      // Others go to home
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
