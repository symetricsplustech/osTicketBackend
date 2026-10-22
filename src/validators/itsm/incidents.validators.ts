import { z } from "zod";

export const incidentIdParamSchema = z.object({
  incidentId: z.string().min(1, "Incident identifier is required."),
});

const nullableId = z.string().min(1).nullable().optional();

export const IMPACT_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const impactSchema = z.enum(IMPACT_VALUES);

export const createIncidentSchema = z
  .object({
    title: z.string().trim().min(1, "Incident title is required.").max(240),
    description: z.string().trim().max(20000).optional(),
    statusKey: z.string().trim().max(60).optional(),
    priorityKey: z.string().trim().max(60).optional(),
    impact: impactSchema.optional(),
    urgency: impactSchema.optional(),
    categoryId: nullableId,
    source: z.string().trim().max(60).optional(),
    channel: z.string().trim().max(60).optional(),
    callerId: nullableId,
    assigneeId: nullableId,
    teamId: nullableId,
    departmentId: nullableId,
    locationId: nullableId,
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    dueAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateIncidentSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    statusKey: z.string().trim().max(60).optional(),
    priorityKey: z.string().trim().max(60).optional(),
    impact: impactSchema.optional(),
    urgency: impactSchema.optional(),
    categoryId: nullableId,
    source: z.string().trim().max(60).optional(),
    channel: z.string().trim().max(60).nullable().optional(),
    callerId: nullableId,
    teamId: nullableId,
    departmentId: nullableId,
    locationId: nullableId,
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    dueAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const assignIncidentSchema = z
  .object({
    assigneeId: z.string().min(1).nullable().optional(),
    teamId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const escalateIncidentSchema = z
  .object({
    priorityKey: z.string().trim().max(60).optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export const resolveIncidentSchema = z
  .object({
    resolutionNotes: z
      .string()
      .trim()
      .min(1, "Resolution notes are required.")
      .max(20000),
    resolutionCode: z.string().trim().max(80).optional(),
  })
  .strict();

export const reopenIncidentSchema = z
  .object({
    reason: z.string().trim().max(2000).optional(),
  })
  .strict();

export const createIncidentCommentSchema = z
  .object({
    body: z.string().trim().min(1, "Comment body is required.").max(20000),
    isInternal: z.boolean().optional(),
  })
  .strict();

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type AssignIncidentInput = z.infer<typeof assignIncidentSchema>;
export type EscalateIncidentInput = z.infer<typeof escalateIncidentSchema>;
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;
export type ReopenIncidentInput = z.infer<typeof reopenIncidentSchema>;
export type CreateIncidentCommentInput = z.infer<
  typeof createIncidentCommentSchema
>;
