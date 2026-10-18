import { z } from 'zod';

const codeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9._-]+$/, 'Code may only contain letters, numbers, dots, underscores and hyphens.');

export const departmentIdParamSchema = z.object({
  departmentId: z.string().min(1, 'Department identifier is required.'),
});

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required.').max(160),
  code: codeSchema.optional(),
  description: z.string().trim().max(1000).optional(),
  parentId: z.string().min(1).nullable().optional(),
  managerId: z.string().min(1).nullable().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().strict();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
