import { z } from 'zod';

export const serviceRequestIdParamSchema = z.object({
  requestId: z.string().min(1, 'Service request identifier is required.'),
});

const nullableId = z.string().min(1).nullable().optional();

export const createServiceRequestSchema = z
  .object({
    title: z.string().trim().min(1, 'Request title is required.').max(240),
    description: z.string().trim().max(20000).optional(),
    statusKey: z.string().trim().max(60).optional(),
    priorityKey: z.string().trim().max(60).optional(),
    catalogItemId: nullableId,
    requestedForId: nullableId,
    assigneeId: nullableId,
    teamId: nullableId,
  })
  .strict();

export const updateServiceRequestSchema = createServiceRequestSchema.partial().strict();

export const assignServiceRequestSchema = z
  .object({
    assigneeId: z.string().min(1).nullable().optional(),
    teamId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const decideServiceRequestSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const fulfillServiceRequestSchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const cancelServiceRequestSchema = z
  .object({
    reason: z.string().trim().min(1, 'A cancellation reason is required.').max(2000),
  })
  .strict();

export const createServiceRequestCommentSchema = z
  .object({
    body: z.string().trim().min(1, 'Comment body is required.').max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;
export type AssignServiceRequestInput = z.infer<typeof assignServiceRequestSchema>;
export type DecideServiceRequestInput = z.infer<typeof decideServiceRequestSchema>;
export type FulfillServiceRequestInput = z.infer<typeof fulfillServiceRequestSchema>;
export type CancelServiceRequestInput = z.infer<typeof cancelServiceRequestSchema>;
export type CreateServiceRequestCommentInput = z.infer<typeof createServiceRequestCommentSchema>;
