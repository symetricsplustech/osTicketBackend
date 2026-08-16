const Approval = require('../models/Approval');
const Agent = require('../models/Agent');
const Role = require('../models/Role');
const Team = require('../models/Team');
const Department = require('../models/Department');
const { notifyAgent, notifyAdminRoom } = require('./notification.service');
const { emit } = require('./events');
const { sendFromTemplate } = require('./email.service');

const DEFAULT_STEP_DEFAULTS = { assigneeType: 'agent', assignee: null, mode: 'approve' };

/**
 * Resolve a step's actual assignee (agent ids) for its assigneeType.
 */
async function resolveStepAssignees(step, company) {
  if (step.assigneeType === 'agent') return step.assignee ? [step.assignee] : [];
  if (step.assigneeType === 'role') {
    const role = await Role.findById(step.assignee).lean();
    if (!role) return [];
    const agents = await Agent.find({ company, role: role._id, isActive: true }).lean();
    return agents.map((a) => a._id);
  }
  if (step.assigneeType === 'team') {
    const team = await Team.findById(step.assignee).lean();
    return team ? team.members || [] : [];
  }
  if (step.assigneeType === 'dept_manager') {
    const dept = await Department.findById(step.assignee).lean();
    if (!dept) return [];
    const mgr = await Agent.findById(dept.manager).lean();
    return mgr ? [mgr._id] : [];
  }
  if (step.assigneeType === 'org_manager') return []; // resolved by caller
  if (step.assigneeType === 'any_admin') {
    const admins = await Agent.find({ company, isAdmin: true, isActive: true }).lean();
    return admins.map((a) => a._id);
  }
  return [];
}

/**
 * Create an approval flow with sequential or parallel steps.
 * steps: [{assigneeType, assignee, mode}]
 */
async function createApproval({ company, title, description, refType, refId, steps = [], mode = 'sequential', timeoutHours = 24, autoApproveAfterHours = 0, escalationAfterHours = 0, escalateTo = null, initiatedBy = null, initiatedByName = '' }) {
  if (!steps.length) throw new Error('Approval requires at least one step');
  const approval = await Approval.create({
    company,
    title,
    description,
    refType,
    refId,
    steps: steps.map((s, i) => ({ ...DEFAULT_STEP_DEFAULTS, ...s, order: i + 1 })),
    mode,
    timeoutHours,
    autoApproveAfterHours,
    escalationAfterHours,
    escalateTo,
    initiatedBy,
    initiatedByName,
  });
  await notifyPending(approval);
  emit('approval.created', { company, approvalId: approval._id, title, refType, refId });
  return approval;
}

async function notifyPending(approval) {
  const step = pendingStep(approval);
  if (!step) return;
  const assignees = await resolveStepAssignees(step, approval.company);
  for (const agentId of assignees) {
    await notifyAgent({
      agentId,
      type: 'approval',
      message: `Approval requested: ${approval.title}`,
      link: `/agent/approvals/${approval._id}`,
      company: approval.company,
    });
  }
}

const pendingStep = (approval) => approval.steps.find((s) => s.status === 'pending');

/**
 * Decide on an approval step. Parallel mode: all steps must approve. Sequential: next step activates.
 */
async function decide(approvalId, { agentId, agentName, decision, comment = '' }) {
  const approval = await Approval.findById(approvalId);
  if (!approval) throw new Error('Approval not found');
  if (approval.status !== 'pending') throw new Error('Approval already completed');

  const step = pendingStep(approval);
  if (!step) throw new Error('No pending step');

  const assignees = await resolveStepAssignees(step, approval.company);
  if (assignees.length && !assignees.some((a) => String(a) === String(agentId))) {
    throw new Error('You are not an approver on this step');
  }

  step.status = decision === 'reject' ? 'rejected' : 'approved';
  step.decidedBy = agentId;
  step.decidedByName = agentName || '';
  step.decidedAt = new Date();
  step.comment = comment;

  if (step.status === 'rejected') {
    approval.status = 'rejected';
    approval.result = comment || 'Rejected by approver';
    approval.completedAt = new Date();
  } else if (approval.mode === 'sequential') {
    const next = approval.steps.find((s) => s.status === 'pending');
    if (!next) {
      approval.status = 'approved';
      approval.completedAt = new Date();
    }
  } else {
    // parallel: all steps decided
    const remaining = approval.steps.filter((s) => s.status === 'pending').length;
    if (!remaining) {
      approval.status = 'approved';
      approval.completedAt = new Date();
    }
  }

  await approval.save();
  if (approval.status === 'pending') {
    await notifyPending(approval);
  } else {
    await notifyOutcome(approval);
  }
  return approval;
}

async function notifyOutcome(approval) {
  const ok = approval.status === 'approved';
  emit(ok ? 'approval.completed' : 'approval.rejected', {
    company: approval.company,
    approvalId: approval._id,
    refType: approval.refType,
    refId: approval.refId,
    title: approval.title,
  });
  if (approval.initiatedBy) {
    await notifyAgent({
      agentId: approval.initiatedBy,
      type: 'approval',
      message: `Approval ${ok ? 'approved' : 'rejected'}: ${approval.title}`,
      link: `/agent/approvals/${approval._id}`,
      company: approval.company,
    });
  }
  // attach result to ref document (change/asset/service ticket)
  attachResultToRef(approval).catch(() => {});
}

async function attachResultToRef(approval) {
  const ok = approval.status === 'approved';
  if (approval.refType === 'change') {
    const Change = require('../models/Change');
    await Change.updateOne(
      { _id: approval.refId },
      { $set: { status: ok ? 'approved' : 'rejected', rejectionReason: ok ? '' : (approval.result || 'Rejected') } }
    );
  } else if (approval.refType === 'asset') {
    // no-op placeholder for asset provisioning approvals
  }
}

/**
 * Run approval lifecycle maintenance: timeouts -> auto-approve / reject / escalate.
 */
async function runApprovalLifecycle() {
  const now = Date.now();
  const approvals = await Approval.find({ status: 'pending' });
  for (const approval of approvals) {
    try {
      const createdAt = new Date(approval.createdAt).getTime();
      // Escalate first (before auto-approve)
      if (approval.escalationAfterHours > 0 && approval.escalateTo) {
        const escalAt = createdAt + approval.escalationAfterHours * 3600000;
        if (now > escalAt && !approval._escalated) {
          await notifyAgent({
            agentId: approval.escalateTo,
            type: 'approval',
            message: `Approval overdue — escalate: ${approval.title}`,
            link: `/agent/approvals/${approval._id}`,
            company: approval.company,
          });
          await Approval.updateOne({ _id: approval._id }, { $set: { _escalated: true } });
        }
      }
      if (approval.autoApproveAfterHours > 0) {
        const autoAt = createdAt + approval.autoApproveAfterHours * 3600000;
        if (now > autoAt) {
          approval.status = approval.autoApproveResult === 'approved' ? 'approved' : 'rejected';
          approval.completedAt = new Date();
          approval.result = `Auto-${approval.autoApproveResult} after timeout`;
          await approval.save();
          await notifyOutcome(approval);
        }
      }
    } catch (err) {
      // skip
    }
  }
  return approvals.length;
}

/**
 * Delegate a pending step to another agent.
 */
async function delegate(approvalId, { fromAgentId, toAgentId }) {
  const approval = await Approval.findById(approvalId);
  if (!approval) throw new Error('Approval not found');
  const step = pendingStep(approval);
  if (!step) throw new Error('No pending step');
  step.delegatedFrom = fromAgentId;
  step.assignee = toAgentId;
  step.assigneeType = 'agent';
  step.status = 'delegated';
  await approval.save();
  await notifyPending(approval);
  return approval;
}

module.exports = { createApproval, decide, delegate, runApprovalLifecycle, resolveStepAssignees };