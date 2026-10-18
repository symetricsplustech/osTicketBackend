import { z } from 'zod';

export const incidentCategoryIdParamSchema = z.object({ categoryId: z.string().min(1) });
export const incidentPriorityIdParamSchema = z.object({ priorityId: z.string().min(1) });
export const resolutionCodeIdParamSchema = z.object({ resolutionCodeId: z.string().min(1) });

export const createIncidentCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().min(1).max(80),
    description: z.string().max(5000).optional(),
    parentId: z.string().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();
export const updateIncidentCategorySchema = createIncidentCategorySchema.partial().strict();

export const createIncidentPrioritySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    key: z.string().trim().min(1).max(80),
    level: z.number().int().min(1).max(10).optional(),
    responseMinutes: z.number().int().min(0).nullable().optional(),
    resolveMinutes: z.number().int().min(0).nullable().optional(),
    color: z.string().trim().max(40).nullable().optional(),
    description: z.string().max(2000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateIncidentPrioritySchema = createIncidentPrioritySchema.partial().strict();

export const createResolutionCodeSchema = z
  .object({
    code: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateResolutionCodeSchema = createResolutionCodeSchema.partial().strict();
