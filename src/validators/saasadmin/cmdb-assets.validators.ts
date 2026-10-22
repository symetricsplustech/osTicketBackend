import { z } from "zod";

export const cmdbKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Key must contain only lowercase letters, numbers and hyphens.",
  );

export const ciFieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "reference",
  "enum",
]);

export const ciFieldSchema = z
  .object({
    key: z.string().trim().min(1, "Field key is required.").max(120),
    label: z.string().trim().min(1, "Field label is required.").max(200),
    type: ciFieldTypeSchema,
    required: z.boolean().optional(),
    options: z
      .array(z.string().trim().min(1, "Options must be non-empty strings."))
      .optional(),
    referenceType: z
      .string()
      .trim()
      .min(1, "Reference type must be a non-empty string.")
      .optional(),
  })
  .superRefine((field, ctx) => {
    if (
      field.type === "enum" &&
      (!field.options || field.options.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Enum fields require at least one option.",
      });
    }
    if (field.type === "reference" && !field.referenceType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceType"],
        message: "Reference fields require a referenceType.",
      });
    }
  });

export const ciFieldsSchema = z
  .array(ciFieldSchema)
  .min(1, "At least one field definition is required.")
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      const normalised = field.key.trim().toLowerCase();
      if (seen.has(normalised)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "key"],
          message: `Duplicate field key "${field.key}".`,
        });
      }
      seen.add(normalised);
    });
  });

export const ciTypeIdParamSchema = z.object({
  typeId: z.string().min(1, "CI type identifier is required."),
});

export const createCiTypeSchema = z.object({
  key: cmdbKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "CI type name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  icon: z.string().trim().max(200).optional(),
  fields: ciFieldsSchema,
});

export const updateCiTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "CI type name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(200).nullable().optional(),
  fields: ciFieldsSchema.optional(),
  isActive: z.boolean().optional(),
});

export const ciRelationshipTypeIdParamSchema = z.object({
  relationshipTypeId: z
    .string()
    .min(1, "Relationship type identifier is required."),
});

export const createCiRelationshipTypeSchema = z.object({
  key: cmdbKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Relationship type name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  sourceTypeKey: z.string().trim().min(1).nullable().optional(),
  targetTypeKey: z.string().trim().min(1).nullable().optional(),
  isDirectional: z.boolean().optional().default(true),
});

export const updateCiRelationshipTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Relationship type name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  sourceTypeKey: z.string().trim().min(1).nullable().optional(),
  targetTypeKey: z.string().trim().min(1).nullable().optional(),
  isDirectional: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const assetCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1, "Asset category identifier is required."),
});

export const createAssetCategorySchema = z.object({
  key: cmdbKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Asset category name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  depreciation: z.string().trim().max(120).optional(),
});

export const updateAssetCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Asset category name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  depreciation: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const discoveryProfileIdParamSchema = z.object({
  profileId: z.string().min(1, "Discovery profile identifier is required."),
});

export const discoveryModeSchema = z.enum([
  "AGENT",
  "AGENTLESS",
  "NETWORK_SCAN",
]);

export const createDiscoveryProfileSchema = z.object({
  key: cmdbKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Discovery profile name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  mode: discoveryModeSchema,
  schedule: z.string().trim().max(120).optional(),
  credentialsRef: z.string().trim().max(200).optional(),
  settings: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional().default(true),
});

export const updateDiscoveryProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Discovery profile name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  mode: discoveryModeSchema.optional(),
  schedule: z.string().trim().max(120).nullable().optional(),
  credentialsRef: z.string().trim().max(200).nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export const cmdbTenantParamSchema = z.object({
  tenantId: z.string().min(1, "Tenant identifier is required."),
});

export const updateTenantCmdbConfigurationSchema = z.object({
  settings: z.record(z.unknown()),
});

export type CiFieldInput = z.infer<typeof ciFieldSchema>;
export type CreateCiTypeInput = z.infer<typeof createCiTypeSchema>;
export type UpdateCiTypeInput = z.infer<typeof updateCiTypeSchema>;
export type CreateCiRelationshipTypeInput = z.infer<
  typeof createCiRelationshipTypeSchema
>;
export type UpdateCiRelationshipTypeInput = z.infer<
  typeof updateCiRelationshipTypeSchema
>;
export type CreateAssetCategoryInput = z.infer<
  typeof createAssetCategorySchema
>;
export type UpdateAssetCategoryInput = z.infer<
  typeof updateAssetCategorySchema
>;
export type CreateDiscoveryProfileInput = z.infer<
  typeof createDiscoveryProfileSchema
>;
export type UpdateDiscoveryProfileInput = z.infer<
  typeof updateDiscoveryProfileSchema
>;
export type UpdateTenantCmdbConfigurationInput = z.infer<
  typeof updateTenantCmdbConfigurationSchema
>;
