import { z } from "zod";

export const settingKeyParamSchema = z.object({
  key: z.string().min(3).max(120),
});

export const updateSettingSchema = z.object({
  value: z.unknown(),
});

export const updateBrandingSchema = z.object({
  platformName: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().trim().url().nullable().optional(),
  faviconUrl: z.string().trim().url().nullable().optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      "Primary colour must be a hex value like #2563eb.",
    )
    .optional(),
});

export const updateLocalizationSchema = z.object({
  defaultTimezone: z.string().trim().max(60).optional(),
  defaultLocale: z.string().trim().max(20).optional(),
  dateFormat: z.enum(["ISO", "US", "EU", "LONG"]).optional(),
});

const passwordPolicySchema = z.object({
  minLength: z.number().int().min(8).max(128).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireSymbol: z.boolean().optional(),
  maxAgeDays: z.number().int().min(0).max(3650).optional(),
});

export const updateSecuritySchema = z.object({
  passwordPolicy: passwordPolicySchema.optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  requireMfaForStaff: z.boolean().optional(),
  ipAllowlist: z
    .array(
      z
        .string()
        .trim()
        .regex(
          /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/,
          "Entries must be IPv4/IPv6 addresses or CIDR ranges.",
        ),
    )
    .max(200)
    .optional(),
});

export const updateRetentionSchema = z.object({
  policies: z
    .array(
      z.object({
        resourceKey: z.string().trim().min(2).max(120),
        retentionDays: z.number().int().min(1).max(36500),
        action: z.enum(["DELETE", "ARCHIVE"]),
        isEnabled: z.boolean().optional().default(true),
      }),
    )
    .min(1),
});

export const updateFeatureFlagSchema = z.object({
  isEnabled: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  rules: z.record(z.unknown()).nullable().optional(),
});

export const featureFlagKeyParamSchema = z.object({
  flagKey: z.string().min(2).max(120),
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
export type UpdateLocalizationInput = z.infer<typeof updateLocalizationSchema>;
export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>;
export type UpdateRetentionInput = z.infer<typeof updateRetentionSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
