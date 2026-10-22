import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  discoveryResultService,
  discoveryRunService,
  getDiscoveryResult,
} from "../../services/itsm/discovery.service";

const base = makeItsmCrudController(discoveryRunService, "runId");

export const discoveryRunController = {
  ...base,
  start: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await discoveryRunService.start(actor.tenantId, req.params.runId!, actor),
    );
  }),
  complete: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await discoveryRunService.complete(
        actor.tenantId,
        req.params.runId!,
        actor,
      ),
    );
  }),
  fail: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await discoveryRunService.fail(
        actor.tenantId,
        req.params.runId!,
        actor,
        req.body?.error,
      ),
    );
  }),
  listResults: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await discoveryRunService.listResults(
      actor.tenantId,
      req.params.runId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
};

const resultBase = makeItsmCrudController(discoveryResultService, "resultId");

export const discoveryResultController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await getDiscoveryResult(actor.tenantId, req.params.resultId!),
    );
  }),
  update: resultBase.update,
  remove: resultBase.remove,
};
