import type { Request, Response } from "express";
import { ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeItsmCrudController } from "./crud.controller";
import {
  approvalPolicyService,
  approvalRequestService,
} from "../../services/itsm/approvals.service";

const policyBase = makeItsmCrudController(approvalPolicyService, "policyId");

export const approvalPolicyController = {
  ...policyBase,
  enable: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await approvalPolicyService.transition(
        actor.tenantId,
        req.params.policyId!,
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
      await approvalPolicyService.transition(
        actor.tenantId,
        req.params.policyId!,
        actor,
        "disabled",
        "",
        { isEnabled: false },
      ),
    );
  }),
};

const requestBase = makeItsmCrudController(approvalRequestService, "requestId");

export const approvalRequestController = {
  ...requestBase,
  decide: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await approvalRequestService.decide(
        actor.tenantId,
        req.params.requestId!,
        actor,
        req.body.decision,
        req.body.reason,
      ),
    );
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await approvalRequestService.transition(
        actor.tenantId,
        req.params.requestId!,
        actor,
        "cancelled",
        "CANCELLED",
      ),
    );
  }),
  listDecisions: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await approvalRequestService.listDecisions(
      actor.tenantId,
      req.params.requestId!,
      req,
    );
    return paginated(res, rows, meta);
  }),
};
