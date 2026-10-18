import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { webhookService } from '../../services/itsm/webhooks.service';

export const webhookController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await webhookService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await webhookService.get(actor.tenantId, req.params.webhookId!));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await webhookService.create(actor.tenantId, req.body ?? {}, actor));
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await webhookService.update(actor.tenantId, req.params.webhookId!, req.body ?? {}, actor));
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await webhookService.remove(actor.tenantId, req.params.webhookId!, actor);
    return ok(res, { webhookId: req.params.webhookId, deleted: true });
  }),
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await webhookService.setEnabled(actor.tenantId, req.params.webhookId!, true, actor));
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await webhookService.setEnabled(actor.tenantId, req.params.webhookId!, false, actor));
  }),
  rotateSecret: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await webhookService.rotateSecret(actor.tenantId, req.params.webhookId!, actor));
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const eventKey = typeof req.body?.eventKey === 'string' ? req.body.eventKey : undefined;
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? (req.body.payload as Record<string, unknown>) : undefined;
    return ok(res, await webhookService.test(actor.tenantId, req.params.webhookId!, eventKey, payload, actor));
  }),
  listDeliveries: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await webhookService.listDeliveries(actor.tenantId, req.params.webhookId!, req);
    return paginated(res, rows, meta);
  }),
};
