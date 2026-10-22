import { z } from "zod";

export const problemCategoryIdParamSchema = z.object({
  problemCategoryId: z.string().min(1),
});
export const rootCauseCategoryIdParamSchema = z.object({
  rootCauseCategoryId: z.string().min(1),
});

export const createProblemCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().min(1).max(80),
    description: z.string().max(5000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateProblemCategorySchema = createProblemCategorySchema
  .partial()
  .strict();

export const createRootCauseCategorySchema = createProblemCategorySchema;
export const updateRootCauseCategorySchema = createProblemCategorySchema
  .partial()
  .strict();
