import { z } from 'zod';

export const announcementIdParamSchema = z.object({ announcementId: z.string().min(1) });

export const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    body: z.string().max(50000).optional(),
    type: z.enum(['INFO', 'WARNING', 'MAINTENANCE', 'OUTAGE', 'SUCCESS']).optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED']).optional(),
    audience: z.enum(['ALL', 'STAFF', 'REQUESTERS']).optional(),
    pinned: z.boolean().optional(),
    publishAt: z.coerce.date().nullable().optional(),
    expireAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateAnnouncementSchema = createAnnouncementSchema.partial().strict();
