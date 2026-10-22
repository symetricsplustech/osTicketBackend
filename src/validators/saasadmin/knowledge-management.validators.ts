import { z } from "zod";

export const knowledgeKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Key must contain only lowercase letters, numbers and hyphens.",
  );

export const knowledgeTemplateStatusSchema = z.enum([
  "DRAFT",
  "ENABLED",
  "DISABLED",
]);

export const knowledgeReviewActionSchema = z.enum([
  "REVIEW",
  "EXPIRE",
  "NOTIFY",
]);

export const knowledgeFieldsSchema = z.union([
  z.record(z.unknown()),
  z.array(z.unknown()),
]);

export const policyIdParamSchema = z.object({
  policyId: z.string().min(1, "Policy identifier is required."),
});

export const createKnowledgePolicySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Policy name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  settings: z.record(z.unknown()),
  isEnabled: z.boolean().optional().default(true),
});

export const updateKnowledgePolicySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Policy name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

export const knowledgeCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1, "Category identifier is required."),
});

export const createKnowledgeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export const updateKnowledgeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const knowledgeTemplateIdParamSchema = z.object({
  templateId: z.string().min(1, "Template identifier is required."),
});

export const createKnowledgeTemplateSchema = z.object({
  key: knowledgeKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Template name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  body: z.string().min(1, "Template body must not be empty."),
  fields: knowledgeFieldsSchema.optional(),
  status: knowledgeTemplateStatusSchema.optional().default("DRAFT"),
});

export const updateKnowledgeTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Template name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  body: z.string().min(1, "Template body must not be empty.").optional(),
  fields: knowledgeFieldsSchema.nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  status: knowledgeTemplateStatusSchema.optional(),
});

export const knowledgeReviewRuleIdParamSchema = z.object({
  ruleId: z.string().min(1, "Review rule identifier is required."),
});

export const createKnowledgeReviewRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Rule name must be at least 2 characters.")
      .max(160),
    categoryId: z.string().min(1).nullable().optional(),
    intervalDays: z
      .number()
      .int()
      .positive("Interval days must be a positive integer."),
    notifyBeforeDays: z
      .number()
      .int()
      .min(0, "Notify-before days must be zero or greater.")
      .optional()
      .default(7),
    action: knowledgeReviewActionSchema.optional().default("REVIEW"),
    isEnabled: z.boolean().optional().default(true),
  })
  .refine((value) => value.notifyBeforeDays < value.intervalDays, {
    message: "Notify-before days must be smaller than the review interval.",
    path: ["notifyBeforeDays"],
  });

export const updateKnowledgeReviewRuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Rule name must be at least 2 characters.")
      .max(160)
      .optional(),
    categoryId: z.string().min(1).nullable().optional(),
    intervalDays: z
      .number()
      .int()
      .positive("Interval days must be a positive integer.")
      .optional(),
    notifyBeforeDays: z
      .number()
      .int()
      .min(0, "Notify-before days must be zero or greater.")
      .optional(),
    action: knowledgeReviewActionSchema.optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.intervalDays === undefined ||
      value.notifyBeforeDays === undefined ||
      value.notifyBeforeDays < value.intervalDays,
    {
      message: "Notify-before days must be smaller than the review interval.",
      path: ["notifyBeforeDays"],
    },
  );

export const knowledgeTenantParamSchema = z.object({
  tenantId: z.string().min(1, "Tenant identifier is required."),
});

export const updateKnowledgeTenantSettingsSchema = z.object({
  settings: z.record(z.unknown()),
});

export type CreateKnowledgePolicyInput = z.infer<
  typeof createKnowledgePolicySchema
>;
export type UpdateKnowledgePolicyInput = z.infer<
  typeof updateKnowledgePolicySchema
>;
export type CreateKnowledgeCategoryInput = z.infer<
  typeof createKnowledgeCategorySchema
>;
export type UpdateKnowledgeCategoryInput = z.infer<
  typeof updateKnowledgeCategorySchema
>;
export type CreateKnowledgeTemplateInput = z.infer<
  typeof createKnowledgeTemplateSchema
>;
export type UpdateKnowledgeTemplateInput = z.infer<
  typeof updateKnowledgeTemplateSchema
>;
export type CreateKnowledgeReviewRuleInput = z.infer<
  typeof createKnowledgeReviewRuleSchema
>;
export type UpdateKnowledgeReviewRuleInput = z.infer<
  typeof updateKnowledgeReviewRuleSchema
>;
export type UpdateKnowledgeTenantSettingsInput = z.infer<
  typeof updateKnowledgeTenantSettingsSchema
>;
export type KnowledgeTemplateStatus = z.infer<
  typeof knowledgeTemplateStatusSchema
>;
export type KnowledgeReviewAction = z.infer<typeof knowledgeReviewActionSchema>;
