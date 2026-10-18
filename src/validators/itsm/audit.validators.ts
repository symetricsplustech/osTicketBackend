import { z } from 'zod';

export const auditEventIdParamSchema = z.object({ eventId: z.string().min(1) });
export const auditResourceParamSchema = z.object({ resourceType: z.string().min(1), resourceId: z.string().min(1) });

export const auditExportSchema = z
  .object({
    action: z.string().trim().max(200).optional(),
    resourceType: z.string().trim().max(200).optional(),
    actorId: z.string().min(1).optional(),
    outcome: z.string().trim().max(40).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();
