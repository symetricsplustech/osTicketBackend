import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import {
  notificationLogController,
  notificationRuleController,
  notificationTemplateController,
} from '../../controllers/itsm/notifications.controller';
import {
  createNotificationRuleSchema,
  createNotificationTemplateSchema,
  notificationLogIdParamSchema,
  notificationRuleIdParamSchema,
  notificationTemplateIdParamSchema,
  updateNotificationRuleSchema,
  updateNotificationTemplateSchema,
} from '../../validators/itsm/notifications.validators';

export const notificationsItsmRouter = Router();

registerItsmCrudRoutes(notificationsItsmRouter, notificationTemplateController, {
  idParam: 'templateId',
  basePath: '/templates',
  read: 'notifications.read',
  manage: 'notifications.manage',
  idSchema: notificationTemplateIdParamSchema,
  createSchema: createNotificationTemplateSchema,
  updateSchema: updateNotificationTemplateSchema,
});
notificationsItsmRouter.post(
  '/templates/:templateId/enable',
  requireTenantPermission('notifications.manage'),
  validateRequest({ params: notificationTemplateIdParamSchema }),
  notificationTemplateController.enable,
);
notificationsItsmRouter.post(
  '/templates/:templateId/disable',
  requireTenantPermission('notifications.manage'),
  validateRequest({ params: notificationTemplateIdParamSchema }),
  notificationTemplateController.disable,
);

registerItsmCrudRoutes(notificationsItsmRouter, notificationRuleController, {
  idParam: 'ruleId',
  basePath: '/rules',
  read: 'notifications.read',
  manage: 'notifications.manage',
  idSchema: notificationRuleIdParamSchema,
  createSchema: createNotificationRuleSchema,
  updateSchema: updateNotificationRuleSchema,
});
notificationsItsmRouter.post(
  '/rules/:ruleId/enable',
  requireTenantPermission('notifications.manage'),
  validateRequest({ params: notificationRuleIdParamSchema }),
  notificationRuleController.enable,
);
notificationsItsmRouter.post(
  '/rules/:ruleId/disable',
  requireTenantPermission('notifications.manage'),
  validateRequest({ params: notificationRuleIdParamSchema }),
  notificationRuleController.disable,
);

notificationsItsmRouter.get('/logs', requireTenantPermission('notifications.read'), notificationLogController.list);
notificationsItsmRouter.get(
  '/logs/:logId',
  requireTenantPermission('notifications.read'),
  validateRequest({ params: notificationLogIdParamSchema }),
  notificationLogController.get,
);
