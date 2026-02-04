// Rollen-Definition für BROjekt
import type { UserRole as DBUserRole } from "./database";

// Re-export UserRole für externe Nutzung
export type UserRole = DBUserRole;

// Haupt-Rollen für Berechtigungen (user/viewer werden wie mitarbeiter behandelt)
export type PrimaryRole = "admin" | "mitarbeiter" | "subcontractor" | "customer";

// Berechtigungen pro Rolle
export const ROLE_PERMISSIONS = {
  admin: {
    // Vollzugriff
    projects: { read: true, write: true, delete: true },
    customers: { read: true, write: true, delete: true },
    leads: { read: true, write: true, delete: true },
    offers: { read: true, write: true, delete: true },
    team: { read: true, write: true, delete: true },
    logs: { read: true, write: true, delete: true },
    skills: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
  },
  mitarbeiter: {
    // Projekte, Kunden, Leads, Angebote
    projects: { read: true, write: true, delete: false },
    customers: { read: true, write: true, delete: false },
    leads: { read: true, write: true, delete: false },
    offers: { read: true, write: true, delete: false },
    team: { read: true, write: false, delete: false },
    logs: { read: true, write: false, delete: false },
    skills: { read: true, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
  },
  subcontractor: {
    // Nur zugewiesene Projekte
    projects: { read: "assigned", write: "assigned", delete: false },
    customers: { read: false, write: false, delete: false },
    leads: { read: false, write: false, delete: false },
    offers: { read: false, write: false, delete: false },
    team: { read: false, write: false, delete: false },
    logs: { read: false, write: false, delete: false },
    skills: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
  },
  customer: {
    // Nur eigene Projekte (read-only)
    projects: { read: "own", write: false, delete: false },
    customers: { read: false, write: false, delete: false },
    leads: { read: false, write: false, delete: false },
    offers: { read: "own", write: false, delete: false },
    team: { read: false, write: false, delete: false },
    logs: { read: false, write: false, delete: false },
    skills: { read: false, write: false, delete: false },
    settings: { read: false, write: false, delete: false },
  },
} as const;

// Resource-Typen
export type Resource = keyof typeof ROLE_PERMISSIONS.admin;
export type Permission = "read" | "write" | "delete";
export type PermissionValue = boolean | "assigned" | "own";

// Route-Zugriff pro Rolle
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  "/": ["admin", "mitarbeiter", "subcontractor", "customer"],
  "/projects": ["admin", "mitarbeiter", "subcontractor", "customer"],
  "/projects/[slug]": ["admin", "mitarbeiter", "subcontractor", "customer"],
  "/leads": ["admin", "mitarbeiter"],
  "/leads/[id]": ["admin", "mitarbeiter"],
  "/customers": ["admin", "mitarbeiter"],
  "/customers/[id]": ["admin", "mitarbeiter", "customer"],
  "/quotes": ["admin", "mitarbeiter"],
  "/quotes/[id]": ["admin", "mitarbeiter", "customer"],
  "/subcontractors": ["admin", "mitarbeiter"],
  "/subcontractors/[id]": ["admin", "mitarbeiter"],
  "/documents": ["admin", "mitarbeiter", "subcontractor", "customer"],
  "/calendar": ["admin", "mitarbeiter", "subcontractor"],
  "/team": ["admin", "mitarbeiter"],
  "/logs": ["admin", "mitarbeiter"],
  "/skills": ["admin", "mitarbeiter"],
  "/openclaw": ["admin"],
  "/settings": ["admin"],
  // Customer Portal
  "/portal": ["customer"],
  "/portal/projekte": ["customer"],
  "/portal/projekte/[slug]": ["customer"],
  "/portal/angebote": ["customer"],
  "/portal/dokumente": ["customer"],
};

// User-Profil mit Rolle
export interface UserProfile {
  id: string;
  auth_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: UserRole;
  avatar: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}
