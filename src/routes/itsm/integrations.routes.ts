import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { integrationController } from '../../controllers/itsm/integrations.controller';
import {
  createIntegrationSchema,
  integrationIdParamSchema,
  updateIntegrationSchema,
} from '../../validators/itsm/integrations.validators';

export const integrationsItsmRouter = Router();

integrationsItsmRouter.get('/', requireTenantPermission('integrations.read'), integrationController.list);
integrationsItsmRouter.post(
  '/',
  requireTenantPermission('integrations.manage'),
  validateRequest({ body: createIntegrationSchema }),
  integrationController.create,
);
integrationsItsmRouter.get(
  '/:integrationId',
  requireTenantPermission('integrations.read'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.get,
);
integrationsItsmRouter.patch(
  '/:integrationId',
  requireTenantPermission('integrations.manage'),
  validateRequest({ params: integrationIdParamSchema, body: updateIntegrationSchema }),
  integrationController.update,
);
integrationsItsmRouter.delete(
  '/:integrationId',
  requireTenantPermission('integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.remove,
);
integrationsItsmRouter.post(
  '/:integrationId/test',
  requireTenantPermission('integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.test,
);
integrationsItsmRouter.post(
  '/:integrationId/enable',
  requireTenantPermission('integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.enable,
);
integrationsItsmRouter.post(
  '/:integrationId/disable',
  requireTenantPermission('integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.disable,
);
integrationsItsmRouter.get(
  '/:integrationId/logs',
  requireTenantPermission('integrations.read'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationController.listLogs,
);
