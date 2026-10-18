import { z } from 'zod';

export const attachmentIdParamSchema = z.object({ attachmentId: z.string().min(1) });

export const createAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    filename: z.string().trim().min(1).max(300),
    mimeType: z.string().trim().min(1).max(200),
    size: z.number().int().min(0).max(1_000_000_000),
    storageKey: z.string().trim().min(1).max(1000),
    resourceType: z.string().trim().min(1).max(120).nullable().optional(),
    resourceId: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
