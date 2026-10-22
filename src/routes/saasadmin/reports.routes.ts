import { Router } from "express";
import * as reportsController from "../../controllers/saasadmin/reports.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  exportIdParamSchema,
  exportReportSchema,
  reportRunIdParamSchema,
  runReportSchema,
} from "../../validators/saasadmin/reports.validators";

export const reportsAdminRouter = Router();

reportsAdminRouter.get(
  "/catalog",
  authorize("admin.reports.read"),
  reportsController.catalog,
);
reportsAdminRouter.post(
  "/run",
  authorize("admin.reports.run"),
  validateRequest({ body: runReportSchema }),
  reportsController.run,
);
reportsAdminRouter.get(
  "/runs",
  authorize("admin.reports.read"),
  reportsController.runs,
);
reportsAdminRouter.get(
  "/runs/:runId",
  authorize("admin.reports.read"),
  validateRequest({ params: reportRunIdParamSchema }),
  reportsController.runDetail,
);
reportsAdminRouter.get(
  "/runs/:runId/download",
  authorize("admin.reports.export"),
  validateRequest({ params: reportRunIdParamSchema }),
  reportsController.download,
);

reportsAdminRouter.get(
  "/exports",
  authorize("admin.reports.read"),
  reportsController.exportsList,
);
reportsAdminRouter.post(
  "/exports",
  authorize("admin.reports.export"),
  validateRequest({ body: exportReportSchema }),
  reportsController.createExport,
);
reportsAdminRouter.get(
  "/exports/:exportId",
  authorize("admin.reports.read"),
  validateRequest({ params: exportIdParamSchema }),
  reportsController.exportStatus,
);
reportsAdminRouter.delete(
  "/exports/:exportId",
  authorize("admin.reports.export"),
  validateRequest({ params: exportIdParamSchema }),
  reportsController.cancelExportHandler,
);

reportsAdminRouter.get(
  "/tenant-usage",
  authorize("admin.reports.read"),
  reportsController.tenantUsage,
);
reportsAdminRouter.get(
  "/activity",
  authorize("admin.reports.read"),
  reportsController.activity,
);
reportsAdminRouter.get(
  "/security-summary",
  authorize("admin.reports.read"),
  reportsController.securitySummary,
);
