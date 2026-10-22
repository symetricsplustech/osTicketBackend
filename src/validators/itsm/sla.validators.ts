import { z } from "zod";

export const slaPolicyIdParamSchema = z.object({
  slaPolicyId: z.string().min(1),
});
export const escalationRuleIdParamSchema = z.object({
  escalationRuleId: z.string().min(1),
});
export const calendarIdParamSchema = z.object({
  calendarId: z.string().min(1),
});

export const createSlaPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
    serviceLevels: z
      .array(z.record(z.string(), z.unknown()))
      .max(200)
      .optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();
export const updateSlaPolicySchema = createSlaPolicySchema.partial().strict();

export const createEscalationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slaPolicyId: z.string().min(1).nullable().optional(),
    trigger: z.string().trim().min(1).max(120),
    thresholdMinutes: z.number().int().min(0).max(1000000),
    actions: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict();
export const updateEscalationRuleSchema = createEscalationRuleSchema
  .partial()
  .strict();

export const createBusinessCalendarSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    timezone: z.string().trim().min(1).max(80).optional(),
    workingHours: z.record(z.string(), z.unknown()).optional(),
    holidays: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();
export const updateBusinessCalendarSchema = createBusinessCalendarSchema
  .partial()
  .strict();
