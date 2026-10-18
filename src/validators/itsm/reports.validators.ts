import { z } from 'zod';

export const reportRunIdParamSchema = z.object({ runId: z.string().min(1) });

export const runReportSchema = z
  .object({
    reportKey: z.string().trim().min(1).max(120),
    format: z.enum(['JSON', 'CSV', 'XLSX', 'PDF']).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
