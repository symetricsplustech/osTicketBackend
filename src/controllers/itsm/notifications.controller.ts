import type { Request, Response } from 'express';
import { ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { notificationLogService, notificationRuleService, notificationTemplateService } from '../../services/itsm/notifications.service';

const templateBase = makeItsmCrudController(notificationTemplateService, 'templateId');

export const notificationTemplateController = {
  ...templateBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await notificationTemplateService.transition(actor.tenantId, req.params.templateId!, actor, 'enabled', 'ACTIVE', { isEnabled: true }));
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await notificationTemplateService.transition(actor.tenantId, req.params.templateId!, actor, 'disabled', 'INACTIVE', { isEnabled: false }));
  }),
};

const ruleBase = makeItsmCrudController(notificationRuleService, 'ruleId');

export const notificationRuleController = {
  ...ruleBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await notificationRuleService.transition(actor.tenantId, req.params.ruleId!, actor, 'enabled', '', { isEnabled: true }));
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await notificationRuleService.transition(actor.tenantId, req.params.ruleId!, actor, 'disabled', '', { isEnabled: false }));
  }),
};

export const notificationLogController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await notificationLogService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await notificationLogService.get(actor.tenantId, req.params.logId!));
  }),
};
