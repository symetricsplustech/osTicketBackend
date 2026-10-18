import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { operatingHoursService, routingRuleService, serviceDeskQueueService } from '../../services/itsm/servicedesk.service';

const queueBase = makeItsmCrudController(serviceDeskQueueService, 'queueId');

export const serviceDeskQueueController = {
  ...queueBase,
  setDefault: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await serviceDeskQueueService.setDefault(actor.tenantId, req.params.queueId!));
  }),
};

const operatingHoursBase = makeItsmCrudController(operatingHoursService, 'operatingHoursId');

export const operatingHoursController = {
  ...operatingHoursBase,
  setDefault: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await operatingHoursService.setDefault(actor.tenantId, req.params.operatingHoursId!));
  }),
};

export const routingRuleController = makeItsmCrudController(routingRuleService, 'routingRuleId');
