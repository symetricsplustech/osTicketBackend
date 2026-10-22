import { z } from "zod";

export const approvalPolicyIdParamSchema = z.object({
  policyId: z.string().min(1),
});
export const approvalRequestIdParamSchema = z.object({
  requestId: z.string().min(1),
});

export const createApprovalPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    actionScope: z.string().trim().min(1).max(120),
    conditions: z.record(z.string(), z.unknown()).optional(),
    approverRoleIds: z.array(z.string().min(1)).max(50).optional(),
    minApprovals: z.number().int().min(1).max(50).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict();
export const updateApprovalPolicySchema = createApprovalPolicySchema
  .partial()
  .strict();

export const createApprovalRequestSchema = z
  .object({
    actionKey: z.string().trim().min(1).max(160),
    resourceType: z.string().trim().min(1).max(120),
    resourceId: z.string().min(1).nullable().optional(),
    policyId: z.string().min(1).nullable().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().max(5000).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .strict();
export const updateApprovalRequestSchema = createApprovalRequestSchema
  .partial()
  .strict();

export const decideApprovalSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().max(5000).optional(),
  })
  .strict();
