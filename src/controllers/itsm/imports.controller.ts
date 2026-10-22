import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { importService } from "../../services/itsm/imports.service";

export const importController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await importService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await importService.get(actor.tenantId, req.params.jobId!));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await importService.create(actor.tenantId, req.body, actor),
    );
  }),
  run: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await importService.run(actor.tenantId, req.params.jobId!, actor),
    );
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await importService.cancel(actor.tenantId, req.params.jobId!, actor),
    );
  }),
  retry: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await importService.retry(actor.tenantId, req.params.jobId!, actor),
    );
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await importService.remove(actor.tenantId, req.params.jobId!, actor);
    return ok(res, { jobId: req.params.jobId, deleted: true });
  }),
};
