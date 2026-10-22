import { z } from "zod";

export const addDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "Domain is required.")
    .max(253)
    .regex(
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
      "Enter a valid fully-qualified domain name (for example portal.example.com).",
    ),
  type: z.enum(["CUSTOM", "SUBDOMAIN"]).optional().default("CUSTOM"),
});

export const domainIdsParamSchema = z.object({
  tenantId: z.string().min(1),
  domainId: z.string().min(1),
});

export type AddDomainInput = z.infer<typeof addDomainSchema>;
