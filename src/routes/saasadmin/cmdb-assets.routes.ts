import { Router } from "express";
import * as cmdbAssetsController from "../../controllers/saasadmin/cmdb-assets.controller";
import {
  authorize,
  tenantContext,
  validateRequest,
} from "../../api/middleware";
import {
  assetCategoryIdParamSchema,
  ciRelationshipTypeIdParamSchema,
  ciTypeIdParamSchema,
  cmdbTenantParamSchema,
  createAssetCategorySchema,
  createCiRelationshipTypeSchema,
  createCiTypeSchema,
  createDiscoveryProfileSchema,
  discoveryProfileIdParamSchema,
  updateAssetCategorySchema,
  updateCiRelationshipTypeSchema,
  updateCiTypeSchema,
  updateDiscoveryProfileSchema,
  updateTenantCmdbConfigurationSchema,
} from "../../validators/saasadmin/cmdb-assets.validators";

export const cmdbAssetsAdminRouter = Router();

cmdbAssetsAdminRouter.get(
  "/ci-types",
  authorize("admin.cmdb-assets.read"),
  cmdbAssetsController.listCiTypesHandler,
);
cmdbAssetsAdminRouter.post(
  "/ci-types",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({ body: createCiTypeSchema }),
  cmdbAssetsController.createCiTypeHandler,
);
cmdbAssetsAdminRouter.get(
  "/ci-types/:typeId",
  authorize("admin.cmdb-assets.read"),
  validateRequest({ params: ciTypeIdParamSchema }),
  cmdbAssetsController.getCiTypeHandler,
);
cmdbAssetsAdminRouter.patch(
  "/ci-types/:typeId",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({ params: ciTypeIdParamSchema, body: updateCiTypeSchema }),
  cmdbAssetsController.updateCiTypeHandler,
);

cmdbAssetsAdminRouter.get(
  "/relationship-types",
  authorize("admin.cmdb-assets.read"),
  cmdbAssetsController.listRelationshipTypesHandler,
);
cmdbAssetsAdminRouter.post(
  "/relationship-types",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({ body: createCiRelationshipTypeSchema }),
  cmdbAssetsController.createRelationshipTypeHandler,
);
cmdbAssetsAdminRouter.patch(
  "/relationship-types/:relationshipTypeId",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({
    params: ciRelationshipTypeIdParamSchema,
    body: updateCiRelationshipTypeSchema,
  }),
  cmdbAssetsController.updateRelationshipTypeHandler,
);

cmdbAssetsAdminRouter.get(
  "/asset-categories",
  authorize("admin.cmdb-assets.read"),
  cmdbAssetsController.listAssetCategoriesHandler,
);
cmdbAssetsAdminRouter.post(
  "/asset-categories",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({ body: createAssetCategorySchema }),
  cmdbAssetsController.createAssetCategoryHandler,
);
cmdbAssetsAdminRouter.patch(
  "/asset-categories/:categoryId",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({
    params: assetCategoryIdParamSchema,
    body: updateAssetCategorySchema,
  }),
  cmdbAssetsController.updateAssetCategoryHandler,
);

cmdbAssetsAdminRouter.get(
  "/discovery-profiles",
  authorize("admin.cmdb-assets.read"),
  cmdbAssetsController.listDiscoveryProfilesHandler,
);
cmdbAssetsAdminRouter.post(
  "/discovery-profiles",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({ body: createDiscoveryProfileSchema }),
  cmdbAssetsController.createDiscoveryProfileHandler,
);
cmdbAssetsAdminRouter.patch(
  "/discovery-profiles/:profileId",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({
    params: discoveryProfileIdParamSchema,
    body: updateDiscoveryProfileSchema,
  }),
  cmdbAssetsController.updateDiscoveryProfileHandler,
);

cmdbAssetsAdminRouter.get(
  "/tenants/:tenantId/configuration",
  authorize("admin.cmdb-assets.read"),
  validateRequest({ params: cmdbTenantParamSchema }),
  tenantContext(),
  cmdbAssetsController.getTenantConfigurationHandler,
);
cmdbAssetsAdminRouter.patch(
  "/tenants/:tenantId/configuration",
  authorize("admin.cmdb-assets.manage"),
  validateRequest({
    params: cmdbTenantParamSchema,
    body: updateTenantCmdbConfigurationSchema,
  }),
  tenantContext(),
  cmdbAssetsController.updateTenantConfigurationHandler,
);
