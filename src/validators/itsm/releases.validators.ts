import { z } from 'zod';

export const releaseIdParamSchema = z.object({ releaseId: z.string().min(1) });

const optionalId = z.string().min(1).nullable().optional();

export const createReleaseSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    version: z.string().trim().max(80).optional(),
    type: z.enum(['STANDARD', 'MAJOR', 'MINOR', 'EMERGENCY', 'ROUTINE']).optional(),
    status: z.string().trim().max(40).optional(),
    description: z.string().max(50000).optional(),
    plannedStartAt: z.coerce.date().nullable().optional(),
    plannedEndAt: z.coerce.date().nullable().optional(),
    actualStartAt: z.coerce.date().nullable().optional(),
    actualEndAt: z.coerce.date().nullable().optional(),
    ownerId: optionalId,
    teamId: optionalId,
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateReleaseSchema = createReleaseSchema.partial().strict();
