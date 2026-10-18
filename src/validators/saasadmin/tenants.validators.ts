import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'Tenant name must be at least 2 characters.').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Slug must contain only lowercase letters, numbers and hyphens.')
    .optional(),
  primaryContactName: z.string().trim().max(120).optional(),
  primaryContactEmail: z.string().trim().email('A valid contact email is required.').optional(),
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
  industry: z.string().trim().max(120).optional(),
  website: z.string().trim().url('Website must be a valid URL.').optional(),
  notes: z.string().trim().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  primaryContactName: z.string().trim().max(120).nullable().optional(),
  primaryContactEmail: z.string().trim().email().nullable().optional(),
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const suspendTenantSchema = z.object({
  reason: z.string().trim().min(4, 'A suspension reason is required.').max(500),
});

export const archiveTenantSchema = z.object({
  reason: z.string().trim().min(4, 'An archival reason is required.').max(500),
});

export const tenantIdParamSchema = z.object({
  tenantId: z.string().min(1, 'Tenant identifier is required.'),
});

export const impersonationSchema = z.object({
  reason: z.string().trim().min(8, 'A detailed support-access reason is required.').max(500),
  userId: z.string().min(1).optional(),
  expiresInMinutes: z.number().int().min(5).max(120).optional().default(30),
});

export const createTenantUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required.').max(320),
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128).optional(),
  roleKeys: z.array(z.string().trim().min(1)).max(20).optional(),
  jobTitle: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;
export type ArchiveTenantInput = z.infer<typeof archiveTenantSchema>;
export type ImpersonationInput = z.infer<typeof impersonationSchema>;
export type CreateTenantUserInput = z.infer<typeof createTenantUserSchema>;
