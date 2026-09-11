/* eslint-disable no-console */
// Assignment / Routing / Work Distribution tests
// DB-free unit tests. Run: node tests/assignment-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Condition Matching Logic ───────────────────────────────────────────

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

// ─── Agent Scoring / Selection Logic ────────────────────────────────────

const PRESENCE_WEIGHT = { available: 0, online: 0, busy: 1, away: 3, on_break: 5, in_meeting: 5, dnd: 100, offline: 100 };

function scoreAgent(agent, skills = [], priorities = {}) {
  let score = 0;
  // Skill match
  if (skills.length && agent.skills) {
    const matched = skills.filter(s => agent.skills.includes(s));
    score += (matched.length / skills.length) * 40;
  }
  // Workload (fewer tickets = better)
  score += Math.max(0, 30 - (agent.ticketCount || 0) * 3);
  // Presence
  score -= (PRESENCE_WEIGHT[agent.presence] || 50) * 0.5;
  // Capacity
  if (agent.capacity > 0) {
    const utilization = (agent.ticketCount || 0) / agent.capacity;
    score += Math.max(0, 20 - utilization * 20);
  }
  // VIP boost
  if (agent.isVip) score += priorities.vipBoost || 0;
  // Seniority
  if (agent.seniority) score += agent.seniority * 2;
  return Math.round(score * 100) / 100;
}

function selectBestAgent(candidates, skills = [], strategy = 'round_robin') {
  if (!candidates.length) return null;
  const available = candidates.filter(a => ['available', 'online', 'busy'].includes(a.presence));
  const pool = available.length ? available : candidates;

  switch (strategy) {
    case 'round_robin':
      return pool.sort((a, b) => (a.ticketCount || 0) - (b.ticketCount || 0))[0];
    case 'least_workload':
      return pool.sort((a, b) => (a.ticketCount || 0) - (b.ticketCount || 0))[0];
    case 'skill_based':
      return pool.sort((a, b) => {
        const aMatch = skills.filter(s => (a.skills || []).includes(s)).length;
        const bMatch = skills.filter(s => (b.skills || []).includes(s)).length;
        return bMatch - aMatch;
      })[0];
    case 'availability':
      return pool.find(a => a.presence === 'available') || pool[0];
    case 'weighted':
      return pool.sort((a, b) => scoreAgent(b, skills) - scoreAgent(a, skills))[0];
    default:
      return pool[0];
  }
}

// ─── Validation Constants ───────────────────────────────────────────────

const VALID_PRESENCES = ['available', 'busy', 'away', 'offline', 'on_break', 'in_meeting', 'dnd'];
const VALID_ROUTES = ['round_robin', 'least_workload', 'skill_based', 'availability', 'weighted'];
const VALID_OFFER_STATES = ['offered', 'accepted', 'declined', 'expired'];
const VALID_EVENT_TYPES = ['assign', 'reassign', 'unassign', 'claim', 'transfer', 'escalate', 'auto_assign', 'overflow', 'decline', 'accept', 'timeout'];
const VALID_SKILL_CATEGORIES = ['technical', 'language', 'product', 'soft_skill', 'certification', 'custom'];
const VALID_PROFICIENCY = ['beginner', 'intermediate', 'advanced', 'expert'];
const VALID_SOURCES = ['email', 'phone', 'web', 'chat', 'api', 'social', 'all'];
const VALID_OVERFLOW_ACTIONS = ['none', 'escalate', 'reassign', 'notify'];
const VALID_ROUTING_METHODS = ['queue', 'group', 'agent', 'skill_based', 'round_robin', 'least_workload', 'manual'];

// ─── TESTS ──────────────────────────────────────────────────────────────

console.log('\n=== CONDITION MATCHING ===\n');

const ticket = { priority: 'p1', category: 'hardware', source: 'email', department: 'IT', impact: 3, urgency: 4 };

assert(matchesCondition({ field: 'priority', operator: 'equals', value: 'p1' }, ticket) === true, 'equals match');
assert(matchesCondition({ field: 'priority', operator: 'equals', value: 'p2' }, ticket) === false, 'equals no match');
assert(matchesCondition({ field: 'priority', operator: 'not_equals', value: 'p2' }, ticket) === true, 'not_equals match');
assert(matchesCondition({ field: 'category', operator: 'in', value: ['hardware', 'software'] }, ticket) === true, 'in match');
assert(matchesCondition({ field: 'category', operator: 'in', value: ['software'] }, ticket) === false, 'in no match');
assert(matchesCondition({ field: 'category', operator: 'not_in', value: ['software'] }, ticket) === true, 'not_in match');
assert(matchesCondition({ field: 'category', operator: 'contains', value: 'hard' }, ticket) === true, 'contains match');
assert(matchesCondition({ field: 'impact', operator: 'gte', value: 3 }, ticket) === true, 'gte match');
assert(matchesCondition({ field: 'impact', operator: 'lte', value: 3 }, ticket) === true, 'lte match');
assert(matchesCondition({ field: 'impact', operator: 'gt', value: 2 }, ticket) === true, 'gt match');
assert(matchesCondition({ field: 'impact', operator: 'lt', value: 5 }, ticket) === true, 'lt match');
assert(matchesCondition({ field: 'source', operator: 'starts_with', value: 'em' }, ticket) === true, 'starts_with match');
assert(matchesCondition({ field: 'source', operator: 'ends_with', value: 'il' }, ticket) === true, 'ends_with match');
assert(matchesCondition({ field: 'missing', operator: 'is_empty', value: undefined }, ticket) === true, 'is_empty match');
assert(matchesCondition({ field: 'priority', operator: 'is_not_empty', value: 'p1' }, ticket) === true, 'is_not_empty match');
assert(matchesCondition({ field: 'unknown_op', operator: 'bad_op', value: 'x' }, ticket) === false, 'unknown operator = false');

console.log('\n=== CONDITION GROUPS ===\n');

assert(matchesConditions(null, ticket) === true, 'null conditions = match all');
assert(matchesConditions({ matchAll: true, rules: [] }, ticket) === true, 'empty rules = match all');
assert(matchesConditions({ matchAll: true, rules: [
  { field: 'priority', operator: 'equals', value: 'p1' },
  { field: 'category', operator: 'equals', value: 'hardware' },
] }, ticket) === true, 'matchAll with 2 matches');
assert(matchesConditions({ matchAll: true, rules: [
  { field: 'priority', operator: 'equals', value: 'p1' },
  { field: 'category', operator: 'equals', value: 'software' },
] }, ticket) === false, 'matchAll with 1 mismatch');
assert(matchesConditions({ matchAll: false, rules: [
  { field: 'priority', operator: 'equals', value: 'p2' },
  { field: 'category', operator: 'equals', value: 'hardware' },
] }, ticket) === true, 'matchAny with 1 match');
assert(matchesConditions({ matchAll: false, rules: [
  { field: 'priority', operator: 'equals', value: 'p2' },
  { field: 'category', operator: 'equals', value: 'software' },
] }, ticket) === false, 'matchAny with 0 matches');

console.log('\n=== AGENT SCORING ===\n');

const agent1 = { name: 'Agent A', ticketCount: 2, capacity: 10, presence: 'available', skills: ['windows', 'networking'] };
const agent2 = { name: 'Agent B', ticketCount: 8, capacity: 10, presence: 'busy', skills: ['windows'] };
const agent3 = { name: 'Agent C', ticketCount: 0, capacity: 10, presence: 'available', skills: ['windows', 'networking', 'security'] };

const score1 = scoreAgent(agent1, ['windows', 'networking']);
const score2 = scoreAgent(agent2, ['windows', 'networking']);
const score3 = scoreAgent(agent3, ['windows', 'networking']);
assert(score1 > score2, `agent1 (${score1}) > agent2 (${score2}): less workload, available`);
assert(score3 > score1, `agent3 (${score3}) > agent1 (${score1}): more skills, less workload`);

console.log('\n=== AGENT SELECTION ===\n');

const agents = [
  { name: 'A', ticketCount: 5, presence: 'available', skills: ['windows'] },
  { name: 'B', ticketCount: 2, presence: 'available', skills: ['windows', 'linux'] },
  { name: 'C', ticketCount: 10, presence: 'away', skills: ['windows', 'linux', 'networking'] },
  { name: 'D', ticketCount: 0, presence: 'offline', skills: [] },
];

const rr = selectBestAgent(agents, [], 'round_robin');
assert(rr.name === 'B', 'round_robin: picks fewest tickets among available (B=2)');

const ll = selectBestAgent(agents, [], 'least_workload');
assert(ll.name === 'B', 'least_workload: picks fewest tickets among available (B=2)');

const sb = selectBestAgent(agents, ['windows', 'linux'], 'skill_based');
assert(sb.name === 'B' || sb.name === 'C', 'skill_based: picks best skill match');

const av = selectBestAgent(agents, [], 'availability');
assert(av.name === 'A' || av.name === 'B', 'availability: picks available agent');

const wt = selectBestAgent(agents, ['windows', 'linux'], 'weighted');
assert(wt.name === 'B' || wt.name === 'A', 'weighted: picks best score');

assert(selectBestAgent([], [], 'round_robin') === null, 'empty candidates = null');

// Test with only offline agents (should still return someone)
const offlineAgents = [{ name: 'X', ticketCount: 3, presence: 'offline', skills: [] }];
const fallback = selectBestAgent(offlineAgents, [], 'round_robin');
assert(fallback.name === 'X', 'fallback to offline agent when no available');

console.log('\n=== CONSTANTS VALIDATION ===\n');

assert(VALID_PRESENCES.length === 7, '7 valid presences');
assert(VALID_ROUTES.length === 5, '5 valid routing strategies');
assert(VALID_OFFER_STATES.length === 4, '4 valid offer states');
assert(VALID_EVENT_TYPES.length === 11, '11 valid event types');
assert(VALID_SKILL_CATEGORIES.length === 6, '6 valid skill categories');
assert(VALID_PROFICIENCY.length === 4, '4 valid proficiency levels');
assert(VALID_SOURCES.length === 7, '7 valid sources');
assert(VALID_OVERFLOW_ACTIONS.length === 4, '4 valid overflow actions');
assert(VALID_ROUTING_METHODS.length === 7, '7 valid routing methods');

console.log('\n=== PRESENCE WEIGHTS ===\n');

assert(PRESENCE_WEIGHT.available === 0, 'available weight = 0');
assert(PRESENCE_WEIGHT.busy === 1, 'busy weight = 1');
assert(PRESENCE_WEIGHT.away === 3, 'away weight = 3');
assert(PRESENCE_WEIGHT.offline === 100, 'offline weight = 100');
assert(PRESENCE_WEIGHT.dnd === 100, 'dnd weight = 100');
assert(PRESENCE_WEIGHT.available < PRESENCE_WEIGHT.busy, 'available < busy');
assert(PRESENCE_WEIGHT.busy < PRESENCE_WEIGHT.away, 'busy < away');
assert(PRESENCE_WEIGHT.away < PRESENCE_WEIGHT.offline, 'away < offline');

console.log('\n✅ ALL ASSIGNMENT ENGINE TESTS PASSED\n');
