import { z } from 'zod';

export const apiKeyIdParamSchema = z.object({ apiKeyId: z.string().min(1) });

export const createApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    scopes: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const updateApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    scopes: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const revokeApiKeySchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();
