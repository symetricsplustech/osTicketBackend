import { Router } from "express";
import * as dashboardController from "../../controllers/saasadmin/dashboard.controller";
import { authorize } from "../../api/middleware";

export const dashboardAdminRouter = Router();

dashboardAdminRouter.get(
  "/summary",
  authorize("admin.dashboard.read"),
  dashboardController.summary,
);
dashboardAdminRouter.get(
  "/tenant-growth",
  authorize("admin.dashboard.read"),
  dashboardController.tenantGrowth,
);
dashboardAdminRouter.get(
  "/tenant-status",
  authorize("admin.dashboard.read"),
  dashboardController.tenantStatus,
);
dashboardAdminRouter.get(
  "/platform-health",
  authorize("admin.dashboard.read"),
  dashboardController.platformHealth,
);
dashboardAdminRouter.get(
  "/recent-activity",
  authorize("admin.dashboard.read"),
  dashboardController.recentActivity,
);
dashboardAdminRouter.get(
  "/alerts",
  authorize("admin.dashboard.read"),
  dashboardController.alerts,
);
dashboardAdminRouter.get(
  "/work-queue",
  authorize("admin.dashboard.read"),
  dashboardController.workQueue,
);
