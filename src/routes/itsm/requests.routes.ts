import { Router } from "express";
import { serviceRequestController } from "../../controllers/itsm/requests.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  assignServiceRequestSchema,
  cancelServiceRequestSchema,
  createServiceRequestCommentSchema,
  createServiceRequestSchema,
  decideServiceRequestSchema,
  fulfillServiceRequestSchema,
  serviceRequestIdParamSchema,
  updateServiceRequestSchema,
} from "../../validators/itsm/requests.validators";

export const requestsItsmRouter = Router();

requestsItsmRouter.get(
  "/",
  requireTenantPermission("requests.read"),
  serviceRequestController.list,
);
requestsItsmRouter.post(
  "/",
  requireTenantPermission("requests.create"),
  validateRequest({ body: createServiceRequestSchema }),
  serviceRequestController.create,
);
requestsItsmRouter.get(
  "/:requestId",
  requireTenantPermission("requests.read"),
  validateRequest({ params: serviceRequestIdParamSchema }),
  serviceRequestController.get,
);
requestsItsmRouter.patch(
  "/:requestId",
  requireTenantPermission("requests.update"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: updateServiceRequestSchema,
  }),
  serviceRequestController.update,
);
requestsItsmRouter.delete(
  "/:requestId",
  requireTenantPermission("requests.update"),
  validateRequest({ params: serviceRequestIdParamSchema }),
  serviceRequestController.remove,
);
requestsItsmRouter.post(
  "/:requestId/assign",
  requireTenantPermission("requests.update"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: assignServiceRequestSchema,
  }),
  serviceRequestController.assign,
);
requestsItsmRouter.post(
  "/:requestId/decision",
  requireTenantPermission("requests.approve"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: decideServiceRequestSchema,
  }),
  serviceRequestController.decide,
);
requestsItsmRouter.post(
  "/:requestId/fulfill",
  requireTenantPermission("requests.fulfill"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: fulfillServiceRequestSchema,
  }),
  serviceRequestController.fulfill,
);
requestsItsmRouter.post(
  "/:requestId/cancel",
  requireTenantPermission("requests.fulfill"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: cancelServiceRequestSchema,
  }),
  serviceRequestController.cancel,
);
requestsItsmRouter.get(
  "/:requestId/comments",
  requireTenantPermission("requests.read"),
  validateRequest({ params: serviceRequestIdParamSchema }),
  serviceRequestController.listComments,
);
requestsItsmRouter.post(
  "/:requestId/comments",
  requireTenantPermission("requests.update"),
  validateRequest({
    params: serviceRequestIdParamSchema,
    body: createServiceRequestCommentSchema,
  }),
  serviceRequestController.addComment,
);
