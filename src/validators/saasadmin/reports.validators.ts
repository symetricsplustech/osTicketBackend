import { z } from 'zod';

export const runReportSchema = z.object({
  reportKey: z.string().trim().min(2).max(120),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(5000).optional().default(1000),
});

export const exportReportSchema = z.object({
  reportKey: z.string().trim().min(2).max(120),
  format: z.enum(['CSV', 'JSON']).default('CSV'),
  filters: z.record(z.unknown()).optional(),
  reason: z.string().trim().min(4).max(500),
});

export const reportRunIdParamSchema = z.object({
  runId: z.string().min(1),
});

export const exportIdParamSchema = z.object({
  exportId: z.string().min(1),
});

export type RunReportInput = z.infer<typeof runReportSchema>;
export type ExportReportInput = z.infer<typeof exportReportSchema>;
