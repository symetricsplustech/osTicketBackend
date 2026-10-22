import type { Request, Response } from "express";
import { created, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  automationRuleService,
  automationRunService,
} from "../../services/itsm/automation.service";

const ruleBase = makeItsmCrudController(automationRuleService, "ruleId");

export const automationRuleController = {
  ...ruleBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await automationRuleService.transition(
        actor.tenantId,
        req.params.ruleId!,
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
      await automationRuleService.transition(
        actor.tenantId,
        req.params.ruleId!,
        actor,
        "disabled",
        "INACTIVE",
        { isEnabled: false },
      ),
    );
  }),
  run: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(
      res,
      await automationRuleService.run(
        actor.tenantId,
        req.params.ruleId!,
        actor,
        req.body?.context,
      ),
    );
  }),
  listRuns: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await automationRuleService.listRuns(
      actor.tenantId,
      req.params.ruleId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
};

export const automationRunController = makeItsmCrudController(
  automationRunService,
  "runId",
);
