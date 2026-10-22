import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { exportService } from "../../services/itsm/exports.service";

export const exportController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await exportService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  run: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await exportService.run(actor.tenantId, req.body, actor),
    );
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await exportService.get(actor.tenantId, req.params.jobId!));
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await exportService.cancel(actor.tenantId, req.params.jobId!, actor),
    );
  }),
};
