import type { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { businessCalendarService, escalationRuleService, slaPolicyService } from '../../services/itsm/sla.service';

const policyBase = makeItsmCrudController(slaPolicyService, 'slaPolicyId');

export const slaPolicyController = {
  ...policyBase,
  activate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await slaPolicyService.transition(actor.tenantId, req.params.slaPolicyId!, actor, 'activated', 'ACTIVE'));
  }),
  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await slaPolicyService.transition(actor.tenantId, req.params.slaPolicyId!, actor, 'deactivated', 'INACTIVE'));
  }),
};

const ruleBase = makeItsmCrudController(escalationRuleService, 'escalationRuleId');

export const escalationRuleController = {
  ...ruleBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await escalationRuleService.transition(actor.tenantId, req.params.escalationRuleId!, actor, 'enabled', '', { isEnabled: true }));
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await escalationRuleService.transition(actor.tenantId, req.params.escalationRuleId!, actor, 'disabled', '', { isEnabled: false }));
  }),
};

const calendarBase = makeItsmCrudController(businessCalendarService, 'calendarId');

export const businessCalendarController = {
  ...calendarBase,
  setDefault: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await businessCalendarService.setDefault(actor.tenantId, req.params.calendarId!));
  }),
};
