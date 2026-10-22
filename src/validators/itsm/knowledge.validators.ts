import { z } from "zod";

export const knowledgeCategoryIdParamSchema = z.object({
  categoryId: z.string().min(1),
});
export const knowledgeArticleIdParamSchema = z.object({
  articleId: z.string().min(1),
});

const optionalId = z.string().min(1).nullable().optional();

export const createKnowledgeCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    parentId: optionalId,
    sortOrder: z.number().int().min(0).optional(),
    status: z.string().trim().max(40).optional(),
  })
  .strict();
export const updateKnowledgeCategorySchema = createKnowledgeCategorySchema
  .partial()
  .strict();

export const createKnowledgeArticleSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().max(2000).optional(),
    body: z.string().max(100000).optional(),
    categoryId: optionalId,
    status: z.string().trim().max(40).optional(),
    visibility: z.enum(["INTERNAL", "PORTAL"]).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    authorId: optionalId,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateKnowledgeArticleSchema = createKnowledgeArticleSchema
  .partial()
  .strict();

export const createKnowledgeCommentSchema = z
  .object({
    body: z.string().trim().min(1).max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();

export const updateKnowledgeSettingsSchema = z
  .object({
    defaultVisibility: z.enum(["INTERNAL", "PORTAL"]).optional(),
    requireReviewBeforePublish: z.boolean().optional(),
    allowInternalComments: z.boolean().optional(),
    enableFeedback: z.boolean().optional(),
    enableVersioning: z.boolean().optional(),
    reviewIntervalDays: z.number().int().min(0).max(3650).optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export type UpdateKnowledgeSettingsInput = z.infer<
  typeof updateKnowledgeSettingsSchema
>;
