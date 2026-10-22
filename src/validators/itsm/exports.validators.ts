import { z } from "zod";

export const exportJobIdParamSchema = z.object({ jobId: z.string().min(1) });

export const runExportSchema = z
  .object({
    resourceKey: z.string().trim().min(1).max(120),
    format: z.enum(["CSV", "JSON", "XLSX", "PDF"]).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
