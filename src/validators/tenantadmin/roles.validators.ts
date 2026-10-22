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

export const createTenantRoleSchema = z.object({
  key: roleKeySchema,
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters.")
    .max(120),
  description: z.string().trim().max(1000).optional(),
  permissionCodes: z.array(z.string().min(1)).optional().default([]),
});

export const updateTenantRoleSchema = z.object({
  key: roleKeySchema.optional(),
  name: z
    .string()
    .trim()
    .min(2, "Role name must be at least 2 characters.")
    .max(120)
    .optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const setTenantRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1)).default([]),
});

export const tenantRoleIdParamSchema = z.object({
  roleId: z.string().min(1, "Role identifier is required."),
});

export const addRoleMembersSchema = z
  .object({
    membershipIds: z.array(z.string().min(1)).max(500).optional(),
    userIds: z.array(z.string().min(1)).max(500).optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.membershipIds?.length ?? 0) > 0 ||
      (value.userIds?.length ?? 0) > 0,
    { message: "Provide at least one membershipId or userId." },
  );

export const roleMemberParamSchema = z.object({
  roleId: z.string().min(1, "Role identifier is required."),
  membershipId: z.string().min(1, "Membership identifier is required."),
});

export type CreateTenantRoleInput = z.infer<typeof createTenantRoleSchema>;
export type UpdateTenantRoleInput = z.infer<typeof updateTenantRoleSchema>;
export type SetTenantRolePermissionsInput = z.infer<
  typeof setTenantRolePermissionsSchema
>;
export type AddRoleMembersInput = z.infer<typeof addRoleMembersSchema>;
