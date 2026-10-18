import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('A valid email address is required.'),
  password: z.string().min(1, 'Password is required.').max(256),
  rememberMe: z.boolean().optional().default(false),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token is required.'),
});

export const invitationAcceptSchema = z.object({
  token: z.string().min(20, 'Invitation token is required.'),
  password: z.string().min(1, 'Password is required.').max(256),
});

export const switchTenantSchema = z.object({
  tenantId: z.string().min(1, 'A tenant identifier is required.').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
