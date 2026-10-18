import type { Request, Response } from 'express';
import { created, ok, paginated } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { tenantActor } from '../tenantadmin/actor';
import { makeItsmCrudController } from './crud.controller';
import { accessPolicyService } from '../../services/itsm/accesspolicies.service';
import { delegationService } from '../../services/itsm/delegations.service';
import { accessReviewService } from '../../services/itsm/accessreviews.service';

const policyBase = makeItsmCrudController(accessPolicyService, 'policyId');

export const accessPolicyController = {
  ...policyBase,
  listAssignments: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await accessPolicyService.listAssignments(actor.tenantId, req.params.policyId!, req);
    return paginated(res, rows, meta);
  }),
  createAssignment: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await accessPolicyService.createAssignment(actor.tenantId, req.params.policyId!, req.body, actor));
  }),
  removeAssignment: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await accessPolicyService.removeAssignment(actor.tenantId, req.params.policyId!, req.params.assignmentId!, actor);
    return ok(res, { assignmentId: req.params.assignmentId, deleted: true });
  }),
};

const delegationBase = makeItsmCrudController(delegationService, 'delegationId');

export const delegationController = {
  ...delegationBase,
  revoke: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await delegationService.revoke(actor.tenantId, req.params.delegationId!, actor));
  }),
};

const reviewBase = makeItsmCrudController(accessReviewService, 'reviewId');

export const accessReviewController = {
  ...reviewBase,
  start: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await accessReviewService.start(actor.tenantId, req.params.reviewId!, actor));
  }),
  complete: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await accessReviewService.complete(actor.tenantId, req.params.reviewId!, actor));
  }),
  cancel: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await accessReviewService.cancel(actor.tenantId, req.params.reviewId!, actor));
  }),
  listItems: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    const { rows, meta } = await accessReviewService.listItems(actor.tenantId, req.params.reviewId!, req);
    return paginated(res, rows, meta);
  }),
  addItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return created(res, await accessReviewService.addItem(actor.tenantId, req.params.reviewId!, req.body, actor));
  }),
  decideItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(res, await accessReviewService.decideItem(actor.tenantId, req.params.reviewId!, req.params.itemId!, req.body.decision, req.body.notes, actor));
  }),
  removeItem: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    await accessReviewService.removeItem(actor.tenantId, req.params.reviewId!, req.params.itemId!, actor);
    return ok(res, { itemId: req.params.itemId, deleted: true });
  }),
};
