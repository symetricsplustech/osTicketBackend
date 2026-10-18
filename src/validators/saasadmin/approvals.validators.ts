import { z } from 'zod';

export const createApprovalPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  actionScope: z.string().trim().min(2).max(120),
  conditions: z
    .object({
      tenantIds: z.array(z.string()).optional(),
      resourceTypes: z.array(z.string()).optional(),
    })
    .optional(),
  approverRoleIds: z.array(z.string().min(1)).min(1, 'At least one approver role is required.'),
  minApprovals: z.number().int().min(1).max(10).optional().default(1),
  isEnabled: z.boolean().optional().default(true),
});

export const updateApprovalPolicySchema = createApprovalPolicySchema.partial();

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

export const rejectApprovalSchema = z.object({
  reason: z.string().trim().min(4, 'A rejection reason is required.').max(500),
});

export const approvalRequestIdParamSchema = z.object({
  requestId: z.string().min(1),
});

export const approvalPolicyIdParamSchema = z.object({
  policyId: z.string().min(1),
});

export type CreateApprovalPolicyInput = z.infer<typeof createApprovalPolicySchema>;
export type UpdateApprovalPolicyInput = z.infer<typeof updateApprovalPolicySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
