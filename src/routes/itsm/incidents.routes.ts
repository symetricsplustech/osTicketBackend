import { Router } from "express";
import { incidentController } from "../../controllers/itsm/incidents.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  assignIncidentSchema,
  createIncidentCommentSchema,
  createIncidentSchema,
  escalateIncidentSchema,
  incidentIdParamSchema,
  reopenIncidentSchema,
  resolveIncidentSchema,
  updateIncidentSchema,
} from "../../validators/itsm/incidents.validators";

export const incidentsItsmRouter = Router();

incidentsItsmRouter.get(
  "/",
  requireTenantPermission("incidents.read"),
  incidentController.list,
);
incidentsItsmRouter.post(
  "/",
  requireTenantPermission("incidents.create"),
  validateRequest({ body: createIncidentSchema }),
  incidentController.create,
);
incidentsItsmRouter.get(
  "/:incidentId",
  requireTenantPermission("incidents.read"),
  validateRequest({ params: incidentIdParamSchema }),
  incidentController.get,
);
incidentsItsmRouter.patch(
  "/:incidentId",
  requireTenantPermission("incidents.update"),
  validateRequest({
    params: incidentIdParamSchema,
    body: updateIncidentSchema,
  }),
  incidentController.update,
);
incidentsItsmRouter.delete(
  "/:incidentId",
  requireTenantPermission("incidents.update"),
  validateRequest({ params: incidentIdParamSchema }),
  incidentController.remove,
);
incidentsItsmRouter.post(
  "/:incidentId/assign",
  requireTenantPermission("incidents.assign"),
  validateRequest({
    params: incidentIdParamSchema,
    body: assignIncidentSchema,
  }),
  incidentController.assign,
);
incidentsItsmRouter.post(
  "/:incidentId/escalate",
  requireTenantPermission("incidents.escalate"),
  validateRequest({
    params: incidentIdParamSchema,
    body: escalateIncidentSchema,
  }),
  incidentController.escalate,
);
incidentsItsmRouter.post(
  "/:incidentId/resolve",
  requireTenantPermission("incidents.resolve"),
  validateRequest({
    params: incidentIdParamSchema,
    body: resolveIncidentSchema,
  }),
  incidentController.resolve,
);
incidentsItsmRouter.post(
  "/:incidentId/reopen",
  requireTenantPermission("incidents.reopen"),
  validateRequest({
    params: incidentIdParamSchema,
    body: reopenIncidentSchema,
  }),
  incidentController.reopen,
);
incidentsItsmRouter.get(
  "/:incidentId/comments",
  requireTenantPermission("incidents.read"),
  validateRequest({ params: incidentIdParamSchema }),
  incidentController.listComments,
);
incidentsItsmRouter.post(
  "/:incidentId/comments",
  requireTenantPermission("incidents.update"),
  validateRequest({
    params: incidentIdParamSchema,
    body: createIncidentCommentSchema,
  }),
  incidentController.addComment,
);
