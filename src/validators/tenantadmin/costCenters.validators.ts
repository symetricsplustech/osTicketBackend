import { z } from 'zod';

const codeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, 'Code may only contain letters, numbers, dots, underscores and hyphens.');

export const costCenterIdParamSchema = z.object({
  costCenterId: z.string().min(1, 'Cost center identifier is required.'),
});

export const createCostCenterSchema = z.object({
  name: z.string().trim().min(1, 'Cost center name is required.').max(160),
  code: codeSchema.optional(),
  description: z.string().trim().max(1000).optional(),
});

export const updateCostCenterSchema = createCostCenterSchema.partial().strict();

export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
