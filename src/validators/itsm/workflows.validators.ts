import { z } from 'zod';

export const workflowIdParamSchema = z.object({ workflowId: z.string().min(1) });
export const workflowRunIdParamSchema = z.object({ runId: z.string().min(1) });

export const createWorkflowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    moduleKey: z.string().trim().min(1).max(80).optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
    trigger: z.string().trim().min(1).max(80).optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
    definition: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateWorkflowSchema = createWorkflowSchema.partial().strict();

export const publishWorkflowSchema = z
  .object({
    changelog: z.string().max(5000).optional(),
  })
  .strict();

export const createWorkflowRunSchema = z
  .object({
    workflowId: z.string().min(1).nullable().optional(),
    resourceType: z.string().trim().min(1).max(120),
    resourceId: z.string().min(1).nullable().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateWorkflowRunSchema = z
  .object({
    status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    error: z.string().max(10000).nullable().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
