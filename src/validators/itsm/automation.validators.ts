import { z } from "zod";

export const automationRuleIdParamSchema = z.object({
  ruleId: z.string().min(1),
});
export const automationRunIdParamSchema = z.object({
  runId: z.string().min(1),
});

export const createAutomationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    moduleKey: z.string().trim().min(1).max(80).optional(),
    trigger: z.enum(["event", "schedule", "manual"]).optional(),
    eventKey: z.string().trim().min(1).max(160).nullable().optional(),
    schedule: z.string().trim().max(120).nullable().optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
    actions: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
    isEnabled: z.boolean().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
  })
  .strict();
export const updateAutomationRuleSchema = createAutomationRuleSchema
  .partial()
  .strict();

export const runAutomationSchema = z
  .object({
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
