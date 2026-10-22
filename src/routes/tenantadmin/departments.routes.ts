import { Router } from "express";
import { departmentController } from "../../controllers/tenantadmin/departments.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  createDepartmentSchema,
  departmentIdParamSchema,
  updateDepartmentSchema,
} from "../../validators/tenantadmin/departments.validators";

export const departmentsTenantRouter = Router();

departmentsTenantRouter.get(
  "/",
  requireTenantPermission("departments.read"),
  departmentController.list,
);
departmentsTenantRouter.post(
  "/",
  requireTenantPermission("departments.manage"),
  validateRequest({ body: createDepartmentSchema }),
  departmentController.create,
);
departmentsTenantRouter.get(
  "/:departmentId",
  requireTenantPermission("departments.read"),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.get,
);
departmentsTenantRouter.patch(
  "/:departmentId",
  requireTenantPermission("departments.manage"),
  validateRequest({
    params: departmentIdParamSchema,
    body: updateDepartmentSchema,
  }),
  departmentController.update,
);
departmentsTenantRouter.delete(
  "/:departmentId",
  requireTenantPermission("departments.manage"),
  validateRequest({ params: departmentIdParamSchema }),
  departmentController.remove,
);
