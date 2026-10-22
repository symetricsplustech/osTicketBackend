import { z } from "zod";

export const majorIncidentIdParamSchema = z.object({
  majorIncidentId: z.string().min(1),
});

const optionalId = z.string().min(1).nullable().optional();

export const createMajorIncidentSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(50000).optional(),
    status: z
      .enum(["DECLARED", "INVESTIGATING", "MONITORING", "RESOLVED", "CLOSED"])
      .optional(),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
    incidentId: optionalId,
    commanderId: optionalId,
    impactSummary: z.string().max(20000).optional(),
    communicationPlan: z.string().max(20000).optional(),
    startedAt: z.coerce.date().nullable().optional(),
    resolvedAt: z.coerce.date().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateMajorIncidentSchema = createMajorIncidentSchema
  .partial()
  .strict();
