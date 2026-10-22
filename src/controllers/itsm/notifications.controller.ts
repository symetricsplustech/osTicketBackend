import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  emailProviderService,
  notificationLogService,
  notificationRuleService,
  notificationTemplateService,
} from "../../services/itsm/notifications.service";

const templateBase = makeItsmCrudController(
  notificationTemplateService,
  "templateId",
);

export const notificationTemplateController = {
  ...templateBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await notificationTemplateService.transition(
        actor.tenantId,
        req.params.templateId!,
        actor,
        "enabled",
        "ACTIVE",
        { isEnabled: true },
      ),
    );
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await notificationTemplateService.transition(
        actor.tenantId,
        req.params.templateId!,
        actor,
        "disabled",
        "INACTIVE",
        { isEnabled: false },
      ),
    );
  }),
};

const ruleBase = makeItsmCrudController(notificationRuleService, "ruleId");

export const notificationRuleController = {
  ...ruleBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await notificationRuleService.transition(
        actor.tenantId,
        req.params.ruleId!,
        actor,
        "enabled",
        "",
        { isEnabled: true },
      ),
    );
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await notificationRuleService.transition(
        actor.tenantId,
        req.params.ruleId!,
        actor,
        "disabled",
        "",
        { isEnabled: false },
      ),
    );
  }),
};

export const notificationLogController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await notificationLogService.list(
      actor.tenantId,
      req,
    );
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await notificationLogService.get(actor.tenantId, req.params.logId!),
    );
  }),
};

export const notificationProviderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await emailProviderService.list(actor.tenantId, req);
    return paginated(res, rows, meta);
  }),
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await emailProviderService.get(actor.tenantId, req.params.providerId!),
    );
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await emailProviderService.create(
        actor.tenantId,
        req.body,
        actor.actorId,
        actor.req,
      ),
    );
  }),
  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await emailProviderService.update(
        actor.tenantId,
        req.params.providerId!,
        req.body,
        actor.actorId,
        actor.req,
      ),
    );
  }),
  verify: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await emailProviderService.verify(
        actor.tenantId,
        req.params.providerId!,
        actor.actorId,
        actor.req,
      ),
    );
  }),
  test: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await emailProviderService.test(
        actor.tenantId,
        req.params.providerId!,
        req.body,
        actor.actorId,
        actor.req,
      ),
    );
  }),
  disable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await emailProviderService.disable(
        actor.tenantId,
        req.params.providerId!,
        actor.actorId,
        actor.req,
      ),
    );
  }),
};
