import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { z } from "zod";
import { slaEngineController } from "../../controllers/itsm/slaEngine.controller";

const slaEngineRouter = Router();

slaEngineRouter.get(
  "/instances",
  requireTenantPermission("sla.read"),
  slaEngineController.listInstances,
);

slaEngineRouter.get(
  "/clock-events",
  requireTenantPermission("sla.read"),
  slaEngineController.listClockEvents,
);

const slaBodySchema = z.object({
  incidentId: z.string().min(1, "Incident identifier is required."),
  milestone: z.string().min(1, "Milestone is required."),
  reason: z.string().max(2000).optional(),
});

slaEngineRouter.post(
  "/pause",
  requireTenantPermission("sla.manage"),
  validateRequest({ body: slaBodySchema }),
  slaEngineController.pause,
);

slaEngineRouter.post(
  "/resume",
  requireTenantPermission("sla.manage"),
  validateRequest({ body: slaBodySchema }),
  slaEngineController.resume,
);

const completeResponseSchema = z.object({
  incidentId: z.string().min(1, "Incident identifier is required."),
});

slaEngineRouter.post(
  "/response/complete",
  requireTenantPermission("sla.manage"),
  validateRequest({ body: completeResponseSchema }),
  slaEngineController.completeResponse,
);

slaEngineRouter.post(
  "/detect-breaches",
  requireTenantPermission("sla.manage"),
  slaEngineController.detectBreaches,
);

export { slaEngineRouter };
