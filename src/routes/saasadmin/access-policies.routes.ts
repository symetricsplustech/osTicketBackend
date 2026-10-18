import { Router } from "express";
import * as accessPoliciesController from "../../controllers/saasadmin/access-policies.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  accessPolicyAssignmentParamSchema,
  accessPolicyIdParamSchema,
  createAccessPolicyAssignmentSchema,
  createAccessPolicySchema,
  updateAccessPolicySchema,
} from "../../validators/saasadmin/access-policies.validators";

export const accessPoliciesAdminRouter = Router();

accessPoliciesAdminRouter.get(
  "/",
  authorize("admin.access-policies.read"),
  accessPoliciesController.listAccessPoliciesHandler,
);
accessPoliciesAdminRouter.post(
  "/",
  authorize("admin.access-policies.manage"),
  validateRequest({ body: createAccessPolicySchema }),
  accessPoliciesController.createAccessPolicyHandler,
);

accessPoliciesAdminRouter.get(
  "/:policyId",
  authorize("admin.access-policies.read"),
  validateRequest({ params: accessPolicyIdParamSchema }),
  accessPoliciesController.getAccessPolicyHandler,
);
accessPoliciesAdminRouter.patch(
  "/:policyId",
  authorize("admin.access-policies.manage"),
  validateRequest({
    params: accessPolicyIdParamSchema,
    body: updateAccessPolicySchema,
  }),
  accessPoliciesController.updateAccessPolicyHandler,
);
accessPoliciesAdminRouter.post(
  "/:policyId/enable",
  authorize("admin.access-policies.manage"),
  validateRequest({ params: accessPolicyIdParamSchema }),
  accessPoliciesController.enableAccessPolicyHandler,
);
accessPoliciesAdminRouter.post(
  "/:policyId/disable",
  authorize("admin.access-policies.manage"),
  validateRequest({ params: accessPolicyIdParamSchema }),
  accessPoliciesController.disableAccessPolicyHandler,
);

accessPoliciesAdminRouter.get(
  "/:policyId/assignments",
  authorize("admin.access-policies.read"),
  validateRequest({ params: accessPolicyIdParamSchema }),
  accessPoliciesController.listAccessPolicyAssignmentsHandler,
);
accessPoliciesAdminRouter.post(
  "/:policyId/assignments",
  authorize("admin.access-policies.manage"),
  validateRequest({
    params: accessPolicyIdParamSchema,
    body: createAccessPolicyAssignmentSchema,
  }),
  accessPoliciesController.createAccessPolicyAssignmentHandler,
);
accessPoliciesAdminRouter.delete(
  "/:policyId/assignments/:assignmentId",
  authorize("admin.access-policies.manage"),
  validateRequest({ params: accessPolicyAssignmentParamSchema }),
  accessPoliciesController.deleteAccessPolicyAssignmentHandler,
);
