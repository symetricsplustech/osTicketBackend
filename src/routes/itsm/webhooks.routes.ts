import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { webhookController } from "../../controllers/itsm/webhooks.controller";
import {
  createWebhookSchema,
  testWebhookSchema,
  updateWebhookSchema,
  webhookIdParamSchema,
} from "../../validators/itsm/webhooks.validators";

export const webhooksItsmRouter = Router();

webhooksItsmRouter.get(
  "/",
  requireTenantPermission("webhooks.read"),
  webhookController.list,
);
webhooksItsmRouter.post(
  "/",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ body: createWebhookSchema }),
  webhookController.create,
);
webhooksItsmRouter.get(
  "/:webhookId",
  requireTenantPermission("webhooks.read"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.get,
);
webhooksItsmRouter.patch(
  "/:webhookId",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema, body: updateWebhookSchema }),
  webhookController.update,
);
webhooksItsmRouter.delete(
  "/:webhookId",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.remove,
);
webhooksItsmRouter.post(
  "/:webhookId/enable",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.enable,
);
webhooksItsmRouter.post(
  "/:webhookId/disable",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.disable,
);
webhooksItsmRouter.post(
  "/:webhookId/rotate-secret",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.rotateSecret,
);
webhooksItsmRouter.post(
  "/:webhookId/test",
  requireTenantPermission("webhooks.manage"),
  validateRequest({ params: webhookIdParamSchema, body: testWebhookSchema }),
  webhookController.test,
);
webhooksItsmRouter.get(
  "/:webhookId/deliveries",
  requireTenantPermission("webhooks.read"),
  validateRequest({ params: webhookIdParamSchema }),
  webhookController.listDeliveries,
);
