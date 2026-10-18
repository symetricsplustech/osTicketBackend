import { Router } from 'express';
import * as webhooksController from '../../controllers/saasadmin/webhooks.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  createWebhookSchema,
  testWebhookSchema,
  updateWebhookSchema,
  webhookDeliveryParamSchema,
  webhookIdParamSchema,
} from '../../validators/saasadmin/webhooks.validators';

export const webhooksAdminRouter = Router();

webhooksAdminRouter.get('/', authorize('admin.webhooks.read'), webhooksController.listWebhooksHandler);
webhooksAdminRouter.post(
  '/',
  authorize('admin.webhooks.manage'),
  validateRequest({ body: createWebhookSchema }),
  webhooksController.createWebhookHandler,
);
webhooksAdminRouter.get(
  '/:webhookId',
  authorize('admin.webhooks.read'),
  validateRequest({ params: webhookIdParamSchema }),
  webhooksController.getWebhookHandler,
);
webhooksAdminRouter.patch(
  '/:webhookId',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookIdParamSchema, body: updateWebhookSchema }),
  webhooksController.updateWebhookHandler,
);
webhooksAdminRouter.post(
  '/:webhookId/test',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookIdParamSchema, body: testWebhookSchema }),
  webhooksController.testWebhookHandler,
);
webhooksAdminRouter.post(
  '/:webhookId/enable',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookIdParamSchema }),
  webhooksController.enableWebhookHandler,
);
webhooksAdminRouter.post(
  '/:webhookId/disable',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookIdParamSchema }),
  webhooksController.disableWebhookHandler,
);
webhooksAdminRouter.post(
  '/:webhookId/rotate-secret',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookIdParamSchema }),
  webhooksController.rotateWebhookSecretHandler,
);
webhooksAdminRouter.get(
  '/:webhookId/deliveries',
  authorize('admin.webhooks.read'),
  validateRequest({ params: webhookIdParamSchema }),
  webhooksController.listWebhookDeliveriesHandler,
);
webhooksAdminRouter.get(
  '/:webhookId/deliveries/:deliveryId',
  authorize('admin.webhooks.read'),
  validateRequest({ params: webhookDeliveryParamSchema }),
  webhooksController.getWebhookDeliveryHandler,
);
webhooksAdminRouter.post(
  '/:webhookId/deliveries/:deliveryId/retry',
  authorize('admin.webhooks.manage'),
  validateRequest({ params: webhookDeliveryParamSchema }),
  webhooksController.retryWebhookDeliveryHandler,
);
