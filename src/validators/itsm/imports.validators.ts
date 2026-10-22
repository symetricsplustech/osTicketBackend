import { z } from "zod";

export const importJobIdParamSchema = z.object({ jobId: z.string().min(1) });

export const createImportJobSchema = z
  .object({
    resourceType: z.string().trim().min(1).max(120),
    format: z.enum(["CSV", "JSON", "XLSX"]).optional(),
    fileName: z.string().trim().max(300).optional(),
    totalRows: z.number().int().min(0).optional(),
  })
  .strict();
