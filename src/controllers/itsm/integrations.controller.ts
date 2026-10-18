import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { integrationService } from '../../services/itsm/integrations.service';

export const integrationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await integrationService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await integrationService.get(actor.tenantId, req.params.integrationId!));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await integrationService.create(actor.tenantId, req.body ?? {}, actor));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await integrationService.update(actor.tenantId, req.params.integrationId!, req.body ?? {}, actor));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await integrationService.remove(actor.tenantId, req.params.integrationId!, actor);
    return ok(res, { integrationId: req.params.integrationId, deleted: true });
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await integrationService.test(actor.tenantId, req.params.integrationId!, actor));
  }),
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await integrationService.setEnabled(actor.tenantId, req.params.integrationId!, true, actor));
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await integrationService.setEnabled(actor.tenantId, req.params.integrationId!, false, actor));
  }),
  listLogs: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await integrationService.listLogs(actor.tenantId, req.params.integrationId!, req);
    return paginated(res, rows, meta);
  }),
};
