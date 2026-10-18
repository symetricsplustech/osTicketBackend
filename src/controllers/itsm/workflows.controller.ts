import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { workflowRunService, workflowService } from '../../services/itsm/workflows.service';

const workflowBase = makeItsmCrudController(workflowService, 'workflowId');

export const workflowController = {
  ...workflowBase,
  publish: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await workflowService.publish(actor.tenantId, req.params.workflowId!, actor, req.body?.changelog));
  }),
  activate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await workflowService.transition(actor.tenantId, req.params.workflowId!, actor, 'activated', 'ACTIVE'));
  }),
  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await workflowService.transition(actor.tenantId, req.params.workflowId!, actor, 'deactivated', 'INACTIVE'));
  }),
  retire: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await workflowService.transition(actor.tenantId, req.params.workflowId!, actor, 'retired', 'INACTIVE'));
  }),
  listVersions: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await workflowService.listVersions(actor.tenantId, req.params.workflowId!, req);
    return paginated(res, rows, meta);
  }),
};

const runBase = makeItsmCrudController(workflowRunService, 'runId');

export const workflowRunController = {
  ...runBase,
  start: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await workflowRunService.start(actor.tenantId, req.body ?? {}, actor));
  }),
};
