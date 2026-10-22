import type { Request, Response } from "express";
import { created, noContent, ok, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import {
  createAccessPolicy,
  createAccessPolicyAssignment,
  deleteAccessPolicyAssignment,
  getAccessPolicy,
  listAccessPolicies,
  listAccessPolicyAssignments,
  setAccessPolicyEnabled,
  updateAccessPolicy,
} from "../../services/saasadmin/access-policies.service";
import type {
  CreateAccessPolicyAssignmentInput,
  CreateAccessPolicyInput,
  UpdateAccessPolicyInput,
} from "../../validators/saasadmin/access-policies.validators";

const actorOf = (req: Request) => ({ actorId: req.auth?.userId ?? null, req });

export const listAccessPoliciesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listAccessPolicies(req);
    return paginated(res, rows, meta);
  },
);

export const createAccessPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await createAccessPolicy(
      req.body as CreateAccessPolicyInput,
      actorOf(req),
    );
    return created(res, policy);
  },
);

export const getAccessPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await getAccessPolicy(req.params.policyId);
    return ok(res, policy);
  },
);

export const updateAccessPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await updateAccessPolicy(
      req.params.policyId,
      req.body as UpdateAccessPolicyInput,
      actorOf(req),
    );
    return ok(res, policy);
  },
);

export const enableAccessPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await setAccessPolicyEnabled(
      req.params.policyId,
      true,
      actorOf(req),
    );
    return ok(res, policy, { message: "Access policy enabled." });
  },
);

export const disableAccessPolicyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const policy = await setAccessPolicyEnabled(
      req.params.policyId,
      false,
      actorOf(req),
    );
    return ok(res, policy, { message: "Access policy disabled." });
  },
);

export const listAccessPolicyAssignmentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listAccessPolicyAssignments(
      req.params.policyId,
      req,
    );
    return paginated(res, rows, meta);
  },
);

export const createAccessPolicyAssignmentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const assignment = await createAccessPolicyAssignment(
      req.params.policyId,
      req.body as CreateAccessPolicyAssignmentInput,
      actorOf(req),
    );
    return created(res, assignment);
  },
);

export const deleteAccessPolicyAssignmentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteAccessPolicyAssignment(
      req.params.policyId,
      req.params.assignmentId,
      actorOf(req),
    );
    return noContent(res);
  },
);
