import { z } from "zod";

const roleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(63)
  .regex(
    /^[a-z0-9](-?[a-z0-9])*$/,
    "Role key must be a lowercase slug containing letters, numbers and single hyphens.",
  );

export const createRoleSchema = z.object({
  key: roleKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters.")
    .max(120),
  description: z.string().trim().max(1000).optional(),
  permissionCodes: z.array(z.string().min(1)).optional().default([]),
});

export const updateRoleSchema = z.object({
  key: roleKeySchema.optional(),
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters.")
    .max(120)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const setRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1)).default([]),
});

export const roleIdParamSchema = z.object({
  roleId: z.string().min(1, "Role identifier is required."),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
