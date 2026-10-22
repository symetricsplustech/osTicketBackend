import { z } from "zod";

export const assetIdParamSchema = z.object({ assetId: z.string().min(1) });
export const assetMaintenanceIdParamSchema = z.object({
  maintenanceId: z.string().min(1),
});

const optionalId = z.string().min(1).nullable().optional();
const assetStatus = z.enum([
  "IN_STOCK",
  "ASSIGNED",
  "IN_REPAIR",
  "RETIRED",
  "LOST",
  "DISPOSED",
]);

export const createAssetSchema = z
  .object({
    assetTag: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(300),
    categoryKey: z.string().trim().max(80).optional(),
    status: assetStatus.optional(),
    condition: z.string().trim().max(40).optional(),
    serialNumber: z.string().trim().max(160).optional(),
    model: z.string().trim().max(160).optional(),
    manufacturer: z.string().trim().max(160).optional(),
    purchaseDate: z.coerce.date().nullable().optional(),
    warrantyExpiry: z.coerce.date().nullable().optional(),
    cost: z.number().min(0).nullable().optional(),
    currency: z.string().trim().length(3).optional(),
    assignedToId: optionalId,
    locationId: optionalId,
    ciId: optionalId,
    vendorId: optionalId,
    notes: z.string().max(20000).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateAssetSchema = createAssetSchema.partial().strict();

export const createAssetMaintenanceSchema = z
  .object({
    kind: z.string().trim().max(60).optional(),
    status: z.string().trim().max(40).optional(),
    summary: z.string().trim().min(1).max(300),
    description: z.string().max(20000).optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
    cost: z.number().min(0).nullable().optional(),
    performedById: optionalId,
  })
  .strict();
export const updateAssetMaintenanceSchema = createAssetMaintenanceSchema
  .partial()
  .strict();
