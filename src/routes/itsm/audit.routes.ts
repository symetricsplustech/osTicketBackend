import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { auditController } from "../../controllers/itsm/audit.controller";
import {
  auditEventIdParamSchema,
  auditExportSchema,
  auditResourceParamSchema,
} from "../../validators/itsm/audit.validators";

export const auditItsmRouter = Router();

auditItsmRouter.get(
  "/events",
  requireTenantPermission("audit.read"),
  auditController.list,
);
auditItsmRouter.get(
  "/events/:eventId",
  requireTenantPermission("audit.read"),
  validateRequest({ params: auditEventIdParamSchema }),
  auditController.get,
);
auditItsmRouter.get(
  "/resource/:resourceType/:resourceId",
  requireTenantPermission("audit.read"),
  validateRequest({ params: auditResourceParamSchema }),
  auditController.resourceHistory,
);
auditItsmRouter.get(
  "/actors",
  requireTenantPermission("audit.read"),
  auditController.listActors,
);
auditItsmRouter.get(
  "/security-events",
  requireTenantPermission("audit.read"),
  auditController.listSecurityEvents,
);
auditItsmRouter.post(
  "/export",
  requireTenantPermission("audit.export"),
  validateRequest({ body: auditExportSchema }),
  auditController.export,
);
