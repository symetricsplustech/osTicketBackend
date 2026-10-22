import { z } from "zod";

export const accessPolicyIdParamSchema = z.object({
  policyId: z.string().min(1),
});
export const accessPolicyAssignmentIdParamSchema = z.object({
  assignmentId: z.string().min(1),
});
export const delegationIdParamSchema = z.object({
  delegationId: z.string().min(1),
});
export const accessReviewIdParamSchema = z.object({
  reviewId: z.string().min(1),
});
export const accessReviewItemIdParamSchema = z.object({
  itemId: z.string().min(1),
});

export const createAccessPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    policyType: z.string().trim().min(1).max(80).optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
    priority: z.number().int().min(0).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();
export const updateAccessPolicySchema = createAccessPolicySchema
  .partial()
  .strict();

export const createAccessPolicyAssignmentSchema = z
  .object({
    subjectType: z.string().trim().min(1).max(80),
    subjectId: z.string().min(1),
  })
  .strict();

export const createDelegationSchema = z
  .object({
    delegatorId: z.string().min(1),
    delegateeId: z.string().min(1),
    scope: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().max(2000).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
  })
  .strict();
export const updateDelegationSchema = createDelegationSchema.partial().strict();

export const createAccessReviewSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    scope: z.string().trim().min(1).max(80).optional(),
    dueAt: z.coerce.date().nullable().optional(),
  })
  .strict();
export const updateAccessReviewSchema = createAccessReviewSchema
  .partial()
  .strict();

export const createAccessReviewItemSchema = z
  .object({
    subjectType: z.string().trim().min(1).max(80),
    subjectId: z.string().min(1),
  })
  .strict();

export const decideAccessReviewItemSchema = z
  .object({
    decision: z.enum(["APPROVED", "REVOKED"]),
    notes: z.string().max(2000).optional(),
  })
  .strict();
