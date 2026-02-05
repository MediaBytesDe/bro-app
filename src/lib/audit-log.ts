/**
 * Audit Logging System
 * Tracks all critical operations for security and compliance
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  // Authentication
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_reset'
  | 'create_user_login'
  | 'delete_user_login'

  // Users
  | 'create_user'
  | 'update_user'
  | 'delete_user'
  | 'activate_user'
  | 'deactivate_user'

  // Projects
  | 'create_project'
  | 'update_project'
  | 'delete_project'
  | 'assign_project'

  // Documents
  | 'upload_document'
  | 'download_document'
  | 'delete_document'
  | 'share_document'

  // Customers
  | 'create_customer'
  | 'update_customer'
  | 'delete_customer'

  // Partners
  | 'create_partner'
  | 'update_partner'
  | 'delete_partner'
  | 'assign_partner'

  // Data Access
  | 'view_sensitive_data'
  | 'export_data'
  | 'gdpr_data_export'
  | 'gdpr_data_deletion'

  // Permissions
  | 'grant_permission'
  | 'revoke_permission'
  | 'change_role';

export type ResourceType =
  | 'user'
  | 'customer'
  | 'partner'
  | 'project'
  | 'document'
  | 'quote'
  | 'invoice'
  | 'message'
  | 'permission'
  | 'system';

export type AuditStatus = 'success' | 'failure' | 'error';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  status?: AuditStatus;
  errorMessage?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from('audit_logs').insert({
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      user_role: entry.userRole || null,
      action: entry.action,
      resource_type: entry.resourceType || null,
      resource_id: entry.resourceId || null,
      description: entry.description || null,
      metadata: entry.metadata || {},
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      request_id: entry.requestId || null,
      status: entry.status || 'success',
      error_message: entry.errorMessage || null,
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AUDIT LOG ERROR]', error);
  }
}

/**
 * Get client info from request
 */
export function getClientInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Create audit log from API request
 */
export async function auditFromRequest(
  request: Request,
  action: AuditAction,
  options: Partial<AuditLogEntry> = {}
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    ...options,
    action,
    ipAddress,
    userAgent,
  });
}

/**
 * Log successful login
 */
export async function logLogin(
  userId: string,
  email: string,
  role: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId,
    userEmail: email,
    userRole: role,
    action: 'login',
    description: `User logged in from ${ipAddress}`,
    ipAddress,
    userAgent,
    status: 'success',
  });
}

/**
 * Log failed login
 */
export async function logLoginFailure(
  email: string,
  reason: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userEmail: email,
    action: 'login_failed',
    description: `Login failed: ${reason}`,
    ipAddress,
    userAgent,
    status: 'failure',
    errorMessage: reason,
  });
}

/**
 * Log data export (GDPR)
 */
export async function logDataExport(
  userId: string,
  email: string,
  dataType: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId,
    userEmail: email,
    action: 'gdpr_data_export',
    description: `User exported ${dataType} data`,
    metadata: { dataType },
    ipAddress,
    userAgent,
  });
}

/**
 * Log data deletion (GDPR)
 */
export async function logDataDeletion(
  userId: string,
  email: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId,
    userEmail: email,
    action: 'gdpr_data_deletion',
    description: 'User requested complete data deletion',
    ipAddress,
    userAgent,
    metadata: { gdpr: true },
  });
}

/**
 * Log permission change
 */
export async function logPermissionChange(
  adminUserId: string,
  adminEmail: string,
  targetUserId: string,
  targetEmail: string,
  oldRole: string,
  newRole: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId: adminUserId,
    userEmail: adminEmail,
    action: 'change_role',
    resourceType: 'user',
    resourceId: targetUserId,
    description: `Changed ${targetEmail}'s role from ${oldRole} to ${newRole}`,
    metadata: {
      targetEmail,
      oldRole,
      newRole,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log document upload
 */
export async function logDocumentUpload(
  userId: string,
  email: string,
  documentId: string,
  fileName: string,
  projectId: string | null,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId,
    userEmail: email,
    action: 'upload_document',
    resourceType: 'document',
    resourceId: documentId,
    description: `Uploaded document: ${fileName}`,
    metadata: {
      fileName,
      projectId,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log document deletion
 */
export async function logDocumentDeletion(
  userId: string,
  email: string,
  documentId: string,
  fileName: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId,
    userEmail: email,
    action: 'delete_document',
    resourceType: 'document',
    resourceId: documentId,
    description: `Deleted document: ${fileName}`,
    metadata: { fileName },
    ipAddress,
    userAgent,
  });
}

/**
 * Log customer login creation
 */
export async function logCreateCustomerLogin(
  adminUserId: string,
  adminEmail: string,
  customerId: string,
  customerEmail: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getClientInfo(request);

  await createAuditLog({
    userId: adminUserId,
    userEmail: adminEmail,
    action: 'create_user_login',
    resourceType: 'customer',
    resourceId: customerId,
    description: `Created login for customer: ${customerEmail}`,
    metadata: { customerEmail },
    ipAddress,
    userAgent,
  });
}
