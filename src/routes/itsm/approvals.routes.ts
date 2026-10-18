import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import { approvalPolicyController, approvalRequestController } from '../../controllers/itsm/approvals.controller';
import {
  approvalPolicyIdParamSchema,
  approvalRequestIdParamSchema,
  createApprovalPolicySchema,
  createApprovalRequestSchema,
  decideApprovalSchema,
  updateApprovalPolicySchema,
  updateApprovalRequestSchema,
} from '../../validators/itsm/approvals.validators';

export const approvalsItsmRouter = Router();

registerItsmCrudRoutes(approvalsItsmRouter, approvalPolicyController, {
  idParam: 'policyId',
  basePath: '/policies',
  read: 'approvals.read',
  manage: 'approvals.manage',
  idSchema: approvalPolicyIdParamSchema,
  createSchema: createApprovalPolicySchema,
  updateSchema: updateApprovalPolicySchema,
});
approvalsItsmRouter.post(
  '/policies/:policyId/enable',
  requireTenantPermission('approvals.manage'),
  validateRequest({ params: approvalPolicyIdParamSchema }),
  approvalPolicyController.enable,
);
approvalsItsmRouter.post(
  '/policies/:policyId/disable',
  requireTenantPermission('approvals.manage'),
  validateRequest({ params: approvalPolicyIdParamSchema }),
  approvalPolicyController.disable,
);

registerItsmCrudRoutes(approvalsItsmRouter, approvalRequestController, {
  idParam: 'requestId',
  basePath: '/requests',
  read: 'approvals.read',
  manage: 'approvals.manage',
  idSchema: approvalRequestIdParamSchema,
  createSchema: createApprovalRequestSchema,
  updateSchema: updateApprovalRequestSchema,
});
approvalsItsmRouter.get(
  '/requests/:requestId/decisions',
  requireTenantPermission('approvals.read'),
  validateRequest({ params: approvalRequestIdParamSchema }),
  approvalRequestController.listDecisions,
);
approvalsItsmRouter.post(
  '/requests/:requestId/decide',
  requireTenantPermission('approvals.decide'),
  validateRequest({ params: approvalRequestIdParamSchema, body: decideApprovalSchema }),
  approvalRequestController.decide,
);
approvalsItsmRouter.post(
  '/requests/:requestId/cancel',
  requireTenantPermission('approvals.manage'),
  validateRequest({ params: approvalRequestIdParamSchema }),
  approvalRequestController.cancel,
);
