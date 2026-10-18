import { z } from 'zod';

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const serviceKeyParamSchema = z.object({
  serviceKey: z.string().min(2).max(60),
});

export const updateMaintenanceSchema = z.object({
  enabled: z.boolean().optional(),
  message: z.string().trim().max(500).optional(),
  allowedIps: z
    .array(
      z
        .string()
        .trim()
        .regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/, 'Entries must be IPv4/IPv6 addresses or CIDR ranges.'),
    )
    .max(200)
    .optional(),
});

export type UpdateMaintenanceInput = z.infer<typeof updateMaintenanceSchema>;
