/**
 * Central Permission System
 * Provides standardized permission checks across the application
 */

export type UserRole = 'admin' | 'mitarbeiter' | 'superadmin' | 'customer' | 'subcontractor' | 'user' | 'viewer';

/**
 * Check if user is BROjekt staff (admin or mitarbeiter)
 */
export function isStaff(role: UserRole | string | null | undefined): boolean {
  if (!role) return false;
  return ['admin', 'mitarbeiter', 'superadmin'].includes(role);
}

/**
 * Check if user is admin (including superadmin)
 */
export function isAdmin(role: UserRole | string | null | undefined): boolean {
  if (!role) return false;
  return ['admin', 'superadmin'].includes(role);
}

/**
 * Check if user is a customer
 */
export function isCustomer(role: UserRole | string | null | undefined): boolean {
  return role === 'customer';
}

/**
 * Check if user is a partner/subcontractor
 */
export function isPartner(role: UserRole | string | null | undefined): boolean {
  return role === 'subcontractor';
}

/**
 * Check if user can manage users (create, update, delete)
 */
export function canManageUsers(role: UserRole | string | null | undefined): boolean {
  return isAdmin(role);
}

/**
 * Check if user can view all projects
 */
export function canViewAllProjects(role: UserRole | string | null | undefined): boolean {
  return isStaff(role);
}

/**
 * Check if user can create projects
 */
export function canCreateProjects(role: UserRole | string | null | undefined): boolean {
  return isStaff(role);
}

/**
 * Check if user can upload documents
 */
export function canUploadDocuments(role: UserRole | string | null | undefined): boolean {
  // Staff can always upload, customers can upload to their own projects
  return isStaff(role) || isCustomer(role) || isPartner(role);
}

/**
 * Check if user can delete documents
 */
export function canDeleteDocuments(role: UserRole | string | null | undefined): boolean {
  return isAdmin(role);
}

/**
 * Check if user can manage partners
 */
export function canManagePartners(role: UserRole | string | null | undefined): boolean {
  return isStaff(role);
}

/**
 * Check if user can create customer logins
 */
export function canCreateCustomerLogins(role: UserRole | string | null | undefined): boolean {
  return isStaff(role);
}

/**
 * Get display name for role
 */
export function getRoleDisplayName(role: UserRole | string): string {
  const roleNames: Record<string, string> = {
    admin: 'Administrator',
    mitarbeiter: 'Mitarbeiter',
    superadmin: 'Super Administrator',
    customer: 'Kunde',
    subcontractor: 'Partner',
    user: 'Benutzer',
    viewer: 'Betrachter',
  };
  return roleNames[role] || role;
}

/**
 * Allowed file types for document uploads
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ALLOWED_FILE_TYPES.includes(mimeType);
}

/**
 * Validate file size
 */
export function isAllowedFileSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * Get file size display string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
