import { Router } from 'express';
import * as approvalsController from '../../controllers/saasadmin/approvals.controller';
import { authenticate, authorize, validateRequest } from '../../api/middleware';
import {
  approvalDecisionSchema,
  approvalPolicyIdParamSchema,
  approvalRequestIdParamSchema,
  createApprovalPolicySchema,
  updateApprovalPolicySchema,
} from '../../validators/saasadmin/approvals.validators';

export const approvalsAdminRouter = Router();
approvalsAdminRouter.use(authenticate);

approvalsAdminRouter.get('/policies', authorize('admin.approvals.read'), approvalsController.listPolicies);
approvalsAdminRouter.post(
  '/policies',
  authorize('admin.approvals.manage'),
  validateRequest({ body: createApprovalPolicySchema }),
  approvalsController.createPolicy,
);
approvalsAdminRouter.get(
  '/policies/:policyId',
  authorize('admin.approvals.read'),
  validateRequest({ params: approvalPolicyIdParamSchema }),
  approvalsController.getPolicy,
);
approvalsAdminRouter.patch(
  '/policies/:policyId',
  authorize('admin.approvals.manage'),
  validateRequest({ params: approvalPolicyIdParamSchema, body: updateApprovalPolicySchema }),
  approvalsController.updatePolicy,
);
approvalsAdminRouter.post(
  '/policies/:policyId/enable',
  authorize('admin.approvals.manage'),
  validateRequest({ params: approvalPolicyIdParamSchema }),
  approvalsController.enablePolicy,
);
approvalsAdminRouter.post(
  '/policies/:policyId/disable',
  authorize('admin.approvals.manage'),
  validateRequest({ params: approvalPolicyIdParamSchema }),
  approvalsController.disablePolicy,
);

approvalsAdminRouter.get('/requests', authorize('admin.approvals.read'), approvalsController.listApprovalRequests);
approvalsAdminRouter.get('/my-pending', authorize('admin.approvals.read'), approvalsController.myPendingApprovals);
approvalsAdminRouter.get(
  '/requests/:requestId',
  authorize('admin.approvals.read'),
  validateRequest({ params: approvalRequestIdParamSchema }),
  approvalsController.getApprovalRequest,
);
approvalsAdminRouter.post(
  '/requests/:requestId/approve',
  authorize('admin.approvals.act'),
  validateRequest({ params: approvalRequestIdParamSchema, body: approvalDecisionSchema }),
  approvalsController.approveRequest,
);
approvalsAdminRouter.post(
  '/requests/:requestId/reject',
  authorize('admin.approvals.act'),
  validateRequest({ params: approvalRequestIdParamSchema, body: approvalDecisionSchema }),
  approvalsController.rejectRequest,
);
approvalsAdminRouter.post(
  '/requests/:requestId/cancel',
  authorize('admin.approvals.act', 'admin.approvals.read'),
  validateRequest({ params: approvalRequestIdParamSchema }),
  approvalsController.cancelApprovalRequest,
);
