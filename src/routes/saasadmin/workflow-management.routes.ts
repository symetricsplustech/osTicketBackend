import { Router } from 'express';
import * as workflowManagementController from '../../controllers/saasadmin/workflow-management.controller';
import { authorize, tenantContext, validateRequest } from '../../api/middleware';
import {
  createWorkflowTemplateSchema,
  tenantWorkflowAssignmentsSchema,
  updateWorkflowTemplateSchema,
  validateWorkflowDefinitionBodySchema,
  workflowRunIdParamSchema,
  workflowTemplateIdParamSchema,
  workflowTenantParamSchema,
} from '../../validators/saasadmin/workflow-management.validators';

export const workflowManagementAdminRouter = Router();

workflowManagementAdminRouter.get(
  '/templates',
  authorize('admin.workflow-management.read'),
  workflowManagementController.listTemplatesHandler,
);
workflowManagementAdminRouter.post(
  '/templates',
  authorize('admin.workflow-management.manage'),
  validateRequest({ body: createWorkflowTemplateSchema }),
  workflowManagementController.createTemplateHandler,
);
workflowManagementAdminRouter.get(
  '/templates/:templateId',
  authorize('admin.workflow-management.read'),
  validateRequest({ params: workflowTemplateIdParamSchema }),
  workflowManagementController.getTemplateHandler,
);
workflowManagementAdminRouter.patch(
  '/templates/:templateId',
  authorize('admin.workflow-management.manage'),
  validateRequest({ params: workflowTemplateIdParamSchema, body: updateWorkflowTemplateSchema }),
  workflowManagementController.updateTemplateHandler,
);
workflowManagementAdminRouter.post(
  '/templates/:templateId/validate',
  authorize('admin.workflow-management.read'),
  validateRequest({ params: workflowTemplateIdParamSchema, body: validateWorkflowDefinitionBodySchema }),
  workflowManagementController.validateTemplateHandler,
);
workflowManagementAdminRouter.post(
  '/templates/:templateId/publish',
  authorize('admin.workflow-management.manage'),
  validateRequest({ params: workflowTemplateIdParamSchema }),
  workflowManagementController.publishTemplateHandler,
);
workflowManagementAdminRouter.post(
  '/templates/:templateId/retire',
  authorize('admin.workflow-management.manage'),
  validateRequest({ params: workflowTemplateIdParamSchema }),
  workflowManagementController.retireTemplateHandler,
);
workflowManagementAdminRouter.get(
  '/templates/:templateId/versions',
  authorize('admin.workflow-management.read'),
  validateRequest({ params: workflowTemplateIdParamSchema }),
  workflowManagementController.listTemplateVersionsHandler,
);

workflowManagementAdminRouter.get(
  '/runs',
  authorize('admin.workflow-management.read'),
  workflowManagementController.listRunsHandler,
);
workflowManagementAdminRouter.get(
  '/runs/:runId',
  authorize('admin.workflow-management.read'),
  validateRequest({ params: workflowRunIdParamSchema }),
  workflowManagementController.getRunHandler,
);
workflowManagementAdminRouter.post(
  '/runs/:runId/cancel',
  authorize('admin.workflow-management.manage'),
  validateRequest({ params: workflowRunIdParamSchema }),
  workflowManagementController.cancelRunHandler,
);

workflowManagementAdminRouter.get(
  '/tenants/:tenantId/assignments',
  authorize('admin.workflow-management.read'),
  validateRequest({ params: workflowTenantParamSchema }),
  tenantContext(),
  workflowManagementController.listTenantAssignmentsHandler,
);
workflowManagementAdminRouter.put(
  '/tenants/:tenantId/assignments',
  authorize('admin.workflow-management.manage'),
  validateRequest({ params: workflowTenantParamSchema, body: tenantWorkflowAssignmentsSchema }),
  tenantContext(),
  workflowManagementController.replaceTenantAssignmentsHandler,
);
