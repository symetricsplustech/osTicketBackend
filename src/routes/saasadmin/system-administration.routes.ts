import { Router } from "express";
import * as systemAdministrationController from "../../controllers/saasadmin/system-administration.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  jobIdParamSchema,
  serviceKeyParamSchema,
  updateMaintenanceSchema,
} from "../../validators/saasadmin/system-administration.validators";

export const systemAdministrationAdminRouter = Router();

systemAdministrationAdminRouter.get(
  "/health",
  authorize("admin.system-administration.read"),
  systemAdministrationController.health,
);
systemAdministrationAdminRouter.get(
  "/services",
  authorize("admin.system-administration.read"),
  systemAdministrationController.services,
);
systemAdministrationAdminRouter.get(
  "/services/:serviceKey",
  authorize("admin.system-administration.read"),
  validateRequest({ params: serviceKeyParamSchema }),
  systemAdministrationController.serviceDetail,
);
systemAdministrationAdminRouter.get(
  "/queues",
  authorize("admin.system-administration.read"),
  systemAdministrationController.queues,
);
systemAdministrationAdminRouter.get(
  "/jobs",
  authorize("admin.system-administration.read"),
  systemAdministrationController.jobs,
);
systemAdministrationAdminRouter.get(
  "/jobs/:jobId",
  authorize("admin.system-administration.read"),
  validateRequest({ params: jobIdParamSchema }),
  systemAdministrationController.jobDetail,
);
systemAdministrationAdminRouter.post(
  "/jobs/:jobId/retry",
  authorize("admin.system-administration.manage"),
  validateRequest({ params: jobIdParamSchema }),
  systemAdministrationController.retryJobHandler,
);
systemAdministrationAdminRouter.post(
  "/jobs/:jobId/cancel",
  authorize("admin.system-administration.manage"),
  validateRequest({ params: jobIdParamSchema }),
  systemAdministrationController.cancelJobHandler,
);
systemAdministrationAdminRouter.get(
  "/maintenance",
  authorize("admin.system-administration.read"),
  systemAdministrationController.maintenance,
);
systemAdministrationAdminRouter.patch(
  "/maintenance",
  authorize("admin.system-administration.manage"),
  validateRequest({ body: updateMaintenanceSchema }),
  systemAdministrationController.updateMaintenance,
);
systemAdministrationAdminRouter.get(
  "/diagnostics",
  authorize("admin.system-administration.read"),
  systemAdministrationController.diagnostics,
);
systemAdministrationAdminRouter.get(
  "/version",
  authorize("admin.system-administration.read"),
  systemAdministrationController.version,
);
