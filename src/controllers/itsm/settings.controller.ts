import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  portalService,
  settingService,
} from "../../services/itsm/settings.service";
import { customFieldService } from "../../services/itsm/customfields.service";

export const settingController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await settingService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await settingService.get(actor.tenantId, req.params.key!));
  }),
  upsert: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const value =
      req.body?.value !== undefined ? req.body.value : (req.body ?? {});
    return created(
      res,
      await settingService.upsert(
        actor.tenantId,
        req.params.key!,
        value,
        actor,
      ),
    );
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await settingService.remove(actor.tenantId, req.params.key!, actor);
    return ok(res, { key: req.params.key, deleted: true });
  }),
};

export const portalController = {
  getConfig: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await portalService.getConfig(tenantActor(req).tenantId)),
  ),
  updateConfig: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const value =
      req.body?.config !== undefined ? req.body.config : (req.body ?? {});
    return ok(
      res,
      await portalService.updateConfig(actor.tenantId, value, actor),
    );
  }),
  listForms: asyncHandler(async (req: Request, res: Response) =>
    ok(res, await portalService.listForms(tenantActor(req).tenantId)),
  ),
  upsertForm: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const value =
      req.body?.form !== undefined ? req.body.form : (req.body ?? {});
    return created(
      res,
      await portalService.upsertForm(
        actor.tenantId,
        req.params.formKey!,
        value,
        actor,
      ),
    );
  }),
  removeForm: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await portalService.removeForm(actor.tenantId, req.params.formKey!, actor);
    return ok(res, { formKey: req.params.formKey, deleted: true });
  }),
};

export const customFieldController = makeItsmCrudController(
  customFieldService,
  "fieldId",
);
