import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { reportsService } from "../../services/itsm/reports.service";

export const reportsController = {
  catalog: asyncHandler(async (_req: Request, res: Response) =>
    ok(res, reportsService.catalog()),
  ),
  listRuns: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await reportsService.listRuns(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  run: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await reportsService.run(actor.tenantId, req.body, actor),
    );
  }),
  getRun: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await reportsService.getRun(actor.tenantId, req.params.runId!),
    );
  }),
  cancelRun: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await reportsService.cancelRun(actor.tenantId, req.params.runId!, actor),
    );
  }),
};
