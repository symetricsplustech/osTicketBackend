import { z } from 'zod';

export const knownErrorIdParamSchema = z.object({ knownErrorId: z.string().min(1) });

const optionalId = z.string().min(1).nullable().optional();

export const createKnownErrorSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(50000).optional(),
    status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'ARCHIVED']).optional(),
    problemId: optionalId,
    workaround: z.string().max(20000).optional(),
    rootCause: z.string().max(20000).optional(),
    resolvedAt: z.coerce.date().nullable().optional(),
    ownerId: optionalId,
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateKnownErrorSchema = createKnownErrorSchema.partial().strict();
