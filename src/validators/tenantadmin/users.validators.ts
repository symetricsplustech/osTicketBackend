import { z } from 'zod';

export const tenantUserIdParamSchema = z.object({
  userId: z.string().min(1, 'User identifier is required.'),
});

export const tenantInvitationIdParamSchema = z.object({
  invitationId: z.string().min(1, 'Invitation identifier is required.'),
});

export const inviteTenantUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  jobTitle: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  roleIds: z.array(z.string().min(1)).optional().default([]),
});

export const updateTenantUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    jobTitle: z.string().trim().max(160).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    timezone: z.string().trim().max(64).optional(),
    locale: z.string().trim().max(16).optional(),
  })
  .strict();

export const setTenantUserRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).default([]),
});

export const tenantUserStatusReasonSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const importUserRowSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(120),
  lastName: z.string().trim().min(1, 'Last name is required.').max(120),
  jobTitle: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  roleIds: z.array(z.string().min(1)).max(50).optional(),
});

export const importTenantUsersSchema = z
  .object({
    users: z.array(importUserRowSchema).min(1, 'At least one user is required.').max(1000),
    defaultRoleIds: z.array(z.string().min(1)).max(50).optional(),
    sendInvitations: z.boolean().optional(),
  })
  .strict();

export type InviteTenantUserInput = z.infer<typeof inviteTenantUserSchema>;
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;
export type SetTenantUserRolesInput = z.infer<typeof setTenantUserRolesSchema>;
export type TenantUserStatusReasonInput = z.infer<typeof tenantUserStatusReasonSchema>;
export type ImportUserRowInput = z.infer<typeof importUserRowSchema>;
export type ImportTenantUsersInput = z.infer<typeof importTenantUsersSchema>;
