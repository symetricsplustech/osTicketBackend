import { z } from "zod";

export const assetModelIdParamSchema = z.object({
  assetModelId: z.string().min(1),
});
export const assetLicenseIdParamSchema = z.object({
  assetLicenseId: z.string().min(1),
});

export const createAssetModelSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    manufacturer: z.string().trim().max(200).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    description: z.string().max(5000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export const updateAssetModelSchema = createAssetModelSchema.partial().strict();

export const createAssetLicenseSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    vendor: z.string().trim().max(200).nullable().optional(),
    licenseKey: z.string().max(500).nullable().optional(),
    seats: z.number().int().min(0).optional(),
    usedSeats: z.number().int().min(0).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]).optional(),
  })
  .strict();
export const updateAssetLicenseSchema = createAssetLicenseSchema
  .partial()
  .strict();
