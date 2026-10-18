import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
});

export const updatePreferencesSchema = z.object({
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  emailNotifications: z.boolean().optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  landingPage: z.string().trim().max(120).optional(),
});

export const sessionParamSchema = z.object({
  sessionId: z.string().min(1),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
