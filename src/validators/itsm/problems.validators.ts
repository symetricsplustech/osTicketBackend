import { z } from 'zod';

export const problemIdParamSchema = z.object({
  problemId: z.string().min(1, 'Problem identifier is required.'),
});

const nullableId = z.string().min(1).nullable().optional();
const IMPACT_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const impactSchema = z.enum(IMPACT_VALUES);

export const createProblemSchema = z
  .object({
    title: z.string().trim().min(1, 'Problem title is required.').max(240),
    description: z.string().trim().max(20000).optional(),
    statusKey: z.string().trim().max(60).optional(),
    priorityKey: z.string().trim().max(60).optional(),
    impact: impactSchema.optional(),
    categoryId: nullableId,
    assigneeId: nullableId,
    teamId: nullableId,
    rootCause: z.string().trim().max(20000).optional(),
    workaround: z.string().trim().max(20000).optional(),
    isKnownError: z.boolean().optional(),
  })
  .strict();

export const updateProblemSchema = createProblemSchema.partial().extend({
  resolutionNotes: z.string().trim().max(20000).nullable().optional(),
}).strict();

export const assignProblemSchema = z
  .object({
    assigneeId: z.string().min(1).nullable().optional(),
    teamId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const resolveProblemSchema = z
  .object({
    resolutionNotes: z.string().trim().min(1, 'Resolution notes are required.').max(20000),
    rootCause: z.string().trim().max(20000).optional(),
    isKnownError: z.boolean().optional(),
  })
  .strict();

export const createProblemCommentSchema = z
  .object({
    body: z.string().trim().min(1, 'Comment body is required.').max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;
export type AssignProblemInput = z.infer<typeof assignProblemSchema>;
export type ResolveProblemInput = z.infer<typeof resolveProblemSchema>;
export type CreateProblemCommentInput = z.infer<typeof createProblemCommentSchema>;
