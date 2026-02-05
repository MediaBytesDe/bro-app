/**
 * Input Validation Schemas using Zod
 * Centralized validation for API routes and forms
 */

import { z } from 'zod';
import type { DocumentType } from '@/types/database';

// ============================================
// Base Schemas
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

export const urlSchema = z.string().url('Invalid URL format');

export const dateSchema = z.string().datetime('Invalid date format');

// ============================================
// Document Schemas
// ============================================

export const documentTypeSchema = z.enum([
  'rechnung',
  'angebot',
  'lieferschein',
  'auftragsbestaetigung',
  'vertrag',
  'sonstiges',
] as const);

export const fileUploadSchema = z.object({
  projectId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  documentType: documentTypeSchema.optional(),
  description: z.string().max(500).optional(),
}).refine(
  (data) => data.projectId || data.customerId,
  {
    message: 'Either projectId or customerId is required',
    path: ['projectId'],
  }
);

// ============================================
// User/Auth Schemas
// ============================================

export const createLoginSchema = z.object({
  customerId: uuidSchema,
  password: passwordSchema.optional(),
  sendEmail: z.boolean().default(true),
});

export const userRoleSchema = z.enum([
  'admin',
  'mitarbeiter',
  'superadmin',
  'customer',
  'subcontractor',
  'user',
  'viewer',
]);

// ============================================
// Project Schemas
// ============================================

export const projectIdSchema = z.object({
  id: uuidSchema,
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  customerId: uuidSchema,
  description: z.string().max(5000).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

// ============================================
// Message Schemas
// ============================================

export const createMessageSchema = z.object({
  projectId: uuidSchema,
  text: z.string().min(1).max(10000),
  visibleToCustomer: z.boolean().default(true),
  visibleToPartners: z.boolean().default(true),
  isInternal: z.boolean().default(false),
});

// ============================================
// Customer Schemas
// ============================================

export const createCustomerSchema = z.object({
  companyName: z.string().max(255).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: emailSchema,
  phone: phoneSchema.optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
});

// ============================================
// Partner Schemas
// ============================================

export const createPartnerSchema = z.object({
  companyName: z.string().min(1).max(255),
  email: emailSchema,
  phone: phoneSchema.optional(),
  address: z.string().max(500).optional(),
  trades: z.array(z.string()).optional(),
});

// ============================================
// Query Parameter Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  ...paginationSchema.shape,
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validate data against a schema and return typed result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join('.')}: ${firstError.message}`,
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Validate data and throw if invalid (for use in try-catch blocks)
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const validated = urlSchema.parse(url);
    const parsedUrl = new URL(validated);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    return validated;
  } catch {
    return null;
  }
}

/**
 * Check if value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

/**
 * Check if value is a valid email
 */
export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}
