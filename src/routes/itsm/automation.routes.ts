import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import { automationRuleController, automationRunController } from '../../controllers/itsm/automation.controller';
import {
  automationRuleIdParamSchema,
  automationRunIdParamSchema,
  createAutomationRuleSchema,
  runAutomationSchema,
  updateAutomationRuleSchema,
} from '../../validators/itsm/automation.validators';

export const automationItsmRouter = Router();

registerItsmCrudRoutes(automationItsmRouter, automationRuleController, {
  idParam: 'ruleId',
  basePath: '/rules',
  read: 'automation.read',
  manage: 'automation.manage',
  idSchema: automationRuleIdParamSchema,
  createSchema: createAutomationRuleSchema,
  updateSchema: updateAutomationRuleSchema,
});
automationItsmRouter.get(
  '/rules/:ruleId/runs',
  requireTenantPermission('automation.read'),
  validateRequest({ params: automationRuleIdParamSchema }),
  automationRuleController.listRuns,
);
automationItsmRouter.post(
  '/rules/:ruleId/enable',
  requireTenantPermission('automation.manage'),
  validateRequest({ params: automationRuleIdParamSchema }),
  automationRuleController.enable,
);
automationItsmRouter.post(
  '/rules/:ruleId/disable',
  requireTenantPermission('automation.manage'),
  validateRequest({ params: automationRuleIdParamSchema }),
  automationRuleController.disable,
);
automationItsmRouter.post(
  '/rules/:ruleId/run',
  requireTenantPermission('automation.manage'),
  validateRequest({ params: automationRuleIdParamSchema, body: runAutomationSchema }),
  automationRuleController.run,
);

registerItsmCrudRoutes(automationItsmRouter, automationRunController, {
  idParam: 'runId',
  basePath: '/runs',
  read: 'automation.read',
  manage: 'automation.manage',
  idSchema: automationRunIdParamSchema,
  transitions: [
    { path: '/complete', action: 'completed', status: 'COMPLETED' },
    { path: '/fail', action: 'failed', status: 'FAILED' },
    { path: '/cancel', action: 'cancelled', status: 'CANCELLED' },
  ],
});
