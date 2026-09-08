const Agent = require('../models/Agent');
const Ticket = require('../models/Ticket');

const PRESENCE_WEIGHT = {
  online: 0,
  busy: 2,
  away: 4,
  on_break: 5,
  in_meeting: 5,
  dnd: 100,
  offline: 100,
};

const ROUTING_ALGORITHMS = ['round_robin', 'least_workload', 'skill_based', 'priority_based', 'availability'];

let rrIndex = new Map(); // companyId -> next agent index

/**
 * Score a candidate agent for a ticket. Lower score = better fit.
 * Factors: skill match, workload, presence, capacity, SLA (speed to answer),
 * priority, seniority (L1/L2/L3) and VIP customers (§13/§18).
 */
const LEVEL_RANK = { L1: 1, L2: 2, L3: 3 };
const scoreAgent = (agent, { requiredSkills = [], priority = 'Normal', slaHours = 0, customerTier = 'standard' } = {}) => {
  let score = 0;
  const presence = PRESENCE_WEIGHT[agent.presence] ?? 10;
  score += presence;
  const active = (agent._active || 0);
  const capacity = agent.capacity || 10;
  if (active >= capacity) score += 30;
  score += (active / Math.max(capacity, 1)) * 15;

  if (requiredSkills && requiredSkills.length) {
    const own = new Set((agent.skills || []).map((s) => String(s)));
    const missing = requiredSkills.filter((s) => !own.has(String(s))).length;
    score += missing * 12; // missing required skills weigh heavily
    if (missing === 0) score -= 5;
  }

  // priority-aware: high/emergency prefer agents with low load
  if (priority === 'High') score += (active * 2);
  if (priority === 'Emergency') score += (active * 4);

  // seniority: critical work and VIP customers prefer L3/L2 over L1
  const level = LEVEL_RANK[agent.level] || 1;
  if (priority === 'Emergency' || priority === 'High') score += (3 - level) * 4;
  if (customerTier === 'enterprise' || customerTier === 'priority') score += (3 - level) * 3;

  // SLA: tighter SLA favours faster-available agents
  if (slaHours > 0 && slaHours <= 4) score += active * 3;
  return score;
};

const ACTIVE_WORK_STATUSES = ['new', 'open', 'triaged', 'assigned', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'overdue'];

/**
 * Load active ticket counts per agent (cheap single aggregation).
 */
const loadWorkloads = async (company, agentIds) => {
  const counts = await Ticket.aggregate([
    { $match: { company, agent: { $in: agentIds }, status: { $in: ACTIVE_WORK_STATUSES } } },
    { $group: { _id: '$agent', n: { $sum: 1 } } },
  ]);
  const map = {};
  for (const c of counts) map[String(c._id)] = c.n;
  return map;
};

/**
 * findBestAgent — pick the best agent from a pool for a ticket.
 * opts: { company, deptId, teamId, requiredSkills[], priority, slaHours,
 *         customerTier, excludeAgentId, algorithm }
 */
async function findBestAgent(opts) {
  const { company, deptId, teamId, requiredSkills = [], priority = 'Normal', slaHours = 0, customerTier = 'standard', excludeAgentId, algorithm = 'skill_based' } = opts;
  let query = { isActive: true, company: company || null };
  if (deptId || teamId) {
    query.$or = [];
    if (deptId) query.$or.push({ 'departments.department': deptId });
    if (teamId) query.$or.push({ teams: teamId });
  }
  if (excludeAgentId) query._id = { $ne: excludeAgentId };
  let agents = await Agent.find(query).populate('role', 'permissions');
  if (!agents.length) return null;

  const workloads = await loadWorkloads(company, agents.map((a) => a._id));
  const pool = agents.map((a) => ({
    ...a.toObject(),
    _active: workloads[String(a._id)] || 0,
  }));

  if (algorithm === 'round_robin') {
    const key = String(company || 'global');
    const idx = rrIndex.get(key) || 0;
    const candidates = pool.filter((a) => a.presence !== 'offline' && a.presence !== 'dnd');
    if (!candidates.length) return null;
    const pick = candidates[idx % candidates.length];
    rrIndex.set(key, idx + 1);
    return Agent.findById(pick._id);
  }

  if (algorithm === 'least_workload') {
    pool.sort((a, b) => a._active - b._active || PRESENCE_WEIGHT[a.presence] - PRESENCE_WEIGHT[b.presence]);
    return Agent.findById(pool[0]._id);
  }

  if (algorithm === 'availability') {
    const avail = pool.filter((a) => a.presence === 'online' || a.presence === 'busy');
    const list = avail.length ? avail : pool;
    list.sort((a, b) => PRESENCE_WEIGHT[a.presence] - PRESENCE_WEIGHT[b.presence] || a._active - b._active);
    return Agent.findById(list[0]._id);
  }

  if (algorithm === 'priority_based') {
    // Senior-first for critical work, then least loaded.
    const rank = (a) => LEVEL_RANK[a.level] || 1;
    pool.sort((a, b) => rank(b) - rank(a) || a._active - b._active || PRESENCE_WEIGHT[a.presence] - PRESENCE_WEIGHT[b.presence]);
    return Agent.findById(pool[0]._id);
  }

  // skill_based (default): score everything
  const scored = pool
    .map((a) => ({ agent: a, score: scoreAgent(a, { requiredSkills, priority, slaHours, customerTier }) }))
    .sort((a, b) => a.score - b.score);
  return Agent.findById(scored[0].agent._id);
}

/**
 * Skill resolution: map help topic / custom data to required skill ids.
 */
async function skillsForTopic(helpTopicId) {
  if (!helpTopicId) return [];
  const HelpTopic = require('../models/HelpTopic');
  const topic = await HelpTopic.findById(helpTopicId).lean();
  if (!topic) return [];
  const Skill = require('../models/Skill');
  const names = [topic.topic];
  const skills = await Skill.find({ company: topic.company, isActive: true }).lean();
  return skills
    .filter((s) => names.some((n) => n.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(n.toLowerCase())))
    .map((s) => s._id);
}

module.exports = { findBestAgent, skillsForTopic, ROUTING_ALGORITHMS, scoreAgent };