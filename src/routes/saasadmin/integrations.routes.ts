import { Router } from 'express';
import * as integrationsController from '../../controllers/saasadmin/integrations.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  createIntegrationSchema,
  integrationIdParamSchema,
  updateIntegrationSchema,
} from '../../validators/saasadmin/integrations.validators';

export const integrationsAdminRouter = Router();

integrationsAdminRouter.get('/', authorize('admin.integrations.read'), integrationsController.listIntegrationsHandler);
integrationsAdminRouter.post(
  '/',
  authorize('admin.integrations.manage'),
  validateRequest({ body: createIntegrationSchema }),
  integrationsController.createIntegrationHandler,
);
integrationsAdminRouter.get(
  '/:integrationId',
  authorize('admin.integrations.read'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationsController.getIntegrationHandler,
);
integrationsAdminRouter.patch(
  '/:integrationId',
  authorize('admin.integrations.manage'),
  validateRequest({ params: integrationIdParamSchema, body: updateIntegrationSchema }),
  integrationsController.updateIntegrationHandler,
);
integrationsAdminRouter.post(
  '/:integrationId/test',
  authorize('admin.integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationsController.testIntegrationHandler,
);
integrationsAdminRouter.post(
  '/:integrationId/enable',
  authorize('admin.integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationsController.enableIntegrationHandler,
);
integrationsAdminRouter.post(
  '/:integrationId/disable',
  authorize('admin.integrations.manage'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationsController.disableIntegrationHandler,
);
integrationsAdminRouter.get(
  '/:integrationId/logs',
  authorize('admin.integrations.read'),
  validateRequest({ params: integrationIdParamSchema }),
  integrationsController.listIntegrationLogsHandler,
);
