import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import { workflowController, workflowRunController } from '../../controllers/itsm/workflows.controller';
import {
  createWorkflowRunSchema,
  createWorkflowSchema,
  publishWorkflowSchema,
  updateWorkflowRunSchema,
  updateWorkflowSchema,
  workflowIdParamSchema,
  workflowRunIdParamSchema,
} from '../../validators/itsm/workflows.validators';

export const workflowsItsmRouter = Router();

registerItsmCrudRoutes(workflowsItsmRouter, workflowRunController, {
  idParam: 'runId',
  basePath: '/runs',
  read: 'workflows.read',
  manage: 'workflows.manage',
  idSchema: workflowRunIdParamSchema,
  updateSchema: updateWorkflowRunSchema,
  transitions: [
    { path: '/complete', action: 'completed', status: 'COMPLETED' },
    { path: '/fail', action: 'failed', status: 'FAILED' },
    { path: '/cancel', action: 'cancelled', status: 'CANCELLED' },
  ],
});
workflowsItsmRouter.post(
  '/runs',
  requireTenantPermission('workflows.manage'),
  validateRequest({ body: createWorkflowRunSchema }),
  workflowRunController.start,
);

registerItsmCrudRoutes(workflowsItsmRouter, workflowController, {
  idParam: 'workflowId',
  read: 'workflows.read',
  manage: 'workflows.manage',
  idSchema: workflowIdParamSchema,
  createSchema: createWorkflowSchema,
  updateSchema: updateWorkflowSchema,
});
workflowsItsmRouter.get(
  '/:workflowId/versions',
  requireTenantPermission('workflows.read'),
  validateRequest({ params: workflowIdParamSchema }),
  workflowController.listVersions,
);
workflowsItsmRouter.post(
  '/:workflowId/publish',
  requireTenantPermission('workflows.manage'),
  validateRequest({ params: workflowIdParamSchema, body: publishWorkflowSchema }),
  workflowController.publish,
);
workflowsItsmRouter.post(
  '/:workflowId/activate',
  requireTenantPermission('workflows.manage'),
  validateRequest({ params: workflowIdParamSchema }),
  workflowController.activate,
);
workflowsItsmRouter.post(
  '/:workflowId/deactivate',
  requireTenantPermission('workflows.manage'),
  validateRequest({ params: workflowIdParamSchema }),
  workflowController.deactivate,
);
workflowsItsmRouter.post(
  '/:workflowId/retire',
  requireTenantPermission('workflows.manage'),
  validateRequest({ params: workflowIdParamSchema }),
  workflowController.retire,
);
