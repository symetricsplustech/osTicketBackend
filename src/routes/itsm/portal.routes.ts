import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { portalController } from "../../controllers/itsm/settings.controller";
import {
  portalFormKeyParamSchema,
  settingValueSchema,
} from "../../validators/itsm/settings.validators";

export const portalItsmRouter = Router();

portalItsmRouter.get(
  "/config",
  requireTenantPermission("portal.read"),
  portalController.getConfig,
);
portalItsmRouter.put(
  "/config",
  requireTenantPermission("portal.manage"),
  validateRequest({ body: settingValueSchema }),
  portalController.updateConfig,
);
portalItsmRouter.get(
  "/forms",
  requireTenantPermission("portal.read"),
  portalController.listForms,
);
portalItsmRouter.put(
  "/forms/:formKey",
  requireTenantPermission("portal.manage"),
  validateRequest({
    params: portalFormKeyParamSchema,
    body: settingValueSchema,
  }),
  portalController.upsertForm,
);
portalItsmRouter.delete(
  "/forms/:formKey",
  requireTenantPermission("portal.manage"),
  validateRequest({ params: portalFormKeyParamSchema }),
  portalController.removeForm,
);
