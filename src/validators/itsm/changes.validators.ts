import { z } from "zod";

export const changeIdParamSchema = z.object({
  changeId: z.string().min(1, "Change identifier is required."),
});

const nullableId = z.string().min(1).nullable().optional();
const IMPACT_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const impactSchema = z.enum(IMPACT_VALUES);

export const createChangeSchema = z
  .object({
    title: z.string().trim().min(1, "Change title is required.").max(240),
    description: z.string().trim().max(20000).optional(),
    statusKey: z.string().trim().max(60).optional(),
    priorityKey: z.string().trim().max(60).optional(),
    changeTypeKey: z.string().trim().max(60).optional(),
    riskKey: z.string().trim().max(60).optional(),
    impact: impactSchema.optional(),
    categoryId: nullableId,
    assigneeId: nullableId,
    teamId: nullableId,
    requestedById: nullableId,
    implementationPlan: z.string().trim().max(20000).optional(),
    rollbackPlan: z.string().trim().max(20000).optional(),
    testPlan: z.string().trim().max(20000).optional(),
    plannedStartAt: z.coerce.date().nullable().optional(),
    plannedEndAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export const updateChangeSchema = createChangeSchema.partial().strict();

export const assignChangeSchema = z
  .object({
    assigneeId: z.string().min(1).nullable().optional(),
    teamId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const decideChangeSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const implementChangeSchema = z
  .object({
    actualStartAt: z.coerce.date().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const completeChangeSchema = z
  .object({
    actualEndAt: z.coerce.date().optional(),
    close: z.boolean().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const rollbackChangeSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "A rollback reason is required.")
      .max(2000),
  })
  .strict();

export const createChangeCommentSchema = z
  .object({
    body: z.string().trim().min(1, "Comment body is required.").max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();

export type CreateChangeInput = z.infer<typeof createChangeSchema>;
export type UpdateChangeInput = z.infer<typeof updateChangeSchema>;
export type AssignChangeInput = z.infer<typeof assignChangeSchema>;
export type DecideChangeInput = z.infer<typeof decideChangeSchema>;
export type ImplementChangeInput = z.infer<typeof implementChangeSchema>;
export type CompleteChangeInput = z.infer<typeof completeChangeSchema>;
export type RollbackChangeInput = z.infer<typeof rollbackChangeSchema>;
export type CreateChangeCommentInput = z.infer<
  typeof createChangeCommentSchema
>;
