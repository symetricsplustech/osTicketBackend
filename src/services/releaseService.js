/**
 * Release Management service — unified engine for release lifecycle,
 * phases, tasks, components, dependencies, approvals, deployments, and rollbacks.
 */
const mongoose = require('mongoose');
const numberingService = require('./numbering.service');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

// Register release models before retrieving them from Mongoose's registry.
require('../models/release/Release');
require('../models/release/ReleasePhase');
require('../models/release/ReleaseTask');
require('../models/release/ReleaseComponent');
require('../models/release/ReleaseDependency');
require('../models/release/ReleaseApproval');
require('../models/release/ReleaseDeployment');
require('../models/helpdesk/incidents/Change');
require('../models/cmdb/ConfigurationItem');
require('../models/cmdb/BusinessService');

const requireTenant = (ctx) => { if (!ctx.tenantId) throw Object.assign(new Error('Tenant context required'), { statusCode: 400 }); return ctx.tenantId; };
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const Release = mongoose.model('Release');
const ReleasePhase = mongoose.model('ReleasePhase');
const ReleaseTask = mongoose.model('ReleaseTask');
const ReleaseComponent = mongoose.model('ReleaseComponent');
const ReleaseDependency = mongoose.model('ReleaseDependency');
const ReleaseApproval = mongoose.model('ReleaseApproval');
const ReleaseDeployment = mongoose.model('ReleaseDeployment');
const Change = mongoose.model('Change');
const ConfigurationItem = mongoose.model('ConfigurationItem');
const BusinessService = mongoose.model('BusinessService');

// ─── Release CRUD ──────────────────────────────────────────────────────

exports.listReleases = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['status', 'type', 'environment', 'releaseManagerId', 'priority']) };
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }, { version: { $regex: query.search, $options: 'i' } }];
  return Release.find(filter).sort({ createdAt: -1 });
};

exports.getRelease = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  return release;
};

exports.createRelease = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'REL');
  const release = await Release.create({ ...data, tenantId, number, createdBy: actor.userId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'release.create', entityType: 'Release', entityId: release._id });
  return release;
};

exports.updateRelease = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'priority', 'version', 'previousVersion', 'environment', 'startDate', 'endDate', 'plannedStartDate', 'plannedEndDate', 'releaseManagerId', 'releaseCoordinatorId', 'approvalGroupId', 'isRollback', 'rollbackReleaseId', 'rollbackReason', 'rolloutStrategy', 'rolloutPercentage', 'metadata'];
  Object.assign(release, pick(data, allowed));
  await release.save();
  return release;
};

exports.deleteRelease = async (ctx, releaseId, actor) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  release.isDeleted = true; release.deletedAt = new Date(); release.deletedBy = actor.userId;
  await release.save();
  return { success: true };
};

// ─── State Transitions ─────────────────────────────────────────────────

const RELEASE_TRANSITIONS = {
  planning: ['build', 'cancelled'],
  build: ['test', 'planning', 'cancelled'],
  test: ['ready', 'build', 'cancelled'],
  ready: ['deploying', 'build', 'cancelled'],
  deploying: ['completed', 'failed', 'cancelled'],
  completed: ['planning'], // new release cycle
  failed: ['build', 'cancelled'],
  cancelled: ['planning'],
};

exports.transitionRelease = async (ctx, releaseId, targetStatus, actor) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  
  const allowed = RELEASE_TRANSITIONS[release.status] || [];
  if (!allowed.includes(targetStatus)) throw Object.assign(new Error(`Invalid transition from ${release.status} to ${targetStatus}`), { statusCode: 422 });
  
  const oldStatus = release.status;
  release.status = targetStatus;
  
  if (targetStatus === 'build' && !release.actualStartDate) release.actualStartDate = new Date();
  if (targetStatus === 'deploying' && !release.actualStartDate) release.actualStartDate = new Date();
  if (targetStatus === 'completed') release.actualEndDate = new Date();
  if (targetStatus === 'failed' && !release.actualEndDate) release.actualEndDate = new Date();
  
  await release.save();
  emitEvent(tenantId, 'release.statusChanged', { releaseId, oldStatus, newStatus: targetStatus });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'release.transition', entityType: 'Release', entityId: releaseId, before: { status: oldStatus }, after: { status: targetStatus } });
  return release;
};

// ─── Phase CRUD ────────────────────────────────────────────────────────

exports.listPhases = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  return ReleasePhase.find({ tenantId, releaseId, isDeleted: false }).sort({ order: 1 });
};

exports.getPhase = async (ctx, phaseId) => {
  const tenantId = requireTenant(ctx);
  const phase = await ReleasePhase.findOne({ _id: phaseId, tenantId, isDeleted: false });
  if (!phase) throw Object.assign(new Error('Release phase not found'), { statusCode: 404 });
  return phase;
};

exports.createPhase = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  
  const maxOrder = await ReleasePhase.findOne({ tenantId, releaseId, isDeleted: false }).sort({ order: -1 });
  const order = (maxOrder?.order || 0) + 1;
  
  const number = await numberingService.nextNumber(tenantId, 'RPH');
  return ReleasePhase.create({ ...data, tenantId, releaseId, number, order, createdBy: actor.userId });
};

exports.updatePhase = async (ctx, phaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const phase = await ReleasePhase.findOne({ _id: phaseId, tenantId, isDeleted: false });
  if (!phase) throw Object.assign(new Error('Release phase not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'status', 'startDate', 'endDate', 'plannedStartDate', 'plannedEndDate', 'ownerId', 'approverIds', 'approvalRequired', 'approvalStatus', 'gateCriteria', 'gateResult', 'metadata'];
  Object.assign(phase, pick(data, allowed));
  if (data.status === 'in_progress' && !phase.actualStartDate) phase.actualStartDate = new Date();
  if (['completed', 'failed', 'skipped'].includes(data.status) && !phase.actualEndDate) phase.actualEndDate = new Date();
  await phase.save();
  return phase;
};

exports.deletePhase = async (ctx, phaseId, actor) => {
  const tenantId = requireTenant(ctx);
  const phase = await ReleasePhase.findOne({ _id: phaseId, tenantId, isDeleted: false });
  if (!phase) throw Object.assign(new Error('Release phase not found'), { statusCode: 404 });
  phase.isDeleted = true; phase.deletedAt = new Date(); phase.deletedBy = actor.userId;
  await phase.save();
  return { success: true };
};

// ─── Task CRUD ─────────────────────────────────────────────────────────

exports.listTasks = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['releaseId', 'phaseId', 'status', 'type', 'assigneeId']) };
  return ReleaseTask.find(filter).sort({ createdAt: 1 });
};

exports.getTask = async (ctx, taskId) => {
  const tenantId = requireTenant(ctx);
  const task = await ReleaseTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Release task not found'), { statusCode: 404 });
  return task;
};

exports.createTask = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'RTK');
  return ReleaseTask.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateTask = async (ctx, taskId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ReleaseTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Release task not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'status', 'priority', 'assigneeId', 'startDate', 'endDate', 'plannedStartDate', 'plannedEndDate', 'estimatedDuration', 'dependencies', 'isAutomated', 'automationScript', 'automationParams', 'scriptOutput', 'scriptExitCode', 'rollbackTaskId', 'isRollbackTask', 'metadata'];
  Object.assign(task, pick(data, allowed));
  if (data.status === 'in_progress' && !task.actualStartDate) task.actualStartDate = new Date();
  if (['completed', 'failed', 'skipped'].includes(data.status) && !task.actualEndDate) {
    task.actualEndDate = new Date();
    if (task.actualStartDate) task.actualDuration = Math.round((task.actualEndDate - task.actualStartDate) / 60000);
  }
  await task.save();
  return task;
};

exports.deleteTask = async (ctx, taskId, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ReleaseTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Release task not found'), { statusCode: 404 });
  task.isDeleted = true; task.deletedAt = new Date(); task.deletedBy = actor.userId;
  await task.save();
  return { success: true };
};

exports.executeTask = async (ctx, taskId, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await ReleaseTask.findOne({ _id: taskId, tenantId, isDeleted: false });
  if (!task) throw Object.assign(new Error('Release task not found'), { statusCode: 404 });
  if (task.status !== 'pending') throw Object.assign(new Error('Task not in pending status'), { statusCode: 400 });
  
  task.status = 'in_progress';
  task.actualStartDate = new Date();
  await task.save();
  
  // If automated, execute script (placeholder)
  if (task.isAutomated && task.automationScript) {
    // In production: execute script, capture output, exit code
    task.scriptOutput = 'Executed successfully';
    task.scriptExitCode = 0;
    task.status = 'completed';
    task.actualEndDate = new Date();
    task.actualDuration = Math.round((task.actualEndDate - task.actualStartDate) / 60000);
    await task.save();
  }
  
  return task;
};

// ─── Component CRUD ────────────────────────────────────────────────────

exports.listComponents = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  return ReleaseComponent.find({ tenantId, releaseId, isDeleted: false }).sort({ name: 1 });
};

exports.getComponent = async (ctx, componentId) => {
  const tenantId = requireTenant(ctx);
  const comp = await ReleaseComponent.findOne({ _id: componentId, tenantId, isDeleted: false });
  if (!comp) throw Object.assign(new Error('Release component not found'), { statusCode: 404 });
  return comp;
};

exports.createComponent = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'RCMP');
  return ReleaseComponent.create({ ...data, tenantId, releaseId, number, createdBy: actor.userId });
};

exports.updateComponent = async (ctx, componentId, data) => {
  const tenantId = requireTenant(ctx);
  const comp = await ReleaseComponent.findOne({ _id: componentId, tenantId, isDeleted: false });
  if (!comp) throw Object.assign(new Error('Release component not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'version', 'previousVersion', 'sourceRepository', 'sourceBranch', 'commitHash', 'buildArtifact', 'buildUrl', 'buildStatus', 'artifactUrl', 'artifactChecksum', 'environment', 'deployedAt', 'deployedBy', 'deploymentStatus', 'metadata'];
  Object.assign(comp, pick(data, allowed));
  await comp.save();
  return comp;
};

exports.deleteComponent = async (ctx, componentId, actor) => {
  const tenantId = requireTenant(ctx);
  const comp = await ReleaseComponent.findOne({ _id: componentId, tenantId, isDeleted: false });
  if (!comp) throw Object.assign(new Error('Release component not found'), { statusCode: 404 });
  comp.isDeleted = true; comp.deletedAt = new Date(); comp.deletedBy = actor.userId;
  await comp.save();
  return { success: true };
};

// ─── Dependency CRUD ──────────────────────────────────────────────────

exports.listDependencies = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  return ReleaseDependency.find({ tenantId, releaseId, isDeleted: false }).sort({ createdAt: -1 });
};

exports.getDependency = async (ctx, depId) => {
  const tenantId = requireTenant(ctx);
  const dep = await ReleaseDependency.findOne({ _id: depId, tenantId, isDeleted: false });
  if (!dep) throw Object.assign(new Error('Release dependency not found'), { statusCode: 404 });
  return dep;
};

exports.createDependency = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  return ReleaseDependency.create({ ...data, tenantId, releaseId, createdBy: actor.userId });
};

exports.updateDependency = async (ctx, depId, data) => {
  const tenantId = requireTenant(ctx);
  const dep = await ReleaseDependency.findOne({ _id: depId, tenantId, isDeleted: false });
  if (!dep) throw Object.assign(new Error('Release dependency not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'dependencyType', 'targetReleaseId', 'targetChangeId', 'targetCiId', 'targetServiceId', 'targetEnvironment', 'description', 'status', 'severity', 'resolutionNotes', 'metadata'];
  Object.assign(dep, pick(data, allowed));
  if (data.status === 'resolved') {
    dep.resolvedAt = new Date();
    dep.resolvedBy = data.resolvedBy;
  }
  await dep.save();
  return dep;
};

exports.deleteDependency = async (ctx, depId, actor) => {
  const tenantId = requireTenant(ctx);
  const dep = await ReleaseDependency.findOne({ _id: depId, tenantId, isDeleted: false });
  if (!dep) throw Object.assign(new Error('Release dependency not found'), { statusCode: 404 });
  dep.isDeleted = true; dep.deletedAt = new Date(); dep.deletedBy = actor.userId;
  await dep.save();
  return { success: true };
};

// ─── Approval CRUD ────────────────────────────────────────────────────

exports.listApprovals = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  return ReleaseApproval.find({ tenantId, releaseId, isDeleted: false }).sort({ createdAt: -1 });
};

exports.getApproval = async (ctx, approvalId) => {
  const tenantId = requireTenant(ctx);
  const approval = await ReleaseApproval.findOne({ _id: approvalId, tenantId, isDeleted: false });
  if (!approval) throw Object.assign(new Error('Release approval not found'), { statusCode: 404 });
  return approval;
};

exports.createApproval = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'RAP');
  const approvers = (data.approverIds || []).map(id => ({ userId: id, status: 'pending' }));
  return ReleaseApproval.create({ ...data, tenantId, releaseId, number, approvers, createdBy: actor.userId });
};

exports.decideApproval = async (ctx, approvalId, userId, decision, comment) => {
  const tenantId = requireTenant(ctx);
  const approval = await ReleaseApproval.findOne({ _id: approvalId, tenantId, isDeleted: false });
  if (!approval) throw Object.assign(new Error('Release approval not found'), { statusCode: 404 });
  if (approval.status !== 'pending') throw Object.assign(new Error('Approval not in pending status'), { statusCode: 400 });
  
  const approver = approval.approvers.find(a => a.userId.toString() === userId.toString());
  if (!approver) throw Object.assign(new Error('User is not an approver'), { statusCode: 403 });
  if (approver.status !== 'pending') throw Object.assign(new Error('Already decided'), { statusCode: 400 });
  
  approver.status = decision === 'approve' ? 'approved' : 'rejected';
  approver.decidedAt = new Date();
  approver.comment = comment || '';
  
  if (decision === 'approve') approval.currentApprovals = (approval.currentApprovals || 0) + 1;
  else approval.currentRejections = (approval.currentRejections || 0) + 1;
  
  // Check if approval is complete
  const pending = approval.approvers.filter(a => a.status === 'pending').length;
  const totalRequired = approval.requiredApprovals || 1;
  const currentApproved = approval.approvers.filter(a => a.status === 'approved').length;
  
  if (currentApproved >= totalRequired) {
    approval.status = 'approved';
    approval.decidedAt = new Date();
    approval.decidedBy = userId;
  } else if (approval.currentRejections > 0) {
    approval.status = 'rejected';
    approval.decidedAt = new Date();
    approval.decidedBy = userId;
  }
  
  await approval.save();
  return approval;
};

exports.deleteApproval = async (ctx, approvalId, actor) => {
  const tenantId = requireTenant(ctx);
  const approval = await ReleaseApproval.findOne({ _id: approvalId, tenantId, isDeleted: false });
  if (!approval) throw Object.assign(new Error('Release approval not found'), { statusCode: 404 });
  approval.isDeleted = true; approval.deletedAt = new Date(); approval.deletedBy = actor.userId;
  await approval.save();
  return { success: true };
};

// ─── Deployment CRUD ──────────────────────────────────────────────────

exports.listDeployments = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  return ReleaseDeployment.find({ tenantId, releaseId, isDeleted: false }).sort({ environment: 1 });
};

exports.getDeployment = async (ctx, deploymentId) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Release deployment not found'), { statusCode: 404 });
  return deploy;
};

exports.createDeployment = async (ctx, releaseId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'RDEP');
  return ReleaseDeployment.create({ ...data, tenantId, releaseId, number, createdBy: actor.userId });
};

exports.updateDeployment = async (ctx, deploymentId, data) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Release deployment not found'), { statusCode: 404 });
  const allowed = ['name', 'environment', 'status', 'deploymentType', 'rolloutPercentage', 'strategy', 'scheduledAt', 'startedAt', 'completedAt', 'deployedBy', 'deployedComponents', 'preDeploymentChecks', 'postDeploymentChecks', 'metadata'];
  Object.assign(deploy, pick(data, allowed));
  if (data.status === 'in_progress' && !deploy.startedAt) deploy.startedAt = new Date();
  if (['completed', 'failed', 'rolled_back', 'cancelled'].includes(data.status) && !deploy.completedAt) deploy.completedAt = new Date();
  await deploy.save();
  return deploy;
};

exports.deleteDeployment = async (ctx, deploymentId, actor) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Release deployment not found'), { statusCode: 404 });
  deploy.isDeleted = true; deploy.deletedAt = new Date(); deploy.deletedBy = actor.userId;
  await deploy.save();
  return { success: true };
};

exports.startDeployment = async (ctx, deploymentId, actor) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Deployment not found'), { statusCode: 404 });
  if (deploy.status !== 'scheduled') throw Object.assign(new Error('Deployment not scheduled'), { statusCode: 400 });
  
  deploy.status = 'in_progress';
  deploy.startedAt = new Date();
  deploy.deployedBy = actor.userId;
  await deploy.save();
  emitEvent(tenantId, 'release.deployment.started', { deploymentId: deploy._id, releaseId: deploy.releaseId });
  return deploy;
};

exports.completeDeployment = async (ctx, deploymentId, actor) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Deployment not found'), { statusCode: 404 });
  deploy.status = 'completed';
  deploy.completedAt = new Date();
  deploy.deployedBy = actor.userId;
  await deploy.save();
  emitEvent(tenantId, 'release.deployment.completed', { deploymentId: deploy._id, releaseId: deploy.releaseId });
  return deploy;
};

exports.rollbackDeployment = async (ctx, deploymentId, reason, actor) => {
  const tenantId = requireTenant(ctx);
  const deploy = await ReleaseDeployment.findOne({ _id: deploymentId, tenantId, isDeleted: false });
  if (!deploy) throw Object.assign(new Error('Deployment not found'), { statusCode: 404 });
  if (deploy.status === 'completed') {
    deploy.status = 'rolled_back';
    deploy.rollbackReason = reason;
    deploy.rollbackInitiatedAt = new Date();
    deploy.rollbackInitiatedBy = actor.userId;
    await deploy.save();
    emitEvent(tenantId, 'release.deployment.rolled_back', { deploymentId: deploy._id, releaseId: deploy.releaseId, reason });
  }
  return deploy;
};

// ─── Change Association ────────────────────────────────────────────────

exports.associateChange = async (ctx, releaseId, changeId, actor) => {
  const tenantId = requireTenant(ctx);
  const release = await Release.findOne({ _id: releaseId, tenantId, isDeleted: false });
  if (!release) throw Object.assign(new Error('Release not found'), { statusCode: 404 });
  const change = await Change.findOne({ _id: changeId, tenantId: tenantId });
  if (!change) throw Object.assign(new Error('Change not found'), { statusCode: 404 });
  
  // In production: add to release.changes array or many-to-many
  // For now, just emit event
  emitEvent(tenantId, 'release.change.associated', { releaseId, changeId, by: actor.userId });
  return { success: true };
};

exports.removeChange = async (ctx, releaseId, changeId, actor) => {
  const tenantId = requireTenant(ctx);
  emitEvent(tenantId, 'release.change.removed', { releaseId, changeId, by: actor.userId });
  return { success: true };
};

// ─── Dashboard / Stats ─────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [releases, phases, tasks, components, deployments, approvals, dependencies] = await Promise.all([
    Release.find({ tenantId, isDeleted: false }),
    ReleasePhase.find({ tenantId, isDeleted: false }),
    ReleaseTask.find({ tenantId, isDeleted: false }),
    ReleaseComponent.find({ tenantId, isDeleted: false }),
    ReleaseDeployment.find({ tenantId, isDeleted: false }),
    ReleaseApproval.find({ tenantId, isDeleted: false }),
    ReleaseDependency.find({ tenantId, isDeleted: false }),
  ]);

  const statusBreakdown = {};
  for (const r of releases) statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1;
  
  const phaseStatusBreakdown = {};
  for (const p of phases) phaseStatusBreakdown[p.status] = (phaseStatusBreakdown[p.status] || 0) + 1;
  
  const taskStatusBreakdown = {};
  for (const t of tasks) taskStatusBreakdown[t.status] = (taskStatusBreakdown[t.status] || 0) + 1;
  
  const deploymentStatusBreakdown = {};
  for (const d of deployments) deploymentStatusBreakdown[d.status] = (deploymentStatusBreakdown[d.status] || 0) + 1;
  
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const pendingDependencies = dependencies.filter(d => d.status === 'pending').length;
  const blockedDependencies = dependencies.filter(d => d.status === 'blocked').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

  return {
    totalReleases: releases.length,
    activeReleases: releases.filter(r => ['build', 'test', 'ready', 'deploying'].includes(r.status)).length,
    completedReleases: releases.filter(r => r.status === 'completed').length,
    failedReleases: releases.filter(r => r.status === 'failed').length,
    statusBreakdown,
    totalPhases: phases.length,
    phaseStatusBreakdown,
    totalTasks: tasks.length,
    taskStatusBreakdown,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    totalDeployments: deployments.length,
    deploymentStatusBreakdown,
    pendingApprovals,
    pendingDependencies,
    blockedDependencies,
    failedTasks,
    blockedTasks,
  };
};

// ─── Change Association Helper ────────────────────────────────────────

exports.getReleaseChanges = async (ctx, releaseId) => {
  const tenantId = requireTenant(ctx);
  // In production, would use a proper many-to-many relationship
  return Change.find({ tenantId, releaseIds: { $in: [releaseId] } });
};

module.exports.pick = pick;
module.exports.RELEASE_TRANSITIONS = RELEASE_TRANSITIONS;
