const approvalService = require("../../services/approval.service");
const { validate, schemas } = require("../../middleware/validation");
const ApiError = require("../../utils/ApiError");

const ok = (res, data, status = 200) => res.status(status).json(data);

exports.create = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    validate(schemas.CREATE_APPROVAL, req.body);
    const approval = await approvalService.createApproval({
      tenantId,
      taskId: req.body.taskId,
      type: req.body.type,
      approver: req.body.approver,
      approvalGroup: req.body.approvalGroup,
      approvers: req.body.approvers,
      requiredApprovals: req.body.requiredApprovals,
      requestedBy: req.user._id,
      dueAt: req.body.dueAt,
    });
    ok(res, approval, 201);
  } catch (err) {
    next(err);
  }
};

exports.decide = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    validate(schemas.DECIDE_APPROVAL, req.body);
    const approval = await approvalService.decideApproval(
      req.params.id,
      tenantId,
      {
        decision: req.body.decision,
        note: req.body.note,
        userId: req.user._id,
      },
    );
    ok(res, approval);
  } catch (err) {
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const approval = await approvalService.cancelApproval(
      req.params.id,
      tenantId,
      req.user._id,
    );
    ok(res, approval);
  } catch (err) {
    next(err);
  }
};

exports.delegate = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const { delegatedTo, note } = req.body;
    if (!delegatedTo) throw new ApiError(400, "delegatedTo is required");
    const approval = await approvalService.delegateApproval(
      req.params.id,
      tenantId,
      {
        delegatedTo,
        note,
        userId: req.user._id,
      },
    );
    ok(res, approval);
  } catch (err) {
    next(err);
  }
};

exports.listForTask = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const approvals = await approvalService.getApprovalsForTask(
      req.params.taskId,
      tenantId,
    );
    ok(res, approvals);
  } catch (err) {
    next(err);
  }
};

exports.pendingForUser = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const approvals = await approvalService.getPendingApprovalsForUser(
      req.user._id,
      tenantId,
    );
    ok(res, approvals);
  } catch (err) {
    next(err);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const stats = await approvalService.getApprovalStats(tenantId);
    ok(res, stats);
  } catch (err) {
    next(err);
  }
};
