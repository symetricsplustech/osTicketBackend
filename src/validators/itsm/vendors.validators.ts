import { z } from "zod";

export const vendorIdParamSchema = z.object({ vendorId: z.string().min(1) });

export const createVendorSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    code: z.string().trim().min(1).max(80).nullable().optional(),
    type: z
      .enum(["SUPPLIER", "MANUFACTURER", "PARTNER", "CONTRACTOR", "OTHER"])
      .optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "PROSPECT", "BLACKLISTED"])
      .optional(),
    contactName: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(60).optional(),
    website: z.string().trim().url().max(500).optional(),
    addressLine1: z.string().trim().max(300).optional(),
    addressLine2: z.string().trim().max(300).optional(),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(120).optional(),
    postalCode: z.string().trim().max(40).optional(),
    country: z.string().trim().max(120).optional(),
    rating: z.number().int().min(0).max(5).nullable().optional(),
    notes: z.string().max(50000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const updateVendorSchema = createVendorSchema.partial().strict();
