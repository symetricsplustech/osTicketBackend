import { z } from "zod";

export const catalogCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1, "Catalog category identifier is required."),
});

export const catalogItemIdParamSchema = z.object({
  itemId: z.string().min(1, "Catalog item identifier is required."),
});

const nullableId = z.string().min(1).nullable().optional();
const STATUS_VALUES = ["DRAFT", "PUBLISHED", "RETIRED", "INACTIVE"] as const;

export const createCatalogCategorySchema = z
  .object({
    name: z.string().trim().min(1, "Category name is required.").max(160),
    description: z.string().trim().max(2000).optional(),
    parentId: nullableId,
    sortOrder: z.number().int().min(0).optional(),
    icon: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
  })
  .strict();

export const updateCatalogCategorySchema = createCatalogCategorySchema
  .partial()
  .strict();

export const catalogItemSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be kebab-case (lowercase letters, numbers and hyphens).",
  );

export const createCatalogItemSchema = z
  .object({
    name: z.string().trim().min(1, "Item name is required.").max(200),
    slug: catalogItemSlugSchema.optional(),
    categoryId: nullableId,
    shortDescription: z.string().trim().max(500).optional(),
    description: z.string().trim().max(20000).optional(),
    itemType: z.enum(["SERVICE", "GOODS"]).optional(),
    price: z.number().min(0).nullable().optional(),
    currency: z.string().trim().length(3).optional(),
    fulfillmentTeamId: nullableId,
    approvalRequired: z.boolean().optional(),
    formSchema: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .strict();

export const updateCatalogItemSchema = createCatalogItemSchema
  .partial()
  .strict();

export const publishCatalogItemSchema = z
  .object({
    status: z.string().trim().max(40).optional(),
  })
  .strict();

export const retireCatalogItemSchema = z.object({
  status: z.string().trim().max(40).optional(),
});

export type CreateCatalogCategoryInput = z.infer<
  typeof createCatalogCategorySchema
>;
export type UpdateCatalogCategoryInput = z.infer<
  typeof updateCatalogCategorySchema
>;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export const CATALOG_STATUS_VALUES = STATUS_VALUES;
