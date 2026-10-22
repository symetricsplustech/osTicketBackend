import { z } from "zod";

export const permissionIdParamSchema = z.object({
  permissionId: z.string().min(1, "Permission identifier is required."),
});

export type PermissionIdParams = z.infer<typeof permissionIdParamSchema>;
