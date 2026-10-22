import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { reportsController } from "../../controllers/itsm/reports.controller";
import {
  reportRunIdParamSchema,
  runReportSchema,
} from "../../validators/itsm/reports.validators";

export const reportsItsmRouter = Router();

reportsItsmRouter.get(
  "/catalog",
  requireTenantPermission("reports.read"),
  reportsController.catalog,
);
reportsItsmRouter.get(
  "/runs",
  requireTenantPermission("reports.read"),
  reportsController.listRuns,
);
reportsItsmRouter.post(
  "/runs",
  requireTenantPermission("reports.run"),
  validateRequest({ body: runReportSchema }),
  reportsController.run,
);
reportsItsmRouter.get(
  "/runs/:runId",
  requireTenantPermission("reports.read"),
  validateRequest({ params: reportRunIdParamSchema }),
  reportsController.getRun,
);
reportsItsmRouter.post(
  "/runs/:runId/cancel",
  requireTenantPermission("reports.run"),
  validateRequest({ params: reportRunIdParamSchema }),
  reportsController.cancelRun,
);
