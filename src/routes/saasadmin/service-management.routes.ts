import { Router } from "express";
import * as serviceManagementController from "../../controllers/saasadmin/service-management.controller";
import {
  authorize,
  tenantContext,
  validateRequest,
} from "../../api/middleware";
import {
  createServiceCategorySchema,
  createServiceDefinitionSchema,
  createServiceTemplateSchema,
  serviceCategoryIdParamSchema,
  serviceDefinitionIdParamSchema,
  serviceManagementTenantParamSchema,
  serviceTemplateIdParamSchema,
  tenantServicesAssignmentSchema,
  updateServiceCategorySchema,
  updateServiceDefinitionSchema,
  updateServiceTemplateSchema,
} from "../../validators/saasadmin/service-management.validators";

export const serviceManagementAdminRouter = Router();

serviceManagementAdminRouter.get(
  "/services",
  authorize("admin.service-management.read"),
  serviceManagementController.listServicesHandler,
);
serviceManagementAdminRouter.post(
  "/services",
  authorize("admin.service-management.manage"),
  validateRequest({ body: createServiceDefinitionSchema }),
  serviceManagementController.createServiceHandler,
);
serviceManagementAdminRouter.get(
  "/services/:serviceId",
  authorize("admin.service-management.read"),
  validateRequest({ params: serviceDefinitionIdParamSchema }),
  serviceManagementController.getServiceHandler,
);
serviceManagementAdminRouter.patch(
  "/services/:serviceId",
  authorize("admin.service-management.manage"),
  validateRequest({
    params: serviceDefinitionIdParamSchema,
    body: updateServiceDefinitionSchema,
  }),
  serviceManagementController.updateServiceHandler,
);
serviceManagementAdminRouter.post(
  "/services/:serviceId/enable",
  authorize("admin.service-management.manage"),
  validateRequest({ params: serviceDefinitionIdParamSchema }),
  serviceManagementController.enableServiceHandler,
);
serviceManagementAdminRouter.post(
  "/services/:serviceId/disable",
  authorize("admin.service-management.manage"),
  validateRequest({ params: serviceDefinitionIdParamSchema }),
  serviceManagementController.disableServiceHandler,
);

serviceManagementAdminRouter.get(
  "/categories",
  authorize("admin.service-management.read"),
  serviceManagementController.listCategoriesHandler,
);
serviceManagementAdminRouter.post(
  "/categories",
  authorize("admin.service-management.manage"),
  validateRequest({ body: createServiceCategorySchema }),
  serviceManagementController.createCategoryHandler,
);
serviceManagementAdminRouter.patch(
  "/categories/:categoryId",
  authorize("admin.service-management.manage"),
  validateRequest({
    params: serviceCategoryIdParamSchema,
    body: updateServiceCategorySchema,
  }),
  serviceManagementController.updateCategoryHandler,
);
serviceManagementAdminRouter.delete(
  "/categories/:categoryId",
  authorize("admin.service-management.manage"),
  validateRequest({ params: serviceCategoryIdParamSchema }),
  serviceManagementController.deleteCategoryHandler,
);

serviceManagementAdminRouter.get(
  "/templates",
  authorize("admin.service-management.read"),
  serviceManagementController.listTemplatesHandler,
);
serviceManagementAdminRouter.post(
  "/templates",
  authorize("admin.service-management.manage"),
  validateRequest({ body: createServiceTemplateSchema }),
  serviceManagementController.createTemplateHandler,
);
serviceManagementAdminRouter.get(
  "/templates/:templateId/versions",
  authorize("admin.service-management.read"),
  validateRequest({ params: serviceTemplateIdParamSchema }),
  serviceManagementController.listTemplateVersionsHandler,
);
serviceManagementAdminRouter.get(
  "/templates/:templateId",
  authorize("admin.service-management.read"),
  validateRequest({ params: serviceTemplateIdParamSchema }),
  serviceManagementController.getTemplateHandler,
);
serviceManagementAdminRouter.patch(
  "/templates/:templateId",
  authorize("admin.service-management.manage"),
  validateRequest({
    params: serviceTemplateIdParamSchema,
    body: updateServiceTemplateSchema,
  }),
  serviceManagementController.updateTemplateHandler,
);
serviceManagementAdminRouter.post(
  "/templates/:templateId/publish",
  authorize("admin.service-management.manage"),
  validateRequest({ params: serviceTemplateIdParamSchema }),
  serviceManagementController.publishTemplateHandler,
);

serviceManagementAdminRouter.put(
  "/tenants/:tenantId/services",
  authorize("admin.service-management.manage"),
  validateRequest({
    params: serviceManagementTenantParamSchema,
    body: tenantServicesAssignmentSchema,
  }),
  tenantContext(),
  serviceManagementController.replaceTenantServicesHandler,
);
