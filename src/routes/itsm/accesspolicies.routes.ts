import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import { accessPolicyController } from "../../controllers/itsm/governance.controller";
import {
  accessPolicyAssignmentIdParamSchema,
  accessPolicyIdParamSchema,
  createAccessPolicyAssignmentSchema,
  createAccessPolicySchema,
  updateAccessPolicySchema,
} from "../../validators/itsm/governance.validators";

export const accessPoliciesItsmRouter = Router();

registerItsmCrudRoutes(accessPoliciesItsmRouter, accessPolicyController, {
  idParam: "policyId",
  read: "access_policies.read",
  manage: "access_policies.manage",
  idSchema: accessPolicyIdParamSchema,
  createSchema: createAccessPolicySchema,
  updateSchema: updateAccessPolicySchema,
});

accessPoliciesItsmRouter.get(
  "/:policyId/assignments",
  requireTenantPermission("access_policies.read"),
  validateRequest({ params: accessPolicyIdParamSchema }),
  accessPolicyController.listAssignments,
);

accessPoliciesItsmRouter.post(
  "/:policyId/assignments",
  requireTenantPermission("access_policies.manage"),
  validateRequest({
    params: accessPolicyIdParamSchema,
    body: createAccessPolicyAssignmentSchema,
  }),
  accessPolicyController.createAssignment,
);

accessPoliciesItsmRouter.delete(
  "/:policyId/assignments/:assignmentId",
  requireTenantPermission("access_policies.manage"),
  validateRequest({
    params: accessPolicyIdParamSchema.merge(
      accessPolicyAssignmentIdParamSchema,
    ),
  }),
  accessPolicyController.removeAssignment,
);
