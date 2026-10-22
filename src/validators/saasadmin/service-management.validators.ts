import { z } from "zod";

export const serviceKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Key must contain only lowercase letters, numbers and hyphens.",
  );

export const createServiceDefinitionSchema = z.object({
  key: serviceKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Service name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  icon: z.string().trim().max(200).optional(),
  owner: z.string().trim().max(160).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateServiceDefinitionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Service name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  icon: z.string().trim().max(200).nullable().optional(),
  owner: z.string().trim().max(160).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const serviceDefinitionIdParamSchema = z.object({
  serviceId: z.string().min(1, "Service identifier is required."),
});

export const createServiceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(0),
});

export const updateServiceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const serviceCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1, "Category identifier is required."),
});

export const templateDefinitionSchema = z
  .record(z.unknown())
  .refine(
    (value) => Object.keys(value).length > 0,
    "Template definition must contain at least one key.",
  );

export const createServiceTemplateSchema = z.object({
  key: serviceKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Template name must be at least 2 characters.")
    .max(160),
  description: z.string().trim().max(2000).optional(),
  serviceId: z.string().min(1).nullable().optional(),
  definition: templateDefinitionSchema,
});

export const updateServiceTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Template name must be at least 2 characters.")
    .max(160)
    .optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  serviceId: z.string().min(1).nullable().optional(),
  definition: templateDefinitionSchema.optional(),
});

export const serviceTemplateIdParamSchema = z.object({
  templateId: z.string().min(1, "Template identifier is required."),
});

export const tenantServicesAssignmentSchema = z.object({
  serviceIds: z
    .array(z.string().min(1))
    .max(500, "At most 500 services can be assigned at once."),
});

export const serviceManagementTenantParamSchema = z.object({
  tenantId: z.string().min(1, "Tenant identifier is required."),
});

export type CreateServiceDefinitionInput = z.infer<
  typeof createServiceDefinitionSchema
>;
export type UpdateServiceDefinitionInput = z.infer<
  typeof updateServiceDefinitionSchema
>;
export type CreateServiceCategoryInput = z.infer<
  typeof createServiceCategorySchema
>;
export type UpdateServiceCategoryInput = z.infer<
  typeof updateServiceCategorySchema
>;
export type CreateServiceTemplateInput = z.infer<
  typeof createServiceTemplateSchema
>;
export type UpdateServiceTemplateInput = z.infer<
  typeof updateServiceTemplateSchema
>;
export type TenantServicesAssignmentInput = z.infer<
  typeof tenantServicesAssignmentSchema
>;
