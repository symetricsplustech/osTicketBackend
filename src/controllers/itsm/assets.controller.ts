import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { assetMaintenanceService, assetService, completeMaintenance } from '../../services/itsm/assets.service';

const base = makeItsmCrudController(assetService, 'assetId');

export const assetController = {
  ...base,
  assign: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await assetService.assign(actor.tenantId, req.params.assetId!, req.body ?? {}, actor));
  }),
  returnAsset: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await assetService.returnAsset(actor.tenantId, req.params.assetId!, actor));
  }),
  retire: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await assetService.retire(actor.tenantId, req.params.assetId!, actor));
  }),
  listMaintenance: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await assetService.listMaintenance(actor.tenantId, req.params.assetId!, req);
    return paginated(res, rows, meta);
  }),
};

export const assetMaintenanceController = {
  ...makeItsmCrudController(assetMaintenanceService, 'maintenanceId'),
  complete: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await completeMaintenance(actor.tenantId, req.params.maintenanceId!, actor));
  }),
  createForAsset: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await assetMaintenanceService.create(actor.tenantId, { ...(req.body ?? {}), assetId: req.params.assetId }, actor),
    );
  }),
};
