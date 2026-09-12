/**
 * Approval service — create, decide, delegate, cancel, escalation.
 */
const Approval = require("../models/core/Approval");
const Task = require("../models/core/Task");
const NotificationEvent = require("../models/core/NotificationEvent");
const TaskActivity = require("../models/core/TaskActivity");
const { getIO } = require("../config/socket");
const logger = require("../utils/logger");
const ApiError = require("../utils/ApiError");

function emitToTaskRoom(taskId, event, data) {
  try {
    const io = getIO();
    if (io) io.to(`task:${taskId}`).emit(event, data);
  } catch (_) {}
}

async function createApproval({
  tenantId,
  taskId,
  type,
  approver,
  approvalGroup,
  approvers,
  requiredApprovals,
  requestedBy,
  dueAt,
}) {
  const task = await Task.findOne({ _id: taskId, tenantId });
  if (!task) throw new ApiError(404, "Task not found");

  const approval = await Approval.create({
    tenantId,
    taskId,
    type,
    approver,
    approvalGroup,
    approvers: approvers || [],
    requiredApprovals: requiredApprovals || 1,
    requestedBy,
    dueAt,
  });

  const recipient = approver || approvalGroup;
  if (recipient) {
    await NotificationEvent.create({
      tenantId,
      taskId,
      eventType: "approval.requested",
      recipientId: recipient,
      subject: `Approval required for task ${task.number}`,
      body: `Task ${task.number}: ${task.title} requires your approval.`,
      channel: "in_app",
    }).catch(() => {});
  }

  await TaskActivity.create({
    tenantId,
    taskId,
    type: "system",
    content: `Approval requested (${type})`,
    actor: requestedBy,
    isPublic: true,
  });

  emitToTaskRoom(taskId, "approval:created", approval);
  return approval;
}

async function decideApproval(
  approvalId,
  tenantId,
  { decision, note, userId },
) {
  const approval = await Approval.findOne({ _id: approvalId, tenantId });
  if (!approval) throw new ApiError(404, "Approval not found");
  if (approval.state !== "pending")
    throw new ApiError(422, "Approval is not pending");

  if (approval.type === "group" || approval.type === "parallel") {
    if (!approval.approvers.includes(userId))
      throw new ApiError(403, "You are not an approver");
    if (!approval.approvalsReceived.includes(userId)) {
      approval.approvalsReceived.push(userId);
    }
    const uniqueApprovals = [
      ...new Set(approval.approvalsReceived.map(String)),
    ];
    if (decision === "rejected") {
      approval.state = "rejected";
      approval.decidedAt = new Date();
      approval.decisionNote = note || "";
    } else if (uniqueApprovals.length >= approval.requiredApprovals) {
      approval.state = "approved";
      approval.decidedAt = new Date();
      approval.decisionNote = note || "";
    }
  } else {
    if (String(approval.approver) !== String(userId))
      throw new ApiError(403, "You are not the approver");
    approval.state = decision;
    approval.decidedAt = new Date();
    approval.decisionNote = note || "";
  }

  await approval.save();

  await TaskActivity.create({
    tenantId,
    taskId: approval.taskId,
    type: "system",
    content: `Approval ${decision}${note ? ": " + note : ""}`,
    actor: userId,
    isPublic: true,
  });

  emitToTaskRoom(approval.taskId, "approval:decided", approval);
  return approval;
}

async function cancelApproval(approvalId, tenantId, userId) {
  const approval = await Approval.findOne({ _id: approvalId, tenantId });
  if (!approval) throw new ApiError(404, "Approval not found");
  if (approval.state !== "pending")
    throw new ApiError(422, "Approval is not pending");
  approval.state = "cancelled";
  approval.decidedAt = new Date();
  await approval.save();
  emitToTaskRoom(approval.taskId, "approval:cancelled", approval);
  return approval;
}

async function delegateApproval(
  approvalId,
  tenantId,
  { delegatedTo, note, userId },
) {
  const approval = await Approval.findOne({ _id: approvalId, tenantId });
  if (!approval) throw new ApiError(404, "Approval not found");
  if (approval.state !== "pending")
    throw new ApiError(422, "Approval is not pending");
  approval.delegatedTo = delegatedTo;
  approval.delegationNote = note || "";
  approval.approver = delegatedTo;
  await approval.save();

  await NotificationEvent.create({
    tenantId,
    taskId: approval.taskId,
    eventType: "approval.delegated",
    recipientId: delegatedTo,
    subject: "Approval delegated to you",
    body: `An approval has been delegated to you.`,
    channel: "in_app",
  }).catch(() => {});

  return approval;
}

async function getApprovalsForTask(taskId, tenantId) {
  return Approval.find({ tenantId, taskId }).sort({ createdAt: -1 });
}

async function getPendingApprovalsForUser(userId, tenantId) {
  return Approval.find({
    tenantId,
    state: "pending",
    $or: [{ approver: userId }, { approvers: userId }],
  }).populate("taskId", "number title state priority");
}

async function getApprovalStats(tenantId) {
  const [byState, byType] = await Promise.all([
    Approval.aggregate([
      { $match: { tenantId } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]),
    Approval.aggregate([
      { $match: { tenantId, state: "pending" } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);
  return { byState, byType };
}

async function runApprovalLifecycle() {
  const overdueApprovals = await Approval.find({
    state: "pending",
    escalated: false,
    dueAt: { $ne: null, $lte: new Date() },
  });

  if (overdueApprovals.length === 0) return { escalated: 0 };

  const result = await Approval.updateMany(
    { _id: { $in: overdueApprovals.map((approval) => approval._id) } },
    { $set: { escalated: true } },
  );

  logger.info(
    `Approval lifecycle escalated ${result.modifiedCount} overdue approval(s)`,
  );
  return { escalated: result.modifiedCount };
}

module.exports = {
  createApproval,
  decideApproval,
  cancelApproval,
  delegateApproval,
  getApprovalsForTask,
  getPendingApprovalsForUser,
  getApprovalStats,
  runApprovalLifecycle,
};
