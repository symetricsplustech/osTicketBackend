import { Router } from "express";
import * as permissionsController from "../../controllers/saasadmin/permissions.controller";
import { authorize, validateRequest } from "../../api/middleware";
import { permissionIdParamSchema } from "../../validators/saasadmin/permissions.validators";

export const permissionsAdminRouter = Router();

permissionsAdminRouter.get(
  "/",
  authorize("admin.permissions.read"),
  permissionsController.listPermissionsHandler,
);
permissionsAdminRouter.get(
  "/groups",
  authorize("admin.permissions.read"),
  permissionsController.permissionGroups,
);
permissionsAdminRouter.get(
  "/:permissionId",
  authorize("admin.permissions.read"),
  validateRequest({ params: permissionIdParamSchema }),
  permissionsController.getPermissionHandler,
);
