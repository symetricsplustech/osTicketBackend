import { z } from "zod";

const apiKeyScopesSchema = z
  .array(z.string().trim().min(1, "Scope codes cannot be empty."))
  .min(1, "At least one scope is required.")
  .max(100, "A maximum of 100 scopes may be assigned.");

export const apiKeyIdParamSchema = z.object({
  keyId: z.string().min(1, "API key identifier is required."),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "API key name must be at least 2 characters.")
    .max(120),
  scopes: apiKeyScopesSchema,
  tenantId: z.string().min(1).optional(),
  expiresInDays: z
    .number()
    .int()
    .min(1, "Expiry must be at least 1 day.")
    .max(730, "Expiry cannot exceed 730 days.")
    .optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  scopes: apiKeyScopesSchema.optional(),
  expiresAt: z.coerce
    .date()
    .refine(
      (value) => !Number.isNaN(value.getTime()) && value.getTime() > Date.now(),
      "Expiry must be a future date.",
    )
    .optional(),
});

export const revokeApiKeySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;
