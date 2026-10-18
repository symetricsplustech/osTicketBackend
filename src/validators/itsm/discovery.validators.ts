import { z } from 'zod';

export const discoveryRunIdParamSchema = z.object({ runId: z.string().min(1) });
export const discoveryResultIdParamSchema = z.object({ resultId: z.string().min(1) });

export const createDiscoveryRunSchema = z
  .object({
    profileKey: z.string().trim().max(120).optional(),
    name: z.string().trim().max(200).optional(),
    mode: z.enum(['AGENTLESS', 'AGENT_BASED', 'MANUAL']).optional(),
  })
  .strict();

export const updateDiscoveryResultSchema = z
  .object({
    status: z.string().trim().max(40).optional(),
    action: z.enum(['REVIEW', 'CREATE', 'UPDATE', 'IGNORE']).optional(),
    matchedCiId: z.string().min(1).nullable().optional(),
  })
  .strict();
