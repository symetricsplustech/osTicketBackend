import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { apiKeyService } from '../../services/itsm/apikeys.service';

export const apiKeyController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await apiKeyService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await apiKeyService.get(actor.tenantId, req.params.apiKeyId!));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await apiKeyService.create(actor.tenantId, req.body ?? {}, actor));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await apiKeyService.update(actor.tenantId, req.params.apiKeyId!, req.body ?? {}, actor));
  }),
  revoke: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    return ok(res, await apiKeyService.revoke(actor.tenantId, req.params.apiKeyId!, reason, actor));
  }),
  rotate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await apiKeyService.rotate(actor.tenantId, req.params.apiKeyId!, actor));
  }),
  listUsage: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await apiKeyService.listUsage(actor.tenantId, req.params.apiKeyId!, req);
    return paginated(res, rows, meta);
  }),
};
