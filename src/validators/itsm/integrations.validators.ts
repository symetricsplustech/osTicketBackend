import { z } from 'zod';

export const integrationIdParamSchema = z.object({ integrationId: z.string().min(1) });

export const createIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    provider: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(5000).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();

export const updateIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().max(5000).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();
