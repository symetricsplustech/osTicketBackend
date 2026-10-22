import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  businessCalendarController,
  escalationRuleController,
  slaPolicyController,
} from "../../controllers/itsm/sla.controller";
import {
  calendarIdParamSchema,
  createBusinessCalendarSchema,
  createEscalationRuleSchema,
  createSlaPolicySchema,
  escalationRuleIdParamSchema,
  slaPolicyIdParamSchema,
  updateBusinessCalendarSchema,
  updateEscalationRuleSchema,
  updateSlaPolicySchema,
} from "../../validators/itsm/sla.validators";

export const slaItsmRouter = Router();

registerItsmCrudRoutes(slaItsmRouter, slaPolicyController, {
  idParam: "slaPolicyId",
  basePath: "/policies",
  read: "sla.read",
  manage: "sla.manage",
  idSchema: slaPolicyIdParamSchema,
  createSchema: createSlaPolicySchema,
  updateSchema: updateSlaPolicySchema,
});
slaItsmRouter.post(
  "/policies/:slaPolicyId/activate",
  requireTenantPermission("sla.manage"),
  validateRequest({ params: slaPolicyIdParamSchema }),
  slaPolicyController.activate,
);
slaItsmRouter.post(
  "/policies/:slaPolicyId/deactivate",
  requireTenantPermission("sla.manage"),
  validateRequest({ params: slaPolicyIdParamSchema }),
  slaPolicyController.deactivate,
);

registerItsmCrudRoutes(slaItsmRouter, escalationRuleController, {
  idParam: "escalationRuleId",
  basePath: "/escalation-rules",
  read: "sla.read",
  manage: "sla.manage",
  idSchema: escalationRuleIdParamSchema,
  createSchema: createEscalationRuleSchema,
  updateSchema: updateEscalationRuleSchema,
});
slaItsmRouter.post(
  "/escalation-rules/:escalationRuleId/enable",
  requireTenantPermission("sla.manage"),
  validateRequest({ params: escalationRuleIdParamSchema }),
  escalationRuleController.enable,
);
slaItsmRouter.post(
  "/escalation-rules/:escalationRuleId/disable",
  requireTenantPermission("sla.manage"),
  validateRequest({ params: escalationRuleIdParamSchema }),
  escalationRuleController.disable,
);

registerItsmCrudRoutes(slaItsmRouter, businessCalendarController, {
  idParam: "calendarId",
  basePath: "/calendars",
  read: "sla.read",
  manage: "sla.manage",
  idSchema: calendarIdParamSchema,
  createSchema: createBusinessCalendarSchema,
  updateSchema: updateBusinessCalendarSchema,
});
slaItsmRouter.post(
  "/calendars/:calendarId/set-default",
  requireTenantPermission("sla.manage"),
  validateRequest({ params: calendarIdParamSchema }),
  businessCalendarController.setDefault,
);
