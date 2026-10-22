import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Code may only contain letters, numbers, dots, underscores and hyphens.",
  );

export const locationIdParamSchema = z.object({
  locationId: z.string().min(1, "Location identifier is required."),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required.").max(160),
  code: codeSchema.optional(),
  type: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(30).optional(),
  timezone: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(40).optional(),
});

export const updateLocationSchema = createLocationSchema.partial().strict();

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
