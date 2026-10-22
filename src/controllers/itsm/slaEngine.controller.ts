import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import {
  completeResponseSla,
  detectSlaBreaches,
  listSlaClockEvents,
  listSlaInstances,
  pauseSlaClock,
  resumeSlaClock,
} from "../../services/itsm/slaEngine.service";

export const slaEngineController = {
  listInstances: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const filters = {
      incidentId: typeof req.query.incidentId === "string" ? req.query.incidentId : undefined,
      milestone: typeof req.query.milestone === "string" ? req.query.milestone : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    };
    const rows = await listSlaInstances(actor.tenantId, filters);
    return ok(res, rows);
  }),

  listClockEvents: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const filters = {
      slaInstanceId: typeof req.query.slaInstanceId === "string" ? req.query.slaInstanceId : undefined,
      type: typeof req.query.type === "string" ? req.query.type : undefined,
    };
    const rows = await listSlaClockEvents(actor.tenantId, filters);
    return ok(res, rows);
  }),

  pause: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { incidentId, milestone, reason } = req.body as {
      incidentId: string;
      milestone: string;
      reason?: string;
    };
    if (!incidentId || !milestone) {
      return res.status(400).json({ error: "incidentId and milestone are required" });
    }
    const updated = await pauseSlaClock(actor.tenantId, incidentId, milestone, reason ?? "SLA paused", actor);
    return ok(res, updated);
  }),

  resume: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { incidentId, milestone, reason } = req.body as {
      incidentId: string;
      milestone: string;
      reason?: string;
    };
    if (!incidentId || !milestone) {
      return res.status(400).json({ error: "incidentId and milestone are required" });
    }
    const updated = await resumeSlaClock(actor.tenantId, incidentId, milestone, reason ?? "SLA resumed", actor);
    return ok(res, updated);
  }),

  completeResponse: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { incidentId } = req.body as { incidentId?: string };
    if (!incidentId) {
      return res.status(400).json({ error: "incidentId is required" });
    }
    const updated = await completeResponseSla(actor.tenantId, incidentId, actor);
    return ok(res, updated);
  }),

  detectBreaches: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const breached = await detectSlaBreaches(actor.tenantId, actor);
    return ok(res, breached);
  }),
};
