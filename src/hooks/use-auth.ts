"use client";

import { useAuth } from "@/contexts/auth-context";
import type { UserRole, Resource, Permission } from "@/types/auth";
import { ROUTE_ACCESS } from "@/types/auth";

// Re-export useAuth for convenience
export { useAuth };

/**
 * Hook für Rollen-Check
 */
export function useRole() {
  const { role, isAdmin, isMitarbeiter, isSubcontractor, isCustomer } = useAuth();
  
  return {
    role,
    isAdmin,
    isMitarbeiter,
    isSubcontractor,
    isCustomer,
    
    // Check if user has specific role
    hasRole: (requiredRole: UserRole) => role === requiredRole,
    
    // Check if user has one of multiple roles
    hasAnyRole: (roles: UserRole[]) => role !== null && roles.includes(role),
    
    // Check if user is internal (admin or mitarbeiter)
    isInternal: isAdmin || isMitarbeiter,
    
    // Check if user is external (subcontractor or customer)
    isExternal: isSubcontractor || isCustomer,
  };
}

/**
 * Hook für Berechtigungen
 */
export function usePermissions() {
  const { hasPermission, canAccess, role } = useAuth();
  
  return {
    hasPermission,
    canAccess,
    
    // Quick checks for common resources
    canReadProjects: () => canAccess("projects", "read"),
    canWriteProjects: () => canAccess("projects", "write"),
    canDeleteProjects: () => canAccess("projects", "delete"),
    
    canReadLeads: () => canAccess("leads", "read"),
    canWriteLeads: () => canAccess("leads", "write"),
    
    canReadTeam: () => canAccess("team", "read"),
    canWriteTeam: () => canAccess("team", "write"),
    
    canReadLogs: () => canAccess("logs", "read"),
    canReadSkills: () => canAccess("skills", "read"),
    canWriteSkills: () => canAccess("skills", "write"),
    
    canAccessSettings: () => canAccess("settings", "read"),
    
    // Check permission value (includes "assigned"/"own")
    getPermissionLevel: (resource: Resource, permission: Permission) => {
      return hasPermission(resource, permission);
    },
    
    // Check if access is restricted
    isRestricted: (resource: Resource) => {
      const perm = hasPermission(resource, "read");
      return perm === "assigned" || perm === "own";
    },
  };
}

/**
 * Hook für Route-Zugriff
 */
export function useRouteAccess() {
  const { role } = useAuth();
  
  return {
    // Check if current user can access a route
    canAccessRoute: (path: string): boolean => {
      if (!role) return false;
      
      // Normalize path (remove trailing slash, handle dynamic routes)
      const normalizedPath = path.replace(/\/$/, "") || "/";
      
      // Try exact match first
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
      
      // Default: allow admins, deny others
      return role === "admin";
    },
    
    // Get allowed routes for current user
    getAllowedRoutes: (): string[] => {
      if (!role) return [];
      return Object.entries(ROUTE_ACCESS)
        .filter(([, roles]) => roles.includes(role))
        .map(([path]) => path);
    },
  };
}

/**
 * Hook für User-Profil
 */
export function useProfile() {
  const { profile, user, refreshProfile } = useAuth();
  
  return {
    profile,
    user,
    refreshProfile,
    
    // User info
    displayName: profile?.display_name || profile?.username || "Benutzer",
    email: profile?.email || user?.email || "",
    avatar: profile?.avatar,
    username: profile?.username,
    
    // Status
    isActive: profile?.active ?? false,
    hasProfile: !!profile,
  };
}
