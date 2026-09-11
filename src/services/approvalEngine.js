/**
 * Approval Engine service — unified approval lifecycle: policy evaluation,
 * instance creation, step sequencing, decisions, delegation, timeout, escalation, audit.
 */
const mongoose = require("mongoose");
const numberingService = require("./numbering.service");
const { emitEvent } = require("../realtime/socketManager");

// Register approval-engine models before retrieving them from Mongoose.
require("../models/approval/ApprovalDefinition");
require("../models/approval/ApprovalInstance");
require("../models/approval/ApprovalStep");
require("../models/approval/Approver");
require("../models/approval/Delegation");
require("../models/approval/ApprovalDecision");

const requireTenant = (ctx) => {
  if (!ctx.tenantId)
    throw Object.assign(new Error("Tenant context required"), {
      statusCode: 400,
    });
  return ctx.tenantId;
};
const pick = (obj, keys) =>
  Object.fromEntries(
    keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]),
  );

const ApprovalDefinition = mongoose.model("ApprovalDefinition");
const ApprovalInstance = mongoose.model("ApprovalInstance");
const ApprovalStep = mongoose.model("ApprovalStep");
const Approver = mongoose.model("Approver");
const Delegation = mongoose.model("Delegation");
const ApprovalDecision = mongoose.model("ApprovalDecision");

// ─── Condition Matching ─────────────────────────────────────────────────

function matchesCondition(cond, entity) {
  const val = entity[cond.field];
  switch (cond.operator) {
    case "equals":
      return val === cond.value;
    case "not_equals":
      return val !== cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(val);
    case "not_in":
      return Array.isArray(cond.value) && !cond.value.includes(val);
    case "contains":
      return typeof val === "string" && val.includes(cond.value);
    case "gt":
      return val > cond.value;
    case "lt":
      return val < cond.value;
    case "gte":
      return val >= cond.value;
    case "lte":
      return val <= cond.value;
    default:
      return false;
  }
}

function matchesConditions(conditions, entity) {
  if (!conditions || !conditions.rules || !conditions.rules.length) return true;
  if (conditions.matchAll)
    return conditions.rules.every((r) => matchesCondition(r, entity));
  return conditions.rules.some((r) => matchesCondition(r, entity));
}

// ─── Approval Definitions ───────────────────────────────────────────────

exports.listDefinitions = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "entityType"]),
  };
  if (query.search)
    filter.$or = [{ name: { $regex: query.search, $options: "i" } }];
  return ApprovalDefinition.find(filter).sort({ entityType: 1, name: 1 });
};

exports.getDefinition = async (ctx, defId) => {
  const tenantId = requireTenant(ctx);
  const def = await ApprovalDefinition.findOne({
    _id: defId,
    tenantId,
    isDeleted: false,
  });
  if (!def)
    throw Object.assign(new Error("Approval definition not found"), {
      statusCode: 404,
    });
  return def;
};

exports.createDefinition = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "APDEF");
  return ApprovalDefinition.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
};

exports.updateDefinition = async (ctx, defId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const def = await ApprovalDefinition.findOne({
    _id: defId,
    tenantId,
    isDeleted: false,
  });
  if (!def)
    throw Object.assign(new Error("Approval definition not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "description",
    "isActive",
    "entityType",
    "conditions",
    "approvalMode",
    "requiredApprovals",
    "steps",
    "escalation",
    "timeout",
    "notification",
  ];
  Object.assign(def, pick(data, allowed));
  await def.save();
  return def;
};

exports.deleteDefinition = async (ctx, defId, actor) => {
  const tenantId = requireTenant(ctx);
  const def = await ApprovalDefinition.findOne({
    _id: defId,
    tenantId,
    isDeleted: false,
  });
  if (!def)
    throw Object.assign(new Error("Approval definition not found"), {
      statusCode: 404,
    });
  def.isDeleted = true;
  def.deletedAt = new Date();
  def.deletedBy = actor.userId;
  await def.save();
  return { success: true };
};

// ─── Policy Evaluation ──────────────────────────────────────────────────

exports.evaluatePolicy = async (ctx, entityType, entity) => {
  const tenantId = requireTenant(ctx);
  const defs = await ApprovalDefinition.find({
    tenantId,
    isActive: true,
    isDeleted: false,
    $or: [{ entityType }, { entityType: "any" }],
  }).sort({ name: 1 });
  for (const def of defs) {
    if (matchesConditions(def.conditions, entity)) {
      def.hitCount = (def.hitCount || 0) + 1;
      def.lastHitAt = new Date();
      await def.save();
      return def;
    }
  }
  return null;
};

// ─── Approval Instances ─────────────────────────────────────────────────

exports.listInstances = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["status", "entityType", "entityId", "initiatedBy"]),
  };
  return ApprovalInstance.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(query.limit) || 50);
};

exports.getInstance = async (ctx, instanceId) => {
  const tenantId = requireTenant(ctx);
  const instance = await ApprovalInstance.findOne({
    _id: instanceId,
    tenantId,
    isDeleted: false,
  });
  if (!instance)
    throw Object.assign(new Error("Approval instance not found"), {
      statusCode: 404,
    });
  return instance;
};

exports.getInstanceWithSteps = async (ctx, instanceId) => {
  const tenantId = requireTenant(ctx);
  const instance = await ApprovalInstance.findOne({
    _id: instanceId,
    tenantId,
    isDeleted: false,
  });
  if (!instance)
    throw Object.assign(new Error("Approval instance not found"), {
      statusCode: 404,
    });
  const steps = await ApprovalStep.find({ tenantId, instanceId }).sort({
    stepNumber: 1,
  });
  const stepIds = steps.map((s) => s._id);
  const approvers = await Approver.find({
    tenantId,
    stepId: { $in: stepIds },
  }).sort({ order: 1 });
  const stepsWithApprovers = steps.map((s) => ({
    ...s.toObject(),
    approvers: approvers.filter(
      (a) => a.stepId.toString() === s._id.toString(),
    ),
  }));
  return { ...instance.toObject(), steps: stepsWithApprovers };
};

exports.createInstance = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "APINST");

  // Find matching definition
  let definition = null;
  if (data.definitionId) {
    definition = await ApprovalDefinition.findOne({
      _id: data.definitionId,
      tenantId,
      isDeleted: false,
    });
  } else {
    definition = await exports.evaluatePolicy(
      ctx,
      data.entityType,
      data.entity || {},
    );
  }

  const steps = definition?.steps || data.steps || [];
  const dueAt =
    data.dueAt ||
    (definition?.timeout?.enabled
      ? new Date(Date.now() + (definition.timeout.afterHours || 72) * 3600000)
      : null);

  const instance = await ApprovalInstance.create({
    ...data,
    tenantId,
    number,
    definitionId: definition?._id,
    title: data.title || `${data.entityType || "Entity"} approval`,
    mode: data.mode || definition?.approvalMode || "sequential",
    requiredApprovals:
      data.requiredApprovals || definition?.requiredApprovals || 1,
    totalSteps: steps.length || 1,
    dueAt,
    timeoutHours: data.timeoutHours || definition?.timeout?.afterHours || 0,
    escalationAfterHours:
      data.escalationAfterHours || definition?.escalation?.afterHours || 0,
    escalateTo: data.escalateTo || definition?.escalation?.escalateTo,
    initiatedBy: actor.userId,
    initiatedByName: actor.userName || "",
  });

  // Create steps
  for (let i = 0; i < steps.length; i++) {
    const stepDef = steps[i];
    const step = await ApprovalStep.create({
      tenantId,
      instanceId: instance._id,
      stepNumber: i + 1,
      name: stepDef.name || `Step ${i + 1}`,
      assigneeType: stepDef.assigneeType,
      assignee: stepDef.assignee,
      mode: stepDef.mode || "approve",
      status: i === 0 ? "active" : "pending",
      timeoutHours: stepDef.timeoutHours || 0,
      autoApproveOnTimeout: stepDef.autoApproveOnTimeout || false,
      required: stepDef.required !== false,
      order: stepDef.order || i + 1,
      dueAt: stepDef.timeoutHours
        ? new Date(Date.now() + stepDef.timeoutHours * 3600000)
        : null,
    });

    // Create approver records for this step
    if (stepDef.assignee) {
      await Approver.create({
        tenantId,
        stepId: step._id,
        instanceId: instance._id,
        userId: stepDef.assignee,
        role: stepDef.mode === "acknowledge" ? "acknowledger" : "approver",
        status: i === 0 ? "pending" : "pending",
        order: 1,
        dueAt: step.dueAt,
      });
    }
  }

  return instance;
};

// ─── Decisions ──────────────────────────────────────────────────────────

exports.decide = async (ctx, instanceId, stepId, decision, actor) => {
  const tenantId = requireTenant(ctx);
  const instance = await ApprovalInstance.findOne({
    _id: instanceId,
    tenantId,
    isDeleted: false,
  });
  if (!instance)
    throw Object.assign(new Error("Approval instance not found"), {
      statusCode: 404,
    });
  if (!["pending"].includes(instance.status))
    throw Object.assign(new Error("Instance not in pending state"), {
      statusCode: 422,
    });

  const step = await ApprovalStep.findOne({
    _id: stepId,
    tenantId,
    instanceId,
    status: "active",
  });
  if (!step)
    throw Object.assign(new Error("Step not active or not found"), {
      statusCode: 422,
    });

  // Update step
  step.status = decision === "approved" ? "approved" : "rejected";
  step.decidedBy = actor.userId;
  step.decidedByName = actor.userName || "";
  step.decidedAt = new Date();
  await step.save();

  // Update approver
  const approver = await Approver.findOne({
    stepId,
    userId: actor.userId,
    status: "pending",
  });
  if (approver) {
    approver.status = step.status;
    approver.decidedBy = actor.userId;
    approver.decidedAt = new Date();
    await approver.save();
  }

  // Log decision
  await ApprovalDecision.create({
    tenantId,
    instanceId,
    stepId,
    approverId: actor.userId,
    approverName: actor.userName || "",
    decision,
  });

  // Update instance counters
  if (decision === "approved") {
    instance.approvalCount = (instance.approvalCount || 0) + 1;
  } else {
    instance.rejectionCount = (instance.rejectionCount || 0) + 1;
  }

  // Check if step is complete and advance
  if (decision === "rejected") {
    instance.status = "rejected";
    instance.result = "rejected";
    instance.completedAt = new Date();
  } else {
    // Check if all approvers in this step have decided
    const pendingInStep = await Approver.countDocuments({
      stepId,
      status: "pending",
    });
    if (pendingInStep === 0) {
      // Move to next step
      const nextStepNum = step.stepNumber + 1;
      const nextStep = await ApprovalStep.findOne({
        instanceId,
        stepNumber: nextStepNum,
      });
      if (nextStep) {
        nextStep.status = "active";
        await nextStep.save();
        instance.currentStep = nextStepNum;
      } else {
        // All steps complete - check if enough approvals
        if (instance.approvalCount >= instance.requiredApprovals) {
          instance.status = "approved";
          instance.result = "approved";
          instance.completedAt = new Date();
        }
      }
    }
  }

  await instance.save();
  emitEvent(tenantId, "approval.decided", {
    instanceId,
    stepId,
    decision,
    by: actor.userId,
  });
  return instance;
};

exports.batchDecide = async (ctx, instanceId, decisions, actor) => {
  const results = [];
  for (const d of decisions) {
    const result = await exports.decide(
      ctx,
      instanceId,
      d.stepId,
      d.decision,
      actor,
    );
    results.push(result);
  }
  return results[results.length - 1];
};

// ─── Delegation ─────────────────────────────────────────────────────────

exports.listDelegations = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["delegatorId", "delegateId", "isActive"]),
  };
  return Delegation.find(filter).sort({ startDate: -1 });
};

exports.createDelegation = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  // Validate dates
  if (new Date(data.endDate) <= new Date(data.startDate))
    throw Object.assign(new Error("endDate must be after startDate"), {
      statusCode: 422,
    });
  return Delegation.create({ ...data, tenantId, createdBy: actor.userId });
};

exports.updateDelegation = async (ctx, delegationId, data) => {
  const tenantId = requireTenant(ctx);
  const del = await Delegation.findOne({
    _id: delegationId,
    tenantId,
    isDeleted: false,
  });
  if (!del)
    throw Object.assign(new Error("Delegation not found"), { statusCode: 404 });
  const allowed = ["reason", "startDate", "endDate", "isActive", "scopes"];
  Object.assign(del, pick(data, allowed));
  await del.save();
  return del;
};

exports.deleteDelegation = async (ctx, delegationId, actor) => {
  const tenantId = requireTenant(ctx);
  const del = await Delegation.findOne({
    _id: delegationId,
    tenantId,
    isDeleted: false,
  });
  if (!del)
    throw Object.assign(new Error("Delegation not found"), { statusCode: 404 });
  del.isDeleted = true;
  del.deletedAt = new Date();
  del.deletedBy = actor.userId;
  await del.save();
  return { success: true };
};

exports.resolveDelegation = async (ctx, userId) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const del = await Delegation.findOne({
    tenantId,
    delegatorId: userId,
    isActive: true,
    isDeleted: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
  return del ? del.delegateId : userId;
};

// ─── Timeout / Escalation ───────────────────────────────────────────────

exports.processTimeouts = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const overdue = await ApprovalInstance.find({
    tenantId,
    status: "pending",
    dueAt: { $lte: now },
    isDeleted: false,
  });
  let processed = 0;
  for (const inst of overdue) {
    if (inst.autoApproveAfterHours && inst.autoApproveResult) {
      inst.status = inst.autoApproveResult;
      inst.result = "timeout";
      inst.completedAt = now;
      await inst.save();
      await ApprovalDecision.create({
        tenantId,
        instanceId: inst._id,
        stepId: null,
        approverId: inst.initiatedBy,
        decision: inst.autoApproveResult,
        isAutoDecision: true,
        autoReason: "timeout",
      });
    }
    processed++;
  }
  return { processed };
};

exports.processEscalations = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const now = new Date();
  const stepsToEscalate = await ApprovalStep.find({
    tenantId,
    status: "active",
    dueAt: { $lte: now },
  });
  let escalated = 0;
  for (const step of stepsToEscalate) {
    step.escalated = true;
    step.escalatedAt = now;
    step.status = "expired";
    await step.save();
    escalated++;
  }
  return { escalated };
};

// ─── Dashboard / Stats ──────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [instances, definitions, delegations] = await Promise.all([
    ApprovalInstance.find({ tenantId, isDeleted: false }),
    ApprovalDefinition.find({ tenantId, isDeleted: false }),
    Delegation.find({ tenantId, isDeleted: false, isActive: true }),
  ]);

  const statusCounts = {};
  for (const inst of instances) {
    statusCounts[inst.status] = (statusCounts[inst.status] || 0) + 1;
  }
  const overdue = instances.filter(
    (i) => i.status === "pending" && i.dueAt && i.dueAt < new Date(),
  ).length;
  const avgCompletionTime =
    instances
      .filter((i) => i.completedAt)
      .reduce((sum, i) => {
        return sum + (i.completedAt.getTime() - i.createdAt.getTime());
      }, 0) / (instances.filter((i) => i.completedAt).length || 1);

  return {
    totalDefinitions: definitions.length,
    activeDefinitions: definitions.filter((d) => d.isActive).length,
    totalInstances: instances.length,
    statusCounts,
    overdue,
    avgCompletionHours: Math.round(avgCompletionTime / 3600000),
    activeDelegations: delegations.length,
    entityTypeBreakdown: instances.reduce((acc, i) => {
      acc[i.entityType] = (acc[i.entityType] || 0) + 1;
      return acc;
    }, {}),
  };
};

exports.getStats = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const instances = await ApprovalInstance.find({ tenantId, isDeleted: false });
  const byStatus = {};
  for (const i of instances) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
  }
  return { total: instances.length, byStatus };
};

exports.getPendingForUser = async (ctx, userId) => {
  const tenantId = requireTenant(ctx);
  const approverRecords = await Approver.find({
    tenantId,
    userId,
    status: "pending",
  });
  const stepIds = approverRecords.map((a) => a.stepId);
  const steps = await ApprovalStep.find({
    tenantId,
    _id: { $in: stepIds },
    status: "active",
  });
  const instanceIds = steps.map((s) => s.instanceId);
  return ApprovalInstance.find({
    tenantId,
    _id: { $in: instanceIds },
    status: "pending",
  }).sort({ dueAt: 1 });
};

// ─── Decision History ───────────────────────────────────────────────────

exports.getDecisionHistory = async (ctx, instanceId) => {
  const tenantId = requireTenant(ctx);
  return ApprovalDecision.find({ tenantId, instanceId }).sort({
    createdAt: -1,
  });
};

exports.getRecentDecisions = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    ...pick(query, ["decision", "approverId", "isAutoDecision"]),
  };
  return ApprovalDecision.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(query.limit) || 50);
};

module.exports.matchesCondition = matchesCondition;
module.exports.matchesConditions = matchesConditions;
