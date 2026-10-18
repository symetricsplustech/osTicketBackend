import { z } from 'zod';

export const auditEventIdParamSchema = z.object({
  eventId: z.string().min(1),
});

export const resourceHistoryQuerySchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const auditExportSchema = z.object({
  format: z.enum(['CSV', 'JSON']).default('CSV'),
  filters: z
    .object({
      action: z.string().optional(),
      resourceType: z.string().optional(),
      tenantId: z.string().optional(),
      actorId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  reason: z.string().trim().min(4).max(500),
});

export type AuditExportInput = z.infer<typeof auditExportSchema>;
