import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('A valid email address is required.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Reset token is required.'),
  password: z.string().min(1, 'New password is required.').max(256),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.').max(256),
  newPassword: z.string().min(1, 'New password is required.').max(256),
});

export const emailChangeRequestSchema = z.object({
  newEmail: z.string().trim().email('A valid email address is required.'),
});

export const emailChangeConfirmSchema = z.object({
  token: z.string().min(20, 'Confirmation token is required.'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;
export type EmailChangeConfirmInput = z.infer<typeof emailChangeConfirmSchema>;
