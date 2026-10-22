import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  assetController,
  assetMaintenanceController,
} from "../../controllers/itsm/assets.controller";
import {
  assetIdParamSchema,
  assetMaintenanceIdParamSchema,
  createAssetMaintenanceSchema,
  createAssetSchema,
  updateAssetMaintenanceSchema,
  updateAssetSchema,
} from "../../validators/itsm/assets.validators";

export const assetsItsmRouter = Router();

// Maintenance routes are registered before the asset CRUD so that the
// `GET /maintenance` list is not shadowed by the generic `GET /:assetId`.
registerItsmCrudRoutes(assetsItsmRouter, assetMaintenanceController, {
  idParam: "maintenanceId",
  basePath: "/maintenance",
  read: "assets.read",
  manage: "assets.manage",
  idSchema: assetMaintenanceIdParamSchema,
  updateSchema: updateAssetMaintenanceSchema,
});
assetsItsmRouter.post(
  "/maintenance/:maintenanceId/complete",
  requireTenantPermission("assets.manage"),
  validateRequest({ params: assetMaintenanceIdParamSchema }),
  assetMaintenanceController.complete,
);

registerItsmCrudRoutes(assetsItsmRouter, assetController, {
  idParam: "assetId",
  read: "assets.read",
  manage: "assets.manage",
  idSchema: assetIdParamSchema,
  createSchema: createAssetSchema,
  updateSchema: updateAssetSchema,
});
assetsItsmRouter.post(
  "/:assetId/assign",
  requireTenantPermission("assets.manage"),
  validateRequest({ params: assetIdParamSchema }),
  assetController.assign,
);
assetsItsmRouter.post(
  "/:assetId/return",
  requireTenantPermission("assets.manage"),
  validateRequest({ params: assetIdParamSchema }),
  assetController.returnAsset,
);
assetsItsmRouter.post(
  "/:assetId/retire",
  requireTenantPermission("assets.manage"),
  validateRequest({ params: assetIdParamSchema }),
  assetController.retire,
);
assetsItsmRouter.get(
  "/:assetId/maintenance",
  requireTenantPermission("assets.read"),
  validateRequest({ params: assetIdParamSchema }),
  assetController.listMaintenance,
);
assetsItsmRouter.post(
  "/:assetId/maintenance",
  requireTenantPermission("assets.manage"),
  validateRequest({
    params: assetIdParamSchema,
    body: createAssetMaintenanceSchema,
  }),
  assetMaintenanceController.createForAsset,
);
