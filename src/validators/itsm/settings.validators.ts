import { z } from "zod";

export const settingKeyParamSchema = z.object({
  key: z.string().min(1).max(200),
});
export const portalFormKeyParamSchema = z.object({
  formKey: z.string().min(1).max(200),
});
export const customFieldIdParamSchema = z.object({
  fieldId: z.string().min(1),
});

export const settingValueSchema = z.object({}).passthrough();

export const createCustomFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    key: z.string().trim().min(1).max(120),
    resourceType: z.string().trim().min(1).max(80),
    fieldType: z
      .enum([
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "DATE",
        "BOOLEAN",
        "SELECT",
        "MULTISELECT",
        "USER",
        "URL",
        "EMAIL",
      ])
      .optional(),
    options: z.array(z.unknown()).optional(),
    isRequired: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateCustomFieldSchema = createCustomFieldSchema
  .partial()
  .strict();
