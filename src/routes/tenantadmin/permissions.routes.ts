import { Router } from "express";
import * as permissionsController from "../../controllers/tenantadmin/permissions.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { tenantPermissionIdParamSchema } from "../../validators/tenantadmin/permissions.validators";

export const permissionsTenantRouter = Router();

permissionsTenantRouter.get(
  "/",
  requireTenantPermission("permissions.read"),
  permissionsController.listPermissionsHandler,
);
permissionsTenantRouter.get(
  "/groups",
  requireTenantPermission("permissions.read"),
  permissionsController.permissionGroups,
);
permissionsTenantRouter.get(
  "/:permissionId",
  requireTenantPermission("permissions.read"),
  validateRequest({ params: tenantPermissionIdParamSchema }),
  permissionsController.getPermissionHandler,
);
