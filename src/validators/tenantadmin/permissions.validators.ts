import { z } from "zod";

export const tenantPermissionIdParamSchema = z.object({
  permissionId: z.string().min(1, "Permission identifier is required."),
});
