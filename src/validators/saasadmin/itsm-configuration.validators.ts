import { z } from 'zod';

export const itsmKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    'Key must contain only lowercase letters, numbers and hyphens.',
  );

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color must be a hex value such as #ff8800.');

export const itsmModuleKeySchema = z.string().trim().min(1, 'Module key is required.').max(80);

export const itsmModuleKeyParamSchema = z.object({
  moduleKey: itsmModuleKeySchema,
});

export const updateItsmModuleSchema = z.object({
  name: z.string().trim().min(2, 'Module name must be at least 2 characters.').max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isEnabled: z.boolean().optional(),
  defaultSettings: z.record(z.unknown()).optional(),
});

export const priorityIdParamSchema = z.object({
  priorityId: z.string().min(1, 'Priority identifier is required.'),
});

export const createPrioritySchema = z.object({
  key: itsmKeySchema,
  name: z.string().trim().min(2, 'Priority name must be at least 2 characters.').max(120),
  rank: z.number().int().positive('Rank must be a positive integer.'),
  color: hexColorSchema.optional(),
  isDefault: z.boolean().optional().default(false),
  settings: z.record(z.unknown()).optional(),
});

export const updatePrioritySchema = z.object({
  name: z.string().trim().min(2, 'Priority name must be at least 2 characters.').max(120).optional(),
  rank: z.number().int().positive('Rank must be a positive integer.').optional(),
  color: hexColorSchema.nullable().optional(),
  isDefault: z.boolean().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
});

export const statusCategorySchema = z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']);

export const statusIdParamSchema = z.object({
  statusId: z.string().min(1, 'Status identifier is required.'),
});

export const createStatusSchema = z.object({
  key: z.string().trim().min(1, 'Status key is required.').max(80),
  name: z.string().trim().min(2, 'Status name must be at least 2 characters.').max(120),
  moduleKey: itsmModuleKeySchema.optional().default('global'),
  category: statusCategorySchema,
  color: hexColorSchema.optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
  isDefault: z.boolean().optional().default(false),
});

export const updateStatusSchema = z.object({
  name: z.string().trim().min(2, 'Status name must be at least 2 characters.').max(120).optional(),
  category: statusCategorySchema.optional(),
  color: hexColorSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isDefault: z.boolean().optional(),
});

export const classificationCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1, 'Category identifier is required.'),
});

export const createClassificationCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters.').max(160),
  description: z.string().trim().max(2000).optional(),
  moduleKey: itsmModuleKeySchema.optional().default('global'),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export const updateClassificationCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters.').max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

export const numberingRuleIdParamSchema = z.object({
  ruleId: z.string().min(1, 'Numbering rule identifier is required.'),
});

export const numberingResetPolicySchema = z.enum(['NEVER', 'YEARLY', 'MONTHLY', 'DAILY']);

export const updateNumberingRuleSchema = z.object({
  prefix: z.string().trim().min(1, 'Prefix is required.').max(20).optional(),
  suffix: z.string().trim().max(20).nullable().optional(),
  padding: z
    .number()
    .int()
    .min(1, 'Padding must be an integer between 1 and 12.')
    .max(12, 'Padding must be an integer between 1 and 12.')
    .optional(),
  nextNumber: z.number().int().min(1, 'Next number must be at least 1.').optional(),
  resetPolicy: numberingResetPolicySchema.optional(),
  isActive: z.boolean().optional(),
});

export const itsmTenantParamSchema = z.object({
  tenantId: z.string().min(1, 'Tenant identifier is required.'),
});

export const updateTenantItsmConfigurationSchema = z.object({
  moduleKey: itsmModuleKeySchema,
  overrides: z.record(z.unknown()),
});

export type UpdateItsmModuleInput = z.infer<typeof updateItsmModuleSchema>;
export type CreatePriorityInput = z.infer<typeof createPrioritySchema>;
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateClassificationCategoryInput = z.infer<typeof createClassificationCategorySchema>;
export type UpdateClassificationCategoryInput = z.infer<typeof updateClassificationCategorySchema>;
export type UpdateNumberingRuleInput = z.infer<typeof updateNumberingRuleSchema>;
export type UpdateTenantItsmConfigurationInput = z.infer<typeof updateTenantItsmConfigurationSchema>;
