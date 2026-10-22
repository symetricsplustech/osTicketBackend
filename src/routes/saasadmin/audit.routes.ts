import { Router } from "express";
import * as auditController from "../../controllers/saasadmin/audit.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  auditEventIdParamSchema,
  auditExportSchema,
  resourceHistoryQuerySchema,
} from "../../validators/saasadmin/audit.validators";

export const auditAdminRouter = Router();

auditAdminRouter.get(
  "/events",
  authorize("admin.audit.read"),
  auditController.events,
);
auditAdminRouter.get(
  "/events/:eventId",
  authorize("admin.audit.read"),
  validateRequest({ params: auditEventIdParamSchema }),
  auditController.event,
);
auditAdminRouter.get(
  "/actors",
  authorize("admin.audit.read"),
  auditController.actors,
);
auditAdminRouter.get(
  "/resource-history",
  authorize("admin.audit.read"),
  validateRequest({ query: resourceHistoryQuerySchema }),
  auditController.resourceHistoryHandler,
);
auditAdminRouter.get(
  "/security-events",
  authorize("admin.audit.read"),
  auditController.securityEventsHandler,
);
auditAdminRouter.get(
  "/login-events",
  authorize("admin.audit.read"),
  auditController.loginEventsHandler,
);
auditAdminRouter.get(
  "/privileged-actions",
  authorize("admin.audit.read"),
  auditController.privilegedActionsHandler,
);
auditAdminRouter.post(
  "/exports",
  authorize("admin.audit.export"),
  validateRequest({ body: auditExportSchema }),
  auditController.requestExport,
);
