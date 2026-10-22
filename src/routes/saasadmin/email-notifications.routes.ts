import { Router } from "express";
import * as emailNotificationsController from "../../controllers/saasadmin/email-notifications.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  createProviderSchema,
  createRuleSchema,
  createTemplateSchema,
  deliveryLogIdParamSchema,
  previewTemplateSchema,
  providerIdParamSchema,
  ruleIdParamSchema,
  templateIdParamSchema,
  testProviderSchema,
  updateProviderSchema,
  updateRuleSchema,
  updateTemplateSchema,
} from "../../validators/saasadmin/email-notifications.validators";

export const emailNotificationsAdminRouter = Router();

emailNotificationsAdminRouter.get(
  "/providers",
  authorize("admin.email-notifications.read"),
  emailNotificationsController.listProvidersHandler,
);
emailNotificationsAdminRouter.post(
  "/providers",
  authorize("admin.email-notifications.manage"),
  validateRequest({ body: createProviderSchema }),
  emailNotificationsController.createProviderHandler,
);
emailNotificationsAdminRouter.get(
  "/providers/:providerId",
  authorize("admin.email-notifications.read"),
  validateRequest({ params: providerIdParamSchema }),
  emailNotificationsController.getProviderHandler,
);
emailNotificationsAdminRouter.patch(
  "/providers/:providerId",
  authorize("admin.email-notifications.manage"),
  validateRequest({
    params: providerIdParamSchema,
    body: updateProviderSchema,
  }),
  emailNotificationsController.updateProviderHandler,
);
emailNotificationsAdminRouter.post(
  "/providers/:providerId/test",
  authorize("admin.email-notifications.test"),
  validateRequest({ params: providerIdParamSchema, body: testProviderSchema }),
  emailNotificationsController.testProviderHandler,
);
emailNotificationsAdminRouter.post(
  "/providers/:providerId/verify",
  authorize("admin.email-notifications.test"),
  validateRequest({ params: providerIdParamSchema }),
  emailNotificationsController.verifyProviderHandler,
);
emailNotificationsAdminRouter.post(
  "/providers/:providerId/disable",
  authorize("admin.email-notifications.manage"),
  validateRequest({ params: providerIdParamSchema }),
  emailNotificationsController.disableProviderHandler,
);

emailNotificationsAdminRouter.get(
  "/templates",
  authorize("admin.email-notifications.read"),
  emailNotificationsController.listTemplatesHandler,
);
emailNotificationsAdminRouter.post(
  "/templates",
  authorize("admin.email-notifications.manage"),
  validateRequest({ body: createTemplateSchema }),
  emailNotificationsController.createTemplateHandler,
);
emailNotificationsAdminRouter.get(
  "/templates/:templateId",
  authorize("admin.email-notifications.read"),
  validateRequest({ params: templateIdParamSchema }),
  emailNotificationsController.getTemplateHandler,
);
emailNotificationsAdminRouter.patch(
  "/templates/:templateId",
  authorize("admin.email-notifications.manage"),
  validateRequest({
    params: templateIdParamSchema,
    body: updateTemplateSchema,
  }),
  emailNotificationsController.updateTemplateHandler,
);
emailNotificationsAdminRouter.post(
  "/templates/:templateId/preview",
  authorize("admin.email-notifications.read"),
  validateRequest({
    params: templateIdParamSchema,
    body: previewTemplateSchema,
  }),
  emailNotificationsController.previewTemplateHandler,
);

emailNotificationsAdminRouter.get(
  "/rules",
  authorize("admin.email-notifications.read"),
  emailNotificationsController.listRulesHandler,
);
emailNotificationsAdminRouter.post(
  "/rules",
  authorize("admin.email-notifications.manage"),
  validateRequest({ body: createRuleSchema }),
  emailNotificationsController.createRuleHandler,
);
emailNotificationsAdminRouter.patch(
  "/rules/:ruleId",
  authorize("admin.email-notifications.manage"),
  validateRequest({ params: ruleIdParamSchema, body: updateRuleSchema }),
  emailNotificationsController.updateRuleHandler,
);
emailNotificationsAdminRouter.post(
  "/rules/:ruleId/enable",
  authorize("admin.email-notifications.manage"),
  validateRequest({ params: ruleIdParamSchema }),
  emailNotificationsController.enableRuleHandler,
);
emailNotificationsAdminRouter.post(
  "/rules/:ruleId/disable",
  authorize("admin.email-notifications.manage"),
  validateRequest({ params: ruleIdParamSchema }),
  emailNotificationsController.disableRuleHandler,
);

emailNotificationsAdminRouter.get(
  "/delivery-logs",
  authorize("admin.email-notifications.read"),
  emailNotificationsController.listDeliveryLogsHandler,
);
emailNotificationsAdminRouter.get(
  "/delivery-logs/:deliveryId",
  authorize("admin.email-notifications.read"),
  validateRequest({ params: deliveryLogIdParamSchema }),
  emailNotificationsController.getDeliveryLogHandler,
);
