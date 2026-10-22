import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  notificationLogController,
  notificationProviderController,
  notificationRuleController,
  notificationTemplateController,
} from "../../controllers/itsm/notifications.controller";
import {
  createNotificationRuleSchema,
  createNotificationTemplateSchema,
  createProviderSchema,
  notificationLogIdParamSchema,
  notificationRuleIdParamSchema,
  notificationTemplateIdParamSchema,
  providerIdParamSchema,
  testProviderSchema,
  updateNotificationRuleSchema,
  updateNotificationTemplateSchema,
  updateProviderSchema,
} from "../../validators/itsm/notifications.validators";

export const notificationsItsmRouter = Router();

registerItsmCrudRoutes(
  notificationsItsmRouter,
  notificationTemplateController,
  {
    idParam: "templateId",
    basePath: "/templates",
    read: "notifications.read",
    manage: "notifications.manage",
    idSchema: notificationTemplateIdParamSchema,
    createSchema: createNotificationTemplateSchema,
    updateSchema: updateNotificationTemplateSchema,
  },
);
notificationsItsmRouter.post(
  "/templates/:templateId/enable",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: notificationTemplateIdParamSchema }),
  notificationTemplateController.enable,
);
notificationsItsmRouter.post(
  "/templates/:templateId/disable",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: notificationTemplateIdParamSchema }),
  notificationTemplateController.disable,
);

registerItsmCrudRoutes(notificationsItsmRouter, notificationRuleController, {
  idParam: "ruleId",
  basePath: "/rules",
  read: "notifications.read",
  manage: "notifications.manage",
  idSchema: notificationRuleIdParamSchema,
  createSchema: createNotificationRuleSchema,
  updateSchema: updateNotificationRuleSchema,
});
notificationsItsmRouter.post(
  "/rules/:ruleId/enable",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: notificationRuleIdParamSchema }),
  notificationRuleController.enable,
);
notificationsItsmRouter.post(
  "/rules/:ruleId/disable",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: notificationRuleIdParamSchema }),
  notificationRuleController.disable,
);

notificationsItsmRouter.get(
  "/logs",
  requireTenantPermission("notifications.read"),
  notificationLogController.list,
);
notificationsItsmRouter.get(
  "/logs/:logId",
  requireTenantPermission("notifications.read"),
  validateRequest({ params: notificationLogIdParamSchema }),
  notificationLogController.get,
);

notificationsItsmRouter.get(
  "/providers",
  requireTenantPermission("notifications.read"),
  notificationProviderController.list,
);
notificationsItsmRouter.post(
  "/providers",
  requireTenantPermission("notifications.manage"),
  validateRequest({ body: createProviderSchema }),
  notificationProviderController.create,
);
notificationsItsmRouter.get(
  "/providers/:providerId",
  requireTenantPermission("notifications.read"),
  validateRequest({ params: providerIdParamSchema }),
  notificationProviderController.get,
);
notificationsItsmRouter.patch(
  "/providers/:providerId",
  requireTenantPermission("notifications.manage"),
  validateRequest({
    params: providerIdParamSchema,
    body: updateProviderSchema,
  }),
  notificationProviderController.update,
);
notificationsItsmRouter.post(
  "/providers/:providerId/test",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: providerIdParamSchema, body: testProviderSchema }),
  notificationProviderController.test,
);
notificationsItsmRouter.post(
  "/providers/:providerId/verify",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: providerIdParamSchema }),
  notificationProviderController.verify,
);
notificationsItsmRouter.post(
  "/providers/:providerId/disable",
  requireTenantPermission("notifications.manage"),
  validateRequest({ params: providerIdParamSchema }),
  notificationProviderController.disable,
);
