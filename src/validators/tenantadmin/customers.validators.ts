import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Code may only contain letters, numbers, dots, underscores and hyphens.",
  );

export const customerIdParamSchema = z.object({
  customerId: z.string().min(1, "Customer identifier is required."),
});

export const customerContactParamsSchema = z.object({
  customerId: z.string().min(1, "Customer identifier is required."),
  contactId: z.string().min(1, "Contact identifier is required."),
});

export const customerSiteParamsSchema = z.object({
  customerId: z.string().min(1, "Customer identifier is required."),
  siteId: z.string().min(1, "Site identifier is required."),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required.").max(200),
  code: codeSchema.optional(),
  type: z.enum(["COMPANY", "INDIVIDUAL"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional(),
  industry: z.string().trim().max(120).optional(),
  website: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .email("A valid email is required.")
    .max(200)
    .optional(),
  description: z.string().trim().max(2000).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(30).optional(),
  country: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(60).optional(),
  slaPolicyId: z.string().min(1).nullable().optional(),
  isDataCenter: z.boolean().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().strict();

export const createContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(120),
  lastName: z.string().trim().min(1, "Last name is required.").max(120),
  email: z.string().trim().email("A valid email is required.").max(200),
  phone: z.string().trim().max(40).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  role: z.enum(["PRIMARY", "TECHNICAL", "BILLING", "AUTHORIZED"]).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateContactSchema = createContactSchema.partial().strict();

export const createSiteSchema = z.object({
  name: z.string().trim().min(1, "Site name is required.").max(160),
  code: codeSchema.optional(),
  siteType: z
    .enum(["SITE", "DATA_CENTER", "OFFICE", "WAREHOUSE", "REMOTE"])
    .optional(),
  isDataCenter: z.boolean().optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(30).optional(),
  country: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(60).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateSiteSchema = createSiteSchema.partial().strict();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
