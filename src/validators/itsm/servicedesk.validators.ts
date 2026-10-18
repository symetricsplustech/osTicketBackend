import { z } from 'zod';

export const queueIdParamSchema = z.object({ queueId: z.string().min(1) });
export const operatingHoursIdParamSchema = z.object({ operatingHoursId: z.string().min(1) });
export const routingRuleIdParamSchema = z.object({ routingRuleId: z.string().min(1) });

export const createQueueSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320).nullable().optional(),
    description: z.string().max(5000).optional(),
    operatingHoursId: z.string().min(1).nullable().optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateQueueSchema = createQueueSchema.partial().strict();

export const createOperatingHoursSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    timezone: z.string().trim().min(1).max(80).optional(),
    schedule: z.record(z.string(), z.unknown()).optional(),
    holidays: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();
export const updateOperatingHoursSchema = createOperatingHoursSchema.partial().strict();

export const createRoutingRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    queueId: z.string().min(1).nullable().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
    actions: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();
export const updateRoutingRuleSchema = createRoutingRuleSchema.partial().strict();
