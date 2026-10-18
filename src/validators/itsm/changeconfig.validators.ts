import { z } from 'zod';

export const changeTypeIdParamSchema = z.object({ changeTypeId: z.string().min(1) });
export const changeTemplateIdParamSchema = z.object({ changeTemplateId: z.string().min(1) });
export const changeWindowIdParamSchema = z.object({ changeWindowId: z.string().min(1) });

export const createChangeTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().min(1).max(80),
    description: z.string().max(5000).optional(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateChangeTypeSchema = createChangeTypeSchema.partial().strict();

export const createChangeTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    changeTypeId: z.string().min(1).nullable().optional(),
    description: z.string().max(5000).optional(),
    template: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateChangeTemplateSchema = createChangeTemplateSchema.partial().strict();

export const createChangeWindowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    windowType: z.enum(['MAINTENANCE', 'BLACKOUT']).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    recurrence: z.string().max(200).nullable().optional(),
    description: z.string().max(5000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateChangeWindowSchema = createChangeWindowSchema.partial().strict();
