import { z } from 'zod';

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Key must be at least 2 characters.')
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Key must contain only lowercase letters, numbers and hyphens.');

const integrationConfigSchema = z
  .record(z.unknown())
  .refine((value) => Object.keys(value).length > 0, 'Configuration must contain at least one key.');

export const integrationIdParamSchema = z.object({
  integrationId: z.string().min(1, 'Integration identifier is required.'),
});

export const createIntegrationSchema = z.object({
  key: slugField,
  name: z.string().trim().min(2, 'Integration name must be at least 2 characters.').max(120),
  provider: z.string().trim().min(2, 'Provider is required.').max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(80).optional(),
  config: integrationConfigSchema.optional(),
  isEnabled: z.boolean().optional().default(false),
});

export const updateIntegrationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(80).optional(),
  config: integrationConfigSchema.optional(),
  isEnabled: z.boolean().optional(),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
