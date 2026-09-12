/**
 * Continual Improvement Management service — unified engine for
 * improvement opportunities, initiatives, tasks, goals, benefits, costs,
 * baselines, targets, and continuous improvement lifecycle.
 */
const mongoose = require('mongoose');
const numberingService = require('./numbering.service');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

const ImprovementOpportunity = require('../models/improvement/ImprovementOpportunity');
const ImprovementInitiative = require('../models/improvement/ImprovementInitiative');
const ImprovementTask = require('../models/improvement/ImprovementTask');
const ImprovementGoal = require('../models/improvement/ImprovementGoal');
const Benefit = require('../models/improvement/Benefit');
const Cost = require('../models/improvement/Cost');
const MetricBaseline = require('../models/improvement/MetricBaseline');
const MetricTarget = require('../models/improvement/MetricTarget');

const requireTenant = (ctx) => { if (!ctx.tenantId) throw Object.assign(new Error('Tenant context required'), { statusCode: 400 }); return ctx.tenantId; };
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

// ─── State Machines ────────────────────────────────────────────────────

const OPPORTUNITY_TRANSITIONS = {
  new: ['qualified', 'rejected', 'on_hold'],
  qualified: ['approved', 'rejected', 'on_hold'],
  approved: ['on_hold', 'converted', 'implemented'],
  on_hold: ['qualified', 'approved', 'rejected'],
  rejected: [],
  converted: ['implemented'],
  implemented: [],
};

const INITIATIVE_TRANSITIONS = {
  planned: ['approved', 'cancelled', 'deferred'],
  approved: ['in_progress', 'planned', 'cancelled', 'deferred'],
  in_progress: ['review', 'on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled', 'deferred'],
  review: ['completed', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
  deferred: ['planned', 'cancelled'],
};

const TASK_TRANSITIONS = {
  pending: ['in_progress', 'blocked', 'cancelled', 'skipped'],
  in_progress: ['completed', 'failed', 'blocked', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  skipped: [],
  cancelled: [],
  blocked: ['pending', 'cancelled'],
};

const GOAL_TRANSITIONS = {
  planned: ['in_progress', 'abandoned'],
  in_progress: ['at_risk', 'achieved', 'missed', 'abandoned'],
  at_risk: ['in_progress', 'achieved', 'missed', 'abandoned'],
  achieved: [],
  missed: ['in_progress', 'abandoned'],
  abandoned: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Opportunity CRUD ──────────────────────────────────────────────────

exports.listOpportunities = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['status', 'category', 'priority', 'source', 'assignedTo']) };
  if (query.search) filter.$or = [{ title: { $regex: query.search, $options: 'i' } }, { description: { $regex: query.search, $options: 'i' } }];
  return ImprovementOpportunity.find(filter).sort({ createdAt: -1 });
};

exports.getOpportunity = async (ctx, opportunityId) => {
  const tenantId = requireTenant(ctx);
  const opp = await ImprovementOpportunity.findOne({ _id: opportunityId, tenantId, isDeleted: false });
  if (!opp) throw Object.assign(new Error('Improvement opportunity not found'), { statusCode: 404 });
  return opp;
};

exports.createOpportunity = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'IMP');
  const opp = await ImprovementOpportunity.create({ ...data, tenantId, number, submittedBy: actor.userId, createdBy: actor.userId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'improvementOpportunity.create', entityType: 'ImprovementOpportunity', entityId: opp._id });
  return opp;
};

exports.updateOpportunity = async (ctx, opportunityId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const opp = await ImprovementOpportunity.findOne({ _id: opportunityId, tenantId, isDeleted: false });
  if (!opp) throw Object.assign(new Error('Improvement opportunity not found'), { statusCode: 404 });
  const allowed = ['title', 'description', 'source', 'category', 'priority', 'status', 'impact', 'effort', 'risk', 'assignedTo', 'rejectionReason', 'metadata'];
  Object.assign(opp, pick(data, allowed));
  await opp.save();
  return opp;
};

exports.transitionOpportunity = async (ctx, opportunityId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const opp = await ImprovementOpportunity.findOne({ _id: opportunityId, tenantId, isDeleted: false });
  if (!opp) throw Object.assign(new Error('Improvement opportunity not found'), { statusCode: 404 });
  if (!canTransition(opp.status, targetStatus, { new: ['qualified', 'rejected', 'on_hold'], qualified: ['approved', 'rejected', 'on_hold'], approved: ['on_hold', 'converted', 'implemented'], on_hold: ['qualified', 'approved', 'rejected'], rejected: [], converted: ['implemented'], implemented: [] })) {
    throw Object.assign(new Error(`Invalid transition from ${opp.status} to ${targetStatus}`), { statusCode: 422 });
  }
  const oldStatus = opp.status;
  opp.status = targetStatus;
  if (targetStatus === 'qualified') { opp.qualifiedBy = actor.userId; opp.qualifiedAt = new Date(); }
  if (targetStatus === 'approved') { opp.approvedBy = actor.userId; opp.approvedAt = new Date(); }
  if (targetStatus === 'converted') { opp.initiativeId = data.initiativeId; }
  await opp.save();
  emitEvent(tenantId, 'improvement.opportunity.transitioned', { opportunityId: opp._id, oldStatus, newStatus: targetStatus });
  return opp;
};

exports.deleteOpportunity = async (ctx, opportunityId, actor) => {
  const tenantId = requireTenant(ctx);
  const opp = await ImprovementOpportunity.findOne({ _id: opportunityId, tenantId, isDeleted: false });
  if (!opp) throw Object.assign(new Error('Improvement opportunity not found'), { statusCode: 404 });
  opp.isDeleted = true; opp.deletedAt = new Date(); opp.deletedBy = actor.userId;
  await opp.save();
  return { success: true };
};

// ─── Initiative CRUD ──────────────────────────────────────────────────

exports.listInitiatives = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['status', 'type', 'priority', 'sponsorId', 'ownerId']) };
  if (query.search) filter.$or = [{ title: { $regex: query.search, $options: 'i' } }, { description: { $regex: query.search, $options: 'i' } }];
  return ImprovementInitiative.find(filter).sort({ createdAt: -1 });
};

exports.getInitiative = async (ctx, initiativeId) => {
  const tenantId = requireTenant(ctx);
  const init = await ImprovementInitiative.findOne({ _id: initiativeId, tenantId, isDeleted: false });
  if (!init) throw Object.assign(new Error('Improvement initiative not found'), { statusCode: 404 });
  return init;
};

exports.getInitiativeWithDetails = async (ctx, initiativeId) => {
  const tenantId = requireTenant(ctx);
  const [init, tasks, goals, benefits, costs, baselines, targets] = await Promise.all([
    ImprovementInitiative.findOne({ _id: initiativeId, tenantId, isDeleted: false }),
    ImprovementTask.find({ tenantId, initiativeId, isDeleted: false }).sort({ createdAt: 1 }),
    ImprovementGoal.find({ tenantId, initiativeId, isDeleted: false }).sort({ createdAt: 1 }),
    Benefit.find({ tenantId, initiativeId, isDeleted: false }),
    Cost.find({ tenantId, initiativeId, isDeleted: false }),
    MetricBaseline.find({ tenantId, initiativeId, isDeleted: false, isActive: true }),
    MetricTarget.find({ tenantId, initiativeId, isDeleted: false }),
  ]);
  if (!init) throw Object.assign(new Error('Improvement initiative not found'), { statusCode: 404 });
  return { ...init.toObject(), tasks, goals, benefits, costs, baselines, targets };
};

exports.createInitiative = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'INIT');
  const init = await ImprovementInitiative.create({ ...data, tenantId, number, createdBy: actor.userId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'improvementInitiative.create', entityType: 'ImprovementInitiative', entityId: init._id });
  return init;
};

exports.updateInitiative = async (ctx, initiativeId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const init = await ImprovementInitiative.findOne({ _id: initiativeId, tenantId, isDeleted: false });
  if (!init) throw Object.assign(new Error('Improvement initiative not found'), { statusCode: 404 });
  const allowed = ['title', 'description', 'type', 'priority', 'status', 'startDate', 'endDate', 'plannedStartDate', 'plannedEndDate', 'sponsorId', 'ownerId', 'teamId', 'budget', 'currency', 'baselineMetrics', 'targetMetrics', 'benefits', 'costs', 'risks', 'metadata'];
  Object.assign(init, pick(data, allowed));
  await init.save();
  return init;
};

exports.transitionInitiative = async (ctx, initiativeId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const init = await ImprovementInitiative.findOne({ _id: initiativeId, tenantId, isDeleted: false });
  if (!init) throw Object.assign(new Error('Improvement initiative not found'), { statusCode: 404 });
  const allowed = {
    planned: ['approved', 'cancelled', 'deferred'],
    approved: ['in_progress', 'planned', 'cancelled', 'deferred'],
    in_progress: ['review', 'on_hold', 'completed', 'cancelled'],
    on_hold: ['in_progress', 'cancelled', 'deferred'],
    review: ['completed', 'in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
    deferred: ['planned', 'cancelled'],
  };
  if (!allowed[init.status]?.includes(targetStatus)) throw Object.assign(new Error(`Invalid transition from ${init.status} to ${targetStatus}`), { statusCode: 422 });
  const oldStatus = init.status;
  init.status = targetStatus;
  if (targetStatus === 'in_progress' && !init.actualStartDate) init.actualStartDate = new Date();
  if (['completed', 'cancelled'].includes(targetStatus) && !init.actualEndDate) init.actualEndDate = new Date();
  await init.save();
  emitEvent(tenantId, 'improvement.initiative.transitioned', { initiativeId: init._id, oldStatus: oldStatus, newStatus: targetStatus });
  return init;
};

exports.deleteInitiative = async (ctx, initiativeId, actor) => {
  const tenantId = requireTenant(ctx);
  const init = await ImprovementInitiative.findOne({ _id: initiativeId, tenantId, isDeleted: false });
  if (!init) throw Object.assign(new Error('Improvement initiative not found'), { statusCode: 404 });
  init.isDeleted = true; init.deletedAt = new Date(); init.deletedBy = actor.userId;
  await init.save();
  return { success: true };
};

// ─── Task CRUD ────────────────────────────────────────────────────────

exports.listTasks = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['initiativeId', 'goalId', 'status', 'type', 'assigneeId']) };
  return ImprovementTask.find(filter).sort({ plannedStartDate: 1 });
};

exports.getTask = async (ctx, taskId) => {
  const tenantId = requireTenant(ctx);
  const task = await ImprovementTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Improvement task not found'), { statusCode: 404 });
  return task;
};

exports.createTask = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'ITK');
  return ImprovementTask.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateTask = async (ctx, taskId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ImprovementTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Improvement task not found'), { statusCode: 404 });
  const allowed = ['title', 'description', 'type', 'status', 'priority', 'assigneeId', 'startDate', 'endDate', 'plannedStartDate', 'plannedEndDate', 'estimatedDuration', 'dependencies', 'deliverables', 'notes', 'metadata'];
  Object.assign(task, pick(data, allowed));
  if (data.status === 'in_progress' && !task.actualStartDate) task.actualStartDate = new Date();
  if (['completed', 'failed', 'skipped'].includes(data.status) && !task.actualEndDate) {
    task.actualEndDate = new Date();
    if (task.actualStartDate) task.actualDuration = Math.round((task.actualEndDate - task.actualStartDate) / 60000);
  }
  await task.save();
  return task;
};

exports.transitionTask = async (ctx, taskId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ImprovementTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Improvement task not found'), { statusCode: 404 });
  const allowed = { pending: ['in_progress', 'blocked', 'cancelled', 'skipped'], in_progress: ['completed', 'failed', 'blocked', 'cancelled'], completed: [], failed: ['in_progress', 'cancelled'], skipped: [], cancelled: [], blocked: ['pending', 'cancelled'] };
  if (!allowed[task.status]?.includes(targetStatus)) throw Object.assign(new Error(`Invalid transition from ${task.status} to ${targetStatus}`), { statusCode: 422 });
  const oldStatus = task.status;
  task.status = targetStatus;
  if (targetStatus === 'in_progress' && !task.actualStartDate) task.actualStartDate = new Date();
  if (['completed', 'failed', 'skipped'].includes(targetStatus) && !task.actualEndDate) {
    task.actualEndDate = new Date();
    if (task.actualStartDate) task.actualDuration = Math.round((task.actualEndDate - task.actualStartDate) / 60000);
  }
  await task.save();
  return task;
};

exports.deleteTask = async (ctx, taskId, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ImprovementTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Improvement task not found'), { statusCode: 404 });
  task.isDeleted = true; task.deletedAt = new Date(); task.deletedBy = actor.userId;
  await task.save();
  return { success: true };
};

// ─── Goal CRUD ────────────────────────────────────────────────────────

exports.listGoals = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['initiativeId', 'status', 'metricName']) };
  return ImprovementGoal.find(filter).sort({ createdAt: 1 });
};

exports.getGoal = async (ctx, goalId) => {
  const tenantId = requireTenant(ctx);
  const goal = await ImprovementGoal.findOne({ _id: goalId, tenantId, isDeleted: false });
  if (!goal) throw Object.assign(new Error('Improvement goal not found'), { statusCode: 404 });
  return goal;
};

exports.createGoal = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'IGL');
  return ImprovementGoal.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateGoal = async (ctx, goalId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const goal = await ImprovementGoal.findOne({ _id: goalId, tenantId, isDeleted: false });
  if (!goal) throw Object.assign(new Error('Improvement goal not found'), { statusCode: 404 });
  const allowed = ['title', 'description', 'metricName', 'metricUnit', 'baselineValue', 'targetValue', 'currentValue', 'targetDate', 'status', 'direction', 'threshold', 'measurementFrequency', 'measurementSource', 'metadata'];
  Object.assign(goal, pick(data, allowed));
  if (data.currentValue !== undefined) {
    goal.currentValue = data.currentValue;
    goal.lastMeasuredAt = new Date();
    goal.lastMeasuredBy = actor.userId;
    // Auto-update status based on progress
    if (goal.direction === 'increase' && goal.currentValue >= goal.targetValue) goal.status = 'achieved';
    if (goal.direction === 'decrease' && goal.currentValue <= goal.targetValue) goal.status = 'achieved';
    if (goal.direction === 'maintain' && goal.currentValue === goal.targetValue) goal.status = 'achieved';
  }
  await goal.save();
  return goal;
};

exports.deleteGoal = async (ctx, goalId, actor) => {
  const tenantId = requireTenant(ctx);
  const goal = await ImprovementGoal.findOne({ _id: goalId, tenantId, isDeleted: false });
  if (!goal) throw Object.assign(new Error('Improvement goal not found'), { statusCode: 404 });
  goal.isDeleted = true; goal.deletedAt = new Date(); goal.deletedBy = actor.userId;
  await goal.save();
  return { success: true };
};

exports.updateGoalProgress = async (ctx, goalId, currentValue, actor) => {
  const tenantId = requireTenant(ctx);
  const goal = await ImprovementGoal.findOne({ _id: goalId, tenantId, isDeleted: false });
  if (!goal) throw Object.assign(new Error('Improvement goal not found'), { statusCode: 404 });
  goal.currentValue = currentValue;
  goal.lastMeasuredAt = new Date();
  goal.lastMeasuredBy = actor.userId;
  if (goal.direction === 'increase' && goal.currentValue >= goal.targetValue) goal.status = 'achieved';
  if (goal.direction === 'decrease' && goal.currentValue <= goal.targetValue) goal.status = 'achieved';
  if (goal.direction === 'maintain' && goal.currentValue === goal.targetValue) goal.status = 'achieved';
  await goal.save();
  return goal;
};

// ─── Benefits CRUD ────────────────────────────────────────────────────

exports.listBenefits = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['initiativeId', 'type', 'status']) };
  return Benefit.find(filter).sort({ createdAt: 1 });
};

exports.createBenefit = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'BEN');
  return Benefit.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateBenefit = async (ctx, benefitId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const benefit = await Benefit.findOne({ _id: benefitId, tenantId, isDeleted: false });
  if (!benefit) throw Object.assign(new Error('Benefit not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'estimatedValue', 'actualValue', 'unit', 'currency', 'realizationDate', 'isRecurring', 'recurringPeriod', 'status', 'validatedBy', 'validatedAt', 'realizationMethod', 'assumptions', 'dependencies', 'metadata'];
  Object.assign(benefit, pick(data, allowed));
  if (data.status === 'realized') { benefit.realizedAt = new Date(); benefit.realizedBy = actor.userId; }
  await benefit.save();
  return benefit;
};

exports.deleteBenefit = async (ctx, benefitId, actor) => {
  const tenantId = requireTenant(ctx);
  const benefit = await Benefit.findOne({ _id: benefitId, tenantId, isDeleted: false });
  if (!benefit) throw Object.assign(new Error('Benefit not found'), { statusCode: 404 });
  benefit.isDeleted = true; benefit.deletedAt = new Date(); benefit.deletedBy = actor.userId;
  await benefit.save();
  return { success: true };
};

// ─── Costs CRUD ──────────────────────────────────────────────────────

exports.listCosts = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['initiativeId', 'category', 'status']) };
  return Cost.find(filter).sort({ incurredAt: 1 });
};

exports.createCost = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'CST');
  return Cost.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateCost = async (ctx, costId, data) => {
  const tenantId = requireTenant(ctx);
  const cost = await Cost.findOne({ _id: costId, tenantId, isDeleted: false });
  if (!cost) throw Object.assign(new Error('Cost not found'), { statusCode: 404 });
  const allowed = ['category', 'description', 'plannedAmount', 'actualAmount', 'currency', 'incurredAt', 'paidAt', 'status', 'vendor', 'invoiceNumber', 'approvedBy', 'approvedAt', 'isRecurring', 'recurringPeriod', 'metadata'];
  Object.assign(cost, pick(data, allowed));
  await cost.save();
  return cost;
};

exports.deleteCost = async (ctx, costId, actor) => {
  const tenantId = requireTenant(ctx);
  const cost = await Cost.findOne({ _id: costId, tenantId, isDeleted: false });
  if (!cost) throw Object.assign(new Error('Cost not found'), { statusCode: 404 });
  cost.isDeleted = true; cost.deletedAt = new Date(); cost.deletedBy = actor.userId;
  await cost.save();
  return { success: true };
};

// ─── Metric Baseline CRUD ────────────────────────────────────────────

exports.listBaselines = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, isActive: true, ...pick(query, ['initiativeId', 'goalId', 'metricCategory']) };
  return MetricBaseline.find(filter).sort({ createdAt: -1 });
};

exports.createBaseline = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'MBL');
  return MetricBaseline.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateBaseline = async (ctx, baselineId, data) => {
  const tenantId = requireTenant(ctx);
  const bl = await MetricBaseline.findOne({ _id: baselineId, tenantId, isDeleted: false });
  if (!bl) throw Object.assign(new Error('Metric baseline not found'), { statusCode: 404 });
  const allowed = ['metricName', 'metricCategory', 'metricUnit', 'baselineValue', 'baselineDate', 'measurementMethod', 'dataSource', 'sampleSize', 'confidenceLevel', 'isActive', 'validFrom', 'validUntil', 'approvedBy', 'approvedAt', 'metadata'];
  Object.assign(bl, pick(data, allowed));
  await bl.save();
  return bl;
};

exports.deleteBaseline = async (ctx, baselineId, actor) => {
  const tenantId = requireTenant(ctx);
  const bl = await MetricBaseline.findOne({ _id: baselineId, tenantId, isDeleted: false });
  if (!bl) throw Object.assign(new Error('Metric baseline not found'), { statusCode: 404 });
  bl.isDeleted = true; bl.deletedAt = new Date(); bl.deletedBy = actor.userId;
  await bl.save();
  return { success: true };
};

// ─── Metric Target CRUD ──────────────────────────────────────────────

exports.listTargets = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['initiativeId', 'goalId', 'status', 'metricCategory']) };
  return MetricTarget.find(filter).sort({ targetDate: 1 });
};

exports.getTarget = async (ctx, targetId) => {
  const tenantId = requireTenant(ctx);
  const target = await MetricTarget.findOne({ _id: targetId, tenantId, isDeleted: false });
  if (!target) throw Object.assign(new Error('Metric target not found'), { statusCode: 404 });
  return target;
};

exports.createTarget = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'MTR');
  return MetricTarget.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateTarget = async (ctx, targetId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const target = await MetricTarget.findOne({ _id: targetId, tenantId, isDeleted: false });
  if (!target) throw Object.assign(new Error('Metric target not found'), { statusCode: 404 });
  const allowed = ['metricName', 'metricCategory', 'metricUnit', 'targetValue', 'currentValue', 'targetDate', 'baselineId', 'baselineValue', 'measurementFrequency', 'dataSource', 'status', 'achievedAt', 'trend', 'metadata'];
  Object.assign(target, pick(data, allowed));
  if (data.currentValue !== undefined) {
    target.currentValue = data.currentValue;
    target.lastMeasuredAt = new Date();
    target.lastMeasuredBy = actor.userId;
    if (target.baselineValue !== undefined && target.baselineValue !== null && target.targetValue !== undefined && target.targetValue !== null) {
      target.improvementPercentage = ((target.currentValue - target.baselineValue) / (target.targetValue - target.baselineValue)) * 100;
    }
    // Update trend
    if (target.lastMeasuredAt && target.currentValue !== undefined) {
      const lastTarget = await MetricTarget.findOne({ _id: { $ne: target._id }, metricName: target.metricName, tenantId, lastMeasuredAt: { $lt: target.lastMeasuredAt } }).sort({ lastMeasuredAt: -1 });
      if (lastTarget && lastTarget.currentValue !== undefined) {
        if (target.currentValue > lastTarget.currentValue) target.trend = 'improving';
        else if (target.currentValue < lastTarget.currentValue) target.trend = 'declining';
        else target.trend = 'stable';
      }
    }
    // Auto-update status
    if (target.currentValue !== undefined && target.targetValue !== undefined) {
      if ((target.baselineValue <= target.targetValue && target.currentValue >= target.targetValue) ||
          (target.baselineValue >= target.targetValue && target.currentValue <= target.targetValue)) {
        target.status = 'achieved';
        target.achievedAt = new Date();
      }
    }
  }
  await target.save();
  return target;
};

exports.deleteTarget = async (ctx, targetId, actor) => {
  const tenantId = requireTenant(ctx);
  const target = await MetricTarget.findOne({ _id: targetId, tenantId, isDeleted: false });
  if (!target) throw Object.assign(new Error('Metric target not found'), { statusCode: 404 });
  target.isDeleted = true; target.deletedAt = new Date(); target.deletedBy = actor.userId;
  await target.save();
  return { success: true };
};

// ─── Dashboard / Analytics ──────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [opportunities, initiatives, tasks, goals, benefits, costs, baselines, targets] = await Promise.all([
    ImprovementOpportunity.find({ tenantId, isDeleted: false }),
    ImprovementInitiative.find({ tenantId, isDeleted: false }),
    ImprovementTask.find({ tenantId, isDeleted: false }),
    ImprovementGoal.find({ tenantId, isDeleted: false }),
    Benefit.find({ tenantId, isDeleted: false }),
    Cost.find({ tenantId, isDeleted: false }),
    MetricBaseline.find({ tenantId, isDeleted: false, isActive: true }),
    MetricTarget.find({ tenantId, isDeleted: false }),
  ]);

  const oppStatusBreakdown = {};
  for (const o of opportunities) oppStatusBreakdown[o.status] = (oppStatusBreakdown[o.status] || 0) + 1;
  const initStatusBreakdown = {};
  for (const i of initiatives) initStatusBreakdown[i.status] = (initStatusBreakdown[i.status] || 0) + 1;
  const taskStatusBreakdown = {};
  for (const t of tasks) taskStatusBreakdown[t.status] = (taskStatusBreakdown[t.status] || 0) + 1;
  const goalStatusBreakdown = {};
  for (const g of goals) goalStatusBreakdown[g.status] = (goalStatusBreakdown[g.status] || 0) + 1;

  const totalEstimatedBenefits = benefits.reduce((sum, b) => sum + (b.estimatedValue || 0), 0);
  const totalActualBenefits = benefits.reduce((sum, b) => sum + (b.actualValue || 0), 0);
  const totalPlannedCosts = costs.reduce((sum, c) => sum + (c.plannedAmount || 0), 0);
  const totalActualCosts = costs.reduce((sum, c) => sum + (c.actualAmount || 0), 0);
  const roi = totalActualCosts > 0 ? ((totalActualBenefits - totalActualCosts) / totalActualCosts) * 100 : 0;

  const achievedGoals = goals.filter(g => g.status === 'achieved').length;
  const atRiskGoals = goals.filter(g => g.status === 'at_risk').length;
  const achievedTargets = targets.filter(t => t.status === 'achieved').length;
  const atRiskTargets = targets.filter(t => t.status === 'at_risk' || t.status === 'off_track').length;

  return {
    totalOpportunities: opportunities.length,
    opportunitiesByStatus: oppStatusBreakdown,
    totalInitiatives: initiatives.length,
    initiativesByStatus: initStatusBreakdown,
    totalTasks: tasks.length,
    tasksByStatus: taskStatusBreakdown,
    totalGoals: goals.length,
    goalsByStatus: goalStatusBreakdown,
    totalBenefits: benefits.length,
    estimatedBenefits: totalEstimatedBenefits,
    actualBenefits: totalActualBenefits,
    totalCosts: costs.length,
    plannedCosts: totalPlannedCosts,
    actualCosts: totalActualCosts,
    roi: Math.round(roi * 100) / 100,
    totalBaselines: baselines.length,
    activeTargets: targets.filter(t => ['active', 'at_risk', 'off_track'].includes(t.status)).length,
    achievedGoals,
    atRiskGoals,
    achievedTargets,
    atRiskTargets,
    roiPositive: totalActualBenefits >= totalActualCosts,
  };
};

exports.getInitiativeROI = async (ctx, initiativeId) => {
  const tenantId = requireTenant(ctx);
  const [benefits, costs] = await Promise.all([
    Benefit.find({ tenantId, initiativeId, isDeleted: false }),
    Cost.find({ tenantId, initiativeId, isDeleted: false }),
  ]);
  const totalBenefits = benefits.reduce((sum, b) => sum + (b.actualValue || b.estimatedValue || 0), 0);
  const totalCosts = costs.reduce((sum, c) => sum + (c.actualAmount || c.plannedAmount || 0), 0);
  const roi = totalCosts > 0 ? ((totalBenefits - totalCosts) / totalCosts) * 100 : 0;
  return { totalBenefits, totalCosts, roi: Math.round(roi * 100) / 100, benefitCount: benefits.length, costCount: costs.length };
};

module.exports.pick = pick;
module.exports.canTransition = (current, target, transitions) => transitions[current]?.includes(target) || false;
