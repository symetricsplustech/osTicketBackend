import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { auditService } from "../../services/itsm/audit.service";

export const auditController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await auditService.listEvents(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await auditService.getEvent(actor.tenantId, req.params.eventId!),
    );
  }),
  resourceHistory: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await auditService.resourceHistory(
      actor.tenantId,
      req.params.resourceType!,
      req.params.resourceId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
  listActors: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await auditService.listActors(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  listSecurityEvents: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await auditService.listSecurityEvents(
      actor.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  }),
  export: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await auditService.requestExport(actor.tenantId, req.body ?? {}, actor),
    );
  }),
};
