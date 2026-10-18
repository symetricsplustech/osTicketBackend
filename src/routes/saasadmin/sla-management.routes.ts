import { Router } from 'express';
import * as slaManagementController from '../../controllers/saasadmin/sla-management.controller';
import { authorize, tenantContext, validateRequest } from '../../api/middleware';
import {
  businessCalendarIdParamSchema,
  createBusinessCalendarSchema,
  createEscalationRuleSchema,
  createSlaPolicySchema,
  escalationRuleIdParamSchema,
  slaPolicyIdParamSchema,
  tenantSlaAssignmentParamSchema,
  tenantSlaAssignmentsSchema,
  updateBusinessCalendarSchema,
  updateEscalationRuleSchema,
  updateSlaPolicySchema,
} from '../../validators/saasadmin/sla-management.validators';

export const slaManagementAdminRouter = Router();

slaManagementAdminRouter.get(
  '/policies',
  authorize('admin.sla-management.read'),
  slaManagementController.listSlaPoliciesHandler,
);
slaManagementAdminRouter.post(
  '/policies',
  authorize('admin.sla-management.manage'),
  validateRequest({ body: createSlaPolicySchema }),
  slaManagementController.createSlaPolicyHandler,
);
slaManagementAdminRouter.get(
  '/policies/:policyId',
  authorize('admin.sla-management.read'),
  validateRequest({ params: slaPolicyIdParamSchema }),
  slaManagementController.getSlaPolicyHandler,
);
slaManagementAdminRouter.patch(
  '/policies/:policyId',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: slaPolicyIdParamSchema, body: updateSlaPolicySchema }),
  slaManagementController.updateSlaPolicyHandler,
);
slaManagementAdminRouter.post(
  '/policies/:policyId/enable',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: slaPolicyIdParamSchema }),
  slaManagementController.enableSlaPolicyHandler,
);
slaManagementAdminRouter.post(
  '/policies/:policyId/disable',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: slaPolicyIdParamSchema }),
  slaManagementController.disableSlaPolicyHandler,
);

slaManagementAdminRouter.get(
  '/calendars',
  authorize('admin.sla-management.read'),
  slaManagementController.listBusinessCalendarsHandler,
);
slaManagementAdminRouter.post(
  '/calendars',
  authorize('admin.sla-management.manage'),
  validateRequest({ body: createBusinessCalendarSchema }),
  slaManagementController.createBusinessCalendarHandler,
);
slaManagementAdminRouter.patch(
  '/calendars/:calendarId',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: businessCalendarIdParamSchema, body: updateBusinessCalendarSchema }),
  slaManagementController.updateBusinessCalendarHandler,
);

slaManagementAdminRouter.get(
  '/escalation-rules',
  authorize('admin.sla-management.read'),
  slaManagementController.listEscalationRulesHandler,
);
slaManagementAdminRouter.post(
  '/escalation-rules',
  authorize('admin.sla-management.manage'),
  validateRequest({ body: createEscalationRuleSchema }),
  slaManagementController.createEscalationRuleHandler,
);
slaManagementAdminRouter.patch(
  '/escalation-rules/:ruleId',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: escalationRuleIdParamSchema, body: updateEscalationRuleSchema }),
  slaManagementController.updateEscalationRuleHandler,
);

slaManagementAdminRouter.get(
  '/tenants/:tenantId/assignments',
  authorize('admin.sla-management.read'),
  validateRequest({ params: tenantSlaAssignmentParamSchema }),
  tenantContext(),
  slaManagementController.listTenantSlaAssignmentsHandler,
);
slaManagementAdminRouter.put(
  '/tenants/:tenantId/assignments',
  authorize('admin.sla-management.manage'),
  validateRequest({ params: tenantSlaAssignmentParamSchema, body: tenantSlaAssignmentsSchema }),
  tenantContext(),
  slaManagementController.replaceTenantSlaAssignmentsHandler,
);
