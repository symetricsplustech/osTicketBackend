import type { Request, Response } from "express";
import { ok, created, paginated } from "../../shared/response";
import { asyncHandler } from "../../shared/utils/async-handler";
import { BadRequestError } from "../../shared/errors";
import {
  approvalPolicyCrud,
  cancelRequest,
  decideRequest,
  getRequest,
  listMyPending,
  listRequests,
} from "../../services/saasadmin/approvals.service";
import type {
  ApprovalDecisionInput,
  CreateApprovalPolicyInput,
  UpdateApprovalPolicyInput,
} from "../../validators/saasadmin/approvals.validators";

export const listPolicies = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await approvalPolicyCrud.list(req);
    return paginated(res, rows, meta);
  },
);

export const createPolicy = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await approvalPolicyCrud.create(
      { ...(req.body as CreateApprovalPolicyInput) },
      req,
      {
        createdById: req.auth?.userId ?? null,
      },
    );
    return created(res, record);
  },
);

export const getPolicy = asyncHandler(async (req: Request, res: Response) => {
  const record = await approvalPolicyCrud.getById(req.params.policyId!);
  return ok(res, record);
});

export const updatePolicy = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await approvalPolicyCrud.update(
      req.params.policyId!,
      { ...(req.body as UpdateApprovalPolicyInput) },
      req,
    );
    return ok(res, record);
  },
);

export const enablePolicy = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await approvalPolicyCrud.update(
      req.params.policyId!,
      { isEnabled: true },
      req,
    );
    return ok(res, record);
  },
);

export const disablePolicy = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await approvalPolicyCrud.update(
      req.params.policyId!,
      { isEnabled: false },
      req,
    );
    return ok(res, record);
  },
);

export const listApprovalRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listRequests(req);
    return paginated(res, rows, meta);
  },
);

export const getApprovalRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await getRequest(req.params.requestId!);
    return ok(res, record);
  },
);

export const approveRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { reason } = req.body as ApprovalDecisionInput;
    const record = await decideRequest({
      requestId: req.params.requestId!,
      decision: "APPROVED",
      reason,
      approverId: req.auth!.userId,
      req,
    });
    return ok(res, record);
  },
);

export const rejectRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { reason } = req.body as ApprovalDecisionInput;
    if (!reason) throw new BadRequestError("A rejection reason is required.");
    const record = await decideRequest({
      requestId: req.params.requestId!,
      decision: "REJECTED",
      reason,
      approverId: req.auth!.userId,
      req,
    });
    return ok(res, record);
  },
);

export const cancelApprovalRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await cancelRequest(
      req.params.requestId!,
      req.auth!.userId,
      req,
    );
    return ok(res, result);
  },
);

export const myPendingApprovals = asyncHandler(
  async (req: Request, res: Response) => {
    const { rows, meta } = await listMyPending(req.auth!.userId, req);
    return paginated(res, rows, meta);
  },
);
