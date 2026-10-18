import { Router } from 'express';
import * as itsmConfigurationController from '../../controllers/saasadmin/itsm-configuration.controller';
import { authorize, tenantContext, validateRequest } from '../../api/middleware';
import {
  classificationCategoryIdParamSchema,
  createClassificationCategorySchema,
  createPrioritySchema,
  createStatusSchema,
  itsmModuleKeyParamSchema,
  itsmTenantParamSchema,
  numberingRuleIdParamSchema,
  priorityIdParamSchema,
  statusIdParamSchema,
  updateClassificationCategorySchema,
  updateItsmModuleSchema,
  updateNumberingRuleSchema,
  updatePrioritySchema,
  updateStatusSchema,
  updateTenantItsmConfigurationSchema,
} from '../../validators/saasadmin/itsm-configuration.validators';

export const itsmConfigurationAdminRouter = Router();

itsmConfigurationAdminRouter.get(
  '/modules',
  authorize('admin.itsm-configuration.read'),
  itsmConfigurationController.listModulesHandler,
);
itsmConfigurationAdminRouter.get(
  '/modules/:moduleKey',
  authorize('admin.itsm-configuration.read'),
  validateRequest({ params: itsmModuleKeyParamSchema }),
  itsmConfigurationController.getModuleHandler,
);
itsmConfigurationAdminRouter.patch(
  '/modules/:moduleKey',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: itsmModuleKeyParamSchema, body: updateItsmModuleSchema }),
  itsmConfigurationController.updateModuleHandler,
);

itsmConfigurationAdminRouter.get(
  '/priorities',
  authorize('admin.itsm-configuration.read'),
  itsmConfigurationController.listPrioritiesHandler,
);
itsmConfigurationAdminRouter.post(
  '/priorities',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ body: createPrioritySchema }),
  itsmConfigurationController.createPriorityHandler,
);
itsmConfigurationAdminRouter.patch(
  '/priorities/:priorityId',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: priorityIdParamSchema, body: updatePrioritySchema }),
  itsmConfigurationController.updatePriorityHandler,
);

itsmConfigurationAdminRouter.get(
  '/statuses',
  authorize('admin.itsm-configuration.read'),
  itsmConfigurationController.listStatusesHandler,
);
itsmConfigurationAdminRouter.post(
  '/statuses',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ body: createStatusSchema }),
  itsmConfigurationController.createStatusHandler,
);
itsmConfigurationAdminRouter.patch(
  '/statuses/:statusId',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: statusIdParamSchema, body: updateStatusSchema }),
  itsmConfigurationController.updateStatusHandler,
);

itsmConfigurationAdminRouter.get(
  '/categories',
  authorize('admin.itsm-configuration.read'),
  itsmConfigurationController.listCategoriesHandler,
);
itsmConfigurationAdminRouter.post(
  '/categories',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ body: createClassificationCategorySchema }),
  itsmConfigurationController.createCategoryHandler,
);
itsmConfigurationAdminRouter.patch(
  '/categories/:categoryId',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: classificationCategoryIdParamSchema, body: updateClassificationCategorySchema }),
  itsmConfigurationController.updateCategoryHandler,
);

itsmConfigurationAdminRouter.get(
  '/numbering-rules',
  authorize('admin.itsm-configuration.read'),
  itsmConfigurationController.listNumberingRulesHandler,
);
itsmConfigurationAdminRouter.patch(
  '/numbering-rules/:ruleId',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: numberingRuleIdParamSchema, body: updateNumberingRuleSchema }),
  itsmConfigurationController.updateNumberingRuleHandler,
);

itsmConfigurationAdminRouter.get(
  '/tenants/:tenantId/configuration',
  authorize('admin.itsm-configuration.read'),
  validateRequest({ params: itsmTenantParamSchema }),
  tenantContext(),
  itsmConfigurationController.getTenantConfigurationHandler,
);
itsmConfigurationAdminRouter.patch(
  '/tenants/:tenantId/configuration',
  authorize('admin.itsm-configuration.manage'),
  validateRequest({ params: itsmTenantParamSchema, body: updateTenantItsmConfigurationSchema }),
  tenantContext(),
  itsmConfigurationController.updateTenantConfigurationHandler,
);
