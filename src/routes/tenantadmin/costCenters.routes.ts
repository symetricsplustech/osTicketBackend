import { Router } from "express";
import { costCenterController } from "../../controllers/tenantadmin/costCenters.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  costCenterIdParamSchema,
  createCostCenterSchema,
  updateCostCenterSchema,
} from "../../validators/tenantadmin/costCenters.validators";

export const costCentersTenantRouter = Router();

costCentersTenantRouter.get(
  "/",
  requireTenantPermission("cost_centers.read"),
  costCenterController.list,
);
costCentersTenantRouter.post(
  "/",
  requireTenantPermission("cost_centers.manage"),
  validateRequest({ body: createCostCenterSchema }),
  costCenterController.create,
);
costCentersTenantRouter.get(
  "/:costCenterId",
  requireTenantPermission("cost_centers.read"),
  validateRequest({ params: costCenterIdParamSchema }),
  costCenterController.get,
);
costCentersTenantRouter.patch(
  "/:costCenterId",
  requireTenantPermission("cost_centers.manage"),
  validateRequest({
    params: costCenterIdParamSchema,
    body: updateCostCenterSchema,
  }),
  costCenterController.update,
);
costCentersTenantRouter.delete(
  "/:costCenterId",
  requireTenantPermission("cost_centers.manage"),
  validateRequest({ params: costCenterIdParamSchema }),
  costCenterController.remove,
);
