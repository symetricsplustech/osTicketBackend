import type { Request, Response } from "express";
import { ok } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { tenantActor } from "../tenantadmin/actor";
import { makeTicketController } from "./ticket.controller";
import {
  addServiceRequestComment,
  assignServiceRequest,
  cancelServiceRequest,
  createServiceRequest,
  decideServiceRequest,
  deleteServiceRequest,
  fulfillServiceRequest,
  getServiceRequest,
  listServiceRequestComments,
  listServiceRequests,
  updateServiceRequest,
} from "../../services/itsm/requests.service";
import type {
  AssignServiceRequestInput,
  CancelServiceRequestInput,
  DecideServiceRequestInput,
  FulfillServiceRequestInput,
} from "../../validators/itsm/requests.validators";

const base = makeTicketController(
  {
    list: listServiceRequests,
    get: getServiceRequest,
    create: createServiceRequest,
    update: updateServiceRequest,
    remove: deleteServiceRequest,
    listComments: listServiceRequestComments,
    addComment: addServiceRequestComment,
  },
  "requestId",
);

export const serviceRequestController = {
  ...base,

  assign: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await assignServiceRequest(
        actor.tenantId,
        req.params.requestId!,
        req.body as AssignServiceRequestInput,
        actor,
      ),
    );
  }),

  decide: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await decideServiceRequest(
        actor.tenantId,
        req.params.requestId!,
        req.body as DecideServiceRequestInput,
        actor,
      ),
    );
  }),

  fulfill: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await fulfillServiceRequest(
        actor.tenantId,
        req.params.requestId!,
        req.body as FulfillServiceRequestInput,
        actor,
      ),
    );
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const actor = tenantActor(req);
    return ok(
      res,
      await cancelServiceRequest(
        actor.tenantId,
        req.params.requestId!,
        req.body as CancelServiceRequestInput,
        actor,
      ),
    );
  }),
};
