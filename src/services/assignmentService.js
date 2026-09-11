/**
 * Assignment / Routing / Advanced Work Distribution service.
 */
const mongoose = require('mongoose');
const numberingService = require('./numbering.service');
const auditEventService = require('./auditEventService');
const { emitEvent } = require('../realtime/socketManager');

// Register assignment and routing models before retrieving them from Mongoose.
require('../models/assignment/AssignmentRule');
require('../models/assignment/Queue');
require('../models/assignment/AgentPresence');
require('../models/assignment/AgentCapacity');
require('../models/assignment/Skill');
require('../models/assignment/AgentSkill');
require('../models/assignment/RoutingRule');
require('../models/assignment/AssignmentEvent');
require('../models/Agent');

const requireTenant = (ctx) => { if (!ctx.tenantId) throw Object.assign(new Error('Tenant context required'), { statusCode: 400 }); return ctx.tenantId; };
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const AssignmentRule = mongoose.model('AssignmentRule');
const Queue = mongoose.model('Queue');
const AgentPresence = mongoose.model('AgentPresence');
const AgentCapacity = mongoose.model('AgentCapacity');
const Skill = mongoose.model('Skill');
const AgentSkill = mongoose.model('AgentSkill');
const RoutingRule = mongoose.model('RoutingRule');
const AssignmentEvent = mongoose.model('AssignmentEvent');
const Agent = mongoose.model('Agent');

// ─── Condition Matching ─────────────────────────────────────────────────

function matchesCondition(cond, ticket) {
  const val = ticket[cond.field];
  switch (cond.operator) {
    case 'equals': return val === cond.value;
    case 'not_equals': return val !== cond.value;
    case 'in': return Array.isArray(cond.value) && cond.value.includes(val);
    case 'not_in': return Array.isArray(cond.value) && !cond.value.includes(val);
    case 'contains': return typeof val === 'string' && val.includes(cond.value);
    case 'gt': return val > cond.value;
    case 'lt': return val < cond.value;
    case 'gte': return val >= cond.value;
    case 'lte': return val <= cond.value;
    case 'starts_with': return typeof val === 'string' && val.startsWith(cond.value);
    case 'ends_with': return typeof val === 'string' && val.endsWith(cond.value);
    case 'is_empty': return !val;
    case 'is_not_empty': return !!val;
    default: return false;
  }
}

function matchesConditions(conditions, ticket) {
  if (!conditions || !conditions.rules || !conditions.rules.length) return true;
  if (conditions.matchAll) return conditions.rules.every(r => matchesCondition(r, ticket));
  return conditions.rules.some(r => matchesCondition(r, ticket));
}

// ─── Assignment Rules ───────────────────────────────────────────────────

exports.listRules = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['isActive']) };
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }];
  return AssignmentRule.find(filter).sort({ priority: -1 });
};

exports.getRule = async (ctx, ruleId) => {
  const tenantId = requireTenant(ctx);
  const rule = await AssignmentRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Assignment rule not found'), { statusCode: 404 });
  return rule;
};

exports.createRule = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'ARULE');
  const rule = await AssignmentRule.create({ ...data, tenantId, number, createdBy: actor.userId });
  await auditEventService.log({ tenantId, actorId: actor.userId, action: 'assignmentRule.create', entityType: 'AssignmentRule', entityId: rule._id });
  return rule;
};

exports.updateRule = async (ctx, ruleId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const rule = await AssignmentRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Assignment rule not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'isActive', 'priority', 'conditions', 'actions', 'assignmentStrategy', 'targetGroups', 'targetAgents', 'requiredSkills', 'fallbackAction'];
  Object.assign(rule, pick(data, allowed));
  await rule.save();
  return rule;
};

exports.deleteRule = async (ctx, ruleId, actor) => {
  const tenantId = requireTenant(ctx);
  const rule = await AssignmentRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Assignment rule not found'), { statusCode: 404 });
  rule.isDeleted = true; rule.deletedAt = new Date(); rule.deletedBy = actor.userId;
  await rule.save();
  return { success: true };
};

// ─── Queues ─────────────────────────────────────────────────────────────

exports.listQueues = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['isActive', 'type', 'department']) };
  return Queue.find(filter).sort({ order: 1, name: 1 });
};

exports.getQueue = async (ctx, queueId) => {
  const tenantId = requireTenant(ctx);
  const queue = await Queue.findOne({ _id: queueId, tenantId, isDeleted: false });
  if (!queue) throw Object.assign(new Error('Queue not found'), { statusCode: 404 });
  return queue;
};

exports.createQueue = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'QUEUE');
  return Queue.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateQueue = async (ctx, queueId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const queue = await Queue.findOne({ _id: queueId, tenantId, isDeleted: false });
  if (!queue) throw Object.assign(new Error('Queue not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'type', 'isActive', 'isDefault', 'department', 'service', 'topic', 'conditions', 'members', 'routingStrategy', 'overflowAction', 'overflowAfterMinutes', 'order'];
  Object.assign(queue, pick(data, allowed));
  await queue.save();
  return queue;
};

exports.deleteQueue = async (ctx, queueId, actor) => {
  const tenantId = requireTenant(ctx);
  const queue = await Queue.findOne({ _id: queueId, tenantId, isDeleted: false });
  if (!queue) throw Object.assign(new Error('Queue not found'), { statusCode: 404 });
  queue.isDeleted = true; queue.deletedAt = new Date(); queue.deletedBy = actor.userId;
  await queue.save();
  return { success: true };
};

exports.getQueueStats = async (ctx, queueId) => {
  const tenantId = requireTenant(ctx);
  const queue = await Queue.findOne({ _id: queueId, tenantId, isDeleted: false });
  if (!queue) throw Object.assign(new Error('Queue not found'), { statusCode: 404 });
  return { ticketCount: queue.ticketCount, openCount: queue.openCount, backlogCount: queue.backlogCount, slaBreachedCount: queue.slaBreachedCount, averageWaitMinutes: queue.averageWaitMinutes };
};

// ─── Skills ─────────────────────────────────────────────────────────────

exports.listSkills = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['isActive', 'category', 'group']) };
  if (query.search) filter.$or = [{ name: { $regex: query.search, $options: 'i' } }];
  return Skill.find(filter).sort({ name: 1 });
};

exports.getSkill = async (ctx, skillId) => {
  const tenantId = requireTenant(ctx);
  const skill = await Skill.findOne({ _id: skillId, tenantId, isDeleted: false });
  if (!skill) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
  return skill;
};

exports.createSkill = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'SKILL');
  return Skill.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateSkill = async (ctx, skillId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const skill = await Skill.findOne({ _id: skillId, tenantId, isDeleted: false });
  if (!skill) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'category', 'group', 'isActive', 'proficiencyLevels'];
  Object.assign(skill, pick(data, allowed));
  await skill.save();
  return skill;
};

exports.deleteSkill = async (ctx, skillId, actor) => {
  const tenantId = requireTenant(ctx);
  const skill = await Skill.findOne({ _id: skillId, tenantId, isDeleted: false });
  if (!skill) throw Object.assign(new Error('Skill not found'), { statusCode: 404 });
  skill.isDeleted = true; skill.deletedAt = new Date(); skill.deletedBy = actor.userId;
  await skill.save();
  return { success: true };
};

// ─── Agent Skills ───────────────────────────────────────────────────────

exports.listAgentSkills = async (ctx, agentId) => {
  const tenantId = requireTenant(ctx);
  return AgentSkill.find({ tenantId, agentId, isActive: true }).populate('skillId', 'name category');
};

exports.assignSkill = async (ctx, agentId, skillId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const existing = await AgentSkill.findOne({ tenantId, agentId, skillId });
  if (existing) {
    Object.assign(existing, pick(data, ['proficiency', 'certified', 'certifiedAt', 'expiresAt', 'notes']));
    await existing.save();
    return existing;
  }
  return AgentSkill.create({ tenantId, agentId, skillId, ...data, createdBy: actor.userId });
};

exports.removeSkill = async (ctx, agentId, skillId) => {
  const tenantId = requireTenant(ctx);
  await AgentSkill.findOneAndDelete({ tenantId, agentId, skillId });
  return { success: true };
};

// ─── Agent Presence ─────────────────────────────────────────────────────

exports.getPresence = async (ctx, agentId) => {
  const tenantId = requireTenant(ctx);
  const latest = await AgentPresence.findOne({ tenantId, agentId }).sort({ createdAt: -1 });
  return latest || { status: 'offline', agentId };
};

exports.getPresenceHistory = async (ctx, agentId, query = {}) => {
  const tenantId = requireTenant(ctx);
  return AgentPresence.find({ tenantId, agentId }).sort({ createdAt: -1 }).limit(parseInt(query.limit) || 50);
};

exports.setPresence = async (ctx, agentId, data) => {
  const tenantId = requireTenant(ctx);
  const previous = await AgentPresence.findOne({ tenantId, agentId }).sort({ createdAt: -1 });
  const event = await AgentPresence.create({
    tenantId, agentId,
    status: data.status,
    previousStatus: previous?.status,
    reason: data.reason || '',
    ticketNumber: data.ticketNumber,
    expectedReturn: data.expectedReturn,
    isManual: data.isManual !== false,
    source: data.source || 'manual',
  });
  await Agent.findByIdAndUpdate(agentId, { presence: data.status });
  emitEvent(tenantId, 'agent.presenceChanged', { agentId, status: data.status, previousStatus: previous?.status });
  return event;
};

exports.getPresenceStats = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const agents = await Agent.find({ tenantId, status: 'active' });
  const statusCounts = {};
  for (const a of agents) { statusCounts[a.presence || 'offline'] = (statusCounts[a.presence || 'offline'] || 0) + 1; }
  return { total: agents.length, byStatus: statusCounts };
};

// ─── Agent Capacity ─────────────────────────────────────────────────────

exports.getCapacity = async (ctx, agentId) => {
  const tenantId = requireTenant(ctx);
  let cap = await AgentCapacity.findOne({ tenantId, agentId });
  if (!cap) cap = await AgentCapacity.create({ tenantId, agentId, maxCapacity: 10, currentLoad: 0 });
  return cap;
};

exports.getCapacityStats = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const caps = await AgentCapacity.find({ tenantId });
  const totalCapacity = caps.reduce((s, c) => s + c.maxCapacity, 0);
  const totalLoad = caps.reduce((s, c) => s + c.currentLoad, 0);
  const overloaded = caps.filter(c => c.isOverloaded).length;
  return { totalCapacity, totalLoad, utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0, overloaded, agentCount: caps.length };
};

exports.updateCapacity = async (ctx, agentId, data) => {
  const tenantId = requireTenant(ctx);
  let cap = await AgentCapacity.findOne({ tenantId, agentId });
  if (!cap) cap = await AgentCapacity.create({ tenantId, agentId, maxCapacity: 10 });
  Object.assign(cap, pick(data, ['maxCapacity', 'overrides']));
  cap.utilizationPercent = cap.maxCapacity > 0 ? Math.round((cap.currentLoad / cap.maxCapacity) * 100) : 0;
  cap.isOverloaded = cap.currentLoad >= cap.maxCapacity;
  cap.lastCalculatedAt = new Date();
  await cap.save();
  return cap;
};

exports.recalculateCapacity = async (ctx, agentId) => {
  const tenantId = requireTenant(ctx);
  let cap = await AgentCapacity.findOne({ tenantId, agentId });
  if (!cap) cap = await AgentCapacity.create({ tenantId, agentId, maxCapacity: 10 });
  cap.lastCalculatedAt = new Date();
  cap.utilizationPercent = cap.maxCapacity > 0 ? Math.round((cap.currentLoad / cap.maxCapacity) * 100) : 0;
  cap.isOverloaded = cap.currentLoad >= cap.maxCapacity;
  await cap.save();
  return cap;
};

// ─── Routing Rules ──────────────────────────────────────────────────────

exports.listRoutingRules = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ['isActive', 'source', 'department']) };
  return RoutingRule.find(filter).sort({ priority: -1 });
};

exports.getRoutingRule = async (ctx, ruleId) => {
  const tenantId = requireTenant(ctx);
  const rule = await RoutingRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Routing rule not found'), { statusCode: 404 });
  return rule;
};

exports.createRoutingRule = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, 'RRULE');
  return RoutingRule.create({ ...data, tenantId, number, createdBy: actor.userId });
};

exports.updateRoutingRule = async (ctx, ruleId, data) => {
  const tenantId = requireTenant(ctx);
  const rule = await RoutingRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Routing rule not found'), { statusCode: 404 });
  const allowed = ['name', 'description', 'isActive', 'priority', 'source', 'department', 'conditions', 'targetQueue', 'targetGroup', 'targetAgent', 'routingMethod', 'requiredSkills', 'fallbackQueue', 'fallbackGroup', 'autoAssign', 'notifyOnAssign'];
  Object.assign(rule, pick(data, allowed));
  await rule.save();
  return rule;
};

exports.deleteRoutingRule = async (ctx, ruleId, actor) => {
  const tenantId = requireTenant(ctx);
  const rule = await RoutingRule.findOne({ _id: ruleId, tenantId, isDeleted: false });
  if (!rule) throw Object.assign(new Error('Routing rule not found'), { statusCode: 404 });
  rule.isDeleted = true; rule.deletedAt = new Date(); rule.deletedBy = actor.userId;
  await rule.save();
  return { success: true };
};

// ─── Assignment Events ──────────────────────────────────────────────────

exports.logEvent = async (ctx, data) => {
  const tenantId = requireTenant(ctx);
  return AssignmentEvent.create({ ...data, tenantId });
};

exports.getHistory = async (ctx, ticketId) => {
  const tenantId = requireTenant(ctx);
  return AssignmentEvent.find({ tenantId, ticketId }).sort({ createdAt: -1 });
};

exports.getHistoryByNumber = async (ctx, ticketNumber) => {
  const tenantId = requireTenant(ctx);
  return AssignmentEvent.find({ tenantId, ticketNumber }).sort({ createdAt: -1 });
};

exports.getRecentEvents = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, ...pick(query, ['eventType', 'fromAgent', 'toAgent', 'method']) };
  return AssignmentEvent.find(filter).sort({ createdAt: -1 }).limit(parseInt(query.limit) || 50);
};

// ─── Core Assignment Logic ──────────────────────────────────────────────

exports.evaluateRules = async (ctx, ticket) => {
  const tenantId = requireTenant(ctx);
  const rules = await AssignmentRule.find({ tenantId, isActive: true, isDeleted: false }).sort({ priority: -1 });
  for (const rule of rules) {
    if (matchesConditions(rule.conditions, ticket)) {
      rule.hitCount = (rule.hitCount || 0) + 1;
      rule.lastHitAt = new Date();
      await rule.save();
      return rule;
    }
  }
  return null;
};

exports.evaluateRoutingRules = async (ctx, ticket) => {
  const tenantId = requireTenant(ctx);
  const rules = await RoutingRule.find({ tenantId, isActive: true, isDeleted: false }).sort({ priority: -1 });
  for (const rule of rules) {
    if (matchesConditions(rule.conditions, ticket)) {
      rule.hitCount = (rule.hitCount || 0) + 1;
      rule.lastHitAt = new Date();
      await rule.save();
      return rule;
    }
  }
  return null;
};

exports.findBestAgent = async (ctx, options = {}) => {
  const tenantId = requireTenant(ctx);
  const { skills = [], department, group, strategy = 'round_robin' } = options;
  const agentFilter = { status: 'active' };
  if (department) agentFilter.departments = department;
  if (group) agentFilter.teams = group;
  const agents = await Agent.find(agentFilter);
  if (!agents.length) return null;

  let candidates = agents;
  if (skills.length) {
    const agentSkills = await AgentSkill.find({ tenantId, skillId: { $in: skills }, isActive: true });
    const agentSkillMap = {};
    for (const as of agentSkills) {
      if (!agentSkillMap[as.agentId]) agentSkillMap[as.agentId] = [];
      agentSkillMap[as.agentId].push(as.skillId.toString());
    }
    candidates = agents.filter(a => {
      const asList = agentSkillMap[a._id.toString()] || [];
      return skills.every(s => asList.includes(s.toString()));
    });
  }
  if (!candidates.length) return null;

  const available = candidates.filter(a => ['available', 'busy'].includes(a.presence));
  if (!available.length) return candidates[0];

  switch (strategy) {
    case 'round_robin':
    case 'least_workload':
      return available.sort((a, b) => (a.lockedTickets?.length || 0) - (b.lockedTickets?.length || 0))[0];
    case 'skill_based':
      return available[0];
    case 'availability':
      return available.find(a => a.presence === 'available') || available[0];
    default:
      return available[0];
  }
};

// ─── Work Offer ─────────────────────────────────────────────────────────

exports.offerWork = async (ctx, ticketId, agentId, actor) => {
  const tenantId = requireTenant(ctx);
  const event = await AssignmentEvent.create({
    tenantId, ticketId, ticketNumber: 'TBD',
    eventType: 'assign', toAgent: agentId,
    method: 'auto', reason: 'Work offered',
    performedBy: actor.userId,
  });
  emitEvent(tenantId, 'work.offered', { ticketId, agentId, eventId: event._id });
  return event;
};

exports.acceptWork = async (ctx, ticketId, agentId, actor) => {
  const tenantId = requireTenant(ctx);
  return AssignmentEvent.create({
    tenantId, ticketId, ticketNumber: 'TBD',
    eventType: 'accept', toAgent: agentId,
    method: 'manual', reason: 'Agent accepted work',
    performedBy: actor.userId,
  });
};

exports.declineWork = async (ctx, ticketId, agentId, reason, actor) => {
  const tenantId = requireTenant(ctx);
  return AssignmentEvent.create({
    tenantId, ticketId, ticketNumber: 'TBD',
    eventType: 'decline', fromAgent: agentId,
    method: 'manual', reason: reason || 'Agent declined',
    performedBy: actor.userId,
  });
};

// ─── Dashboard ──────────────────────────────────────────────────────────

exports.getDashboard = async (ctx) => {
  const tenantId = requireTenant(ctx);
  const [queues, rules, routingRules, skills, agents, caps] = await Promise.all([
    Queue.find({ tenantId, isDeleted: false }),
    AssignmentRule.find({ tenantId, isDeleted: false }),
    RoutingRule.find({ tenantId, isDeleted: false }),
    Skill.find({ tenantId, isDeleted: false }),
    Agent.find({ tenantId, status: 'active' }),
    AgentCapacity.find({ tenantId }),
  ]);

  const totalTickets = queues.reduce((s, q) => s + (q.ticketCount || 0), 0);
  const openTickets = queues.reduce((s, q) => s + (q.openCount || 0), 0);
  const totalCapacity = caps.reduce((s, c) => s + c.maxCapacity, 0);
  const totalLoad = caps.reduce((s, c) => s + c.currentLoad, 0);
  const overloaded = caps.filter(c => c.isOverloaded).length;
  const statusCounts = {};
  for (const a of agents) { statusCounts[a.presence || 'offline'] = (statusCounts[a.presence || 'offline'] || 0) + 1; }

  return {
    queues: queues.length, totalTickets, openTickets,
    assignmentRules: rules.length, activeRules: rules.filter(r => r.isActive).length,
    routingRules: routingRules.length, activeRoutingRules: routingRules.filter(r => r.isActive).length,
    skills: skills.length, activeSkills: skills.filter(s => s.isActive).length,
    agents: agents.length, totalCapacity, totalLoad,
    utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
    overloaded, agentPresence: statusCounts,
  };
};

// ─── Routing Diagnostics ────────────────────────────────────────────────

exports.diagnose = async (ctx, ticket) => {
  const tenantId = requireTenant(ctx);
  const results = { rules: [], routingRules: [], bestAgent: null, skills: [], queues: [] };

  // Check assignment rules
  const aRules = await AssignmentRule.find({ tenantId, isActive: true, isDeleted: false }).sort({ priority: -1 });
  for (const r of aRules) {
    if (matchesConditions(r.conditions, ticket)) results.rules.push({ id: r._id, name: r.name, matched: true });
    else results.rules.push({ id: r._id, name: r.name, matched: false });
  }

  // Check routing rules
  const rRules = await RoutingRule.find({ tenantId, isActive: true, isDeleted: false }).sort({ priority: -1 });
  for (const r of rRules) {
    if (matchesConditions(r.conditions, ticket)) results.routingRules.push({ id: r._id, name: r.name, matched: true });
    else results.routingRules.push({ id: r._id, name: r.name, matched: false });
  }

  // Find best agent
  results.bestAgent = await exports.findBestAgent(ctx, { strategy: 'round_robin' });

  return results;
};

module.exports.matchesCondition = matchesCondition;
module.exports.matchesConditions = matchesConditions;
