import { z } from 'zod';

export const ciIdParamSchema = z.object({ ciId: z.string().min(1) });
export const ciRelationshipIdParamSchema = z.object({ relationshipId: z.string().min(1) });

const optionalId = z.string().min(1).nullable().optional();

export const createCiSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    ciTypeKey: z.string().trim().max(80).optional(),
    status: z.string().trim().max(40).optional(),
    criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    environment: z.string().trim().max(40).optional(),
    ownerId: optionalId,
    supportTeamId: optionalId,
    serialNumber: z.string().trim().max(160).optional(),
    assetTag: z.string().trim().max(160).optional(),
    ipAddress: z.string().trim().max(64).optional(),
    hostname: z.string().trim().max(200).optional(),
    locationId: optionalId,
    attributes: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  })
  .strict();
export const updateCiSchema = createCiSchema.partial().strict();

export const createCiRelationshipSchema = z
  .object({
    sourceCiId: z.string().min(1),
    targetCiId: z.string().min(1),
    typeKey: z.string().trim().max(80).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();
export const updateCiRelationshipSchema = createCiRelationshipSchema.partial().strict();
