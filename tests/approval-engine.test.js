/* eslint-disable no-console */
// Approval Engine tests: policy evaluation, condition matching, state transitions, delegation
// DB-free unit tests. Run: node tests/approval-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Condition Matching ─────────────────────────────────────────────────

function matchesCondition(cond, entity) {
  const val = entity[cond.field];
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
    default: return false;
  }
}

function matchesConditions(conditions, entity) {
  if (!conditions || !conditions.rules || !conditions.rules.length) return true;
  if (conditions.matchAll) return conditions.rules.every(r => matchesCondition(r, entity));
  return conditions.rules.some(r => matchesCondition(r, entity));
}

// ─── Approval State Machine ─────────────────────────────────────────────

const APPROVAL_TRANSITIONS = {
  pending: ['approved', 'rejected', 'expired', 'cancelled', 'skipped'],
  approved: [],
  rejected: [],
  expired: ['pending'],
  cancelled: ['pending'],
  skipped: ['pending'],
};

const STEP_TRANSITIONS = {
  pending: ['active', 'skipped'],
  active: ['approved', 'rejected', 'expired', 'delegated'],
  approved: [],
  rejected: [],
  expired: ['active'],
  skipped: [],
  delegated: ['active'],
};

function canTransition(current, target, transitions = APPROVAL_TRANSITIONS) {
  return transitions[current]?.includes(target) || false;
}

function allowedTransitions(current, transitions = APPROVAL_TRANSITIONS) {
  return transitions[current] || [];
}

// ─── Delegation Validation ──────────────────────────────────────────────

function validateDelegation(delegation) {
  const errors = [];
  if (!delegation.delegatorId) errors.push('delegatorId required');
  if (!delegation.delegateId) errors.push('delegateId required');
  if (delegation.delegatorId === delegation.delegateId) errors.push('cannot delegate to self');
  if (!delegation.startDate) errors.push('startDate required');
  if (!delegation.endDate) errors.push('endDate required');
  if (delegation.startDate && delegation.endDate && new Date(delegation.endDate) <= new Date(delegation.startDate)) errors.push('endDate must be after startDate');
  return errors;
}

// ─── Resolution Logic ───────────────────────────────────────────────────

function resolveApprovers(step, delegationMap = {}) {
  const assignees = [];
  switch (step.assigneeType) {
    case 'agent':
      if (step.assignee) {
        const delegate = delegationMap[step.assignee.toString()];
        assignees.push(delegate || step.assignee);
      }
      break;
    case 'team':
      assignees.push(...(step.memberIds || []));
      break;
    case 'dept_manager':
      if (step.managerId) assignees.push(step.managerId);
      break;
    case 'any_admin':
      assignees.push(...(step.adminIds || []));
      break;
    default:
      if (step.assignee) assignees.push(step.assignee);
  }
  return assignees;
}

function recomputeInstanceStatus(steps) {
  const statuses = steps.map(s => s.status);
  if (statuses.every(s => s === 'skipped')) return 'skipped';
  if (statuses.every(s => s === 'approved' || s === 'skipped')) return 'approved';
  if (statuses.some(s => s === 'rejected')) return 'rejected';
  return 'pending';
}

function isSequentialComplete(steps, currentStep) {
  return steps.filter(s => s.stepNumber < currentStep).every(s => s.status === 'approved' || s.status === 'skipped');
}

// ─── Validation Constants ───────────────────────────────────────────────

const VALID_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired', 'cancelled', 'skipped'];
const VALID_STEP_STATUSES = ['pending', 'active', 'approved', 'rejected', 'expired', 'delegated', 'skipped'];
const VALID_ASSIGNEE_TYPES = ['agent', 'role', 'team', 'dept_manager', 'org_manager', 'any_admin', 'custom'];
const VALID_STEP_MODES = ['approve', 'reject', 'acknowledge'];
const VALID_DECISIONS = ['approved', 'rejected', 'skipped', 'delegated', 'expired'];
const VALID_TIMEOUT_ACTIONS = ['auto_approve', 'auto_reject', 'notify_admin', 'escalate'];
const VALID_ESCALATION_ACTIONS = ['notify', 'reassign', 'auto_approve', 'auto_reject'];
const VALID_ENTITY_TYPES = ['ticket', 'change', 'incident', 'problem', 'service_request', 'asset', 'contract', 'knowledge', 'task', 'any'];
const VALID_APPROVAL_MODES = ['sequential', 'parallel', 'any'];

// ─── TESTS ──────────────────────────────────────────────────────────────

console.log('\n=== CONDITION MATCHING ===\n');

const entity = { changeType: 'normal', riskLevel: 'high', impact: 3, priority: 'p1' };

assert(matchesCondition({ field: 'changeType', operator: 'equals', value: 'normal' }, entity) === true, 'equals match');
assert(matchesCondition({ field: 'changeType', operator: 'equals', value: 'emergency' }, entity) === false, 'equals no match');
assert(matchesCondition({ field: 'changeType', operator: 'in', value: ['normal', 'standard'] }, entity) === true, 'in match');
assert(matchesCondition({ field: 'riskLevel', operator: 'in', value: ['high', 'critical'] }, entity) === true, 'in risk match');
assert(matchesCondition({ field: 'impact', operator: 'gte', value: 3 }, entity) === true, 'gte match');
assert(matchesCondition({ field: 'impact', operator: 'lte', value: 3 }, entity) === true, 'lte match');

console.log('\n=== CONDITION GROUPS ===\n');

assert(matchesConditions(null, entity) === true, 'null conditions = match all');
assert(matchesConditions({ matchAll: true, rules: [
  { field: 'changeType', operator: 'equals', value: 'normal' },
  { field: 'riskLevel', operator: 'equals', value: 'high' },
] }, entity) === true, 'matchAll with 2 matches');
assert(matchesConditions({ matchAll: true, rules: [
  { field: 'changeType', operator: 'equals', value: 'normal' },
  { field: 'riskLevel', operator: 'equals', value: 'low' },
] }, entity) === false, 'matchAll with 1 mismatch');
assert(matchesConditions({ matchAll: false, rules: [
  { field: 'changeType', operator: 'equals', value: 'emergency' },
  { field: 'riskLevel', operator: 'equals', value: 'high' },
] }, entity) === true, 'matchAny with 1 match');

console.log('\n=== APPROVAL STATE MACHINE ===\n');

assert(canTransition('pending', 'approved') === true, 'pending->approved');
assert(canTransition('pending', 'rejected') === true, 'pending->rejected');
assert(canTransition('pending', 'expired') === true, 'pending->expired');
assert(canTransition('pending', 'cancelled') === true, 'pending->cancelled');
assert(canTransition('pending', 'skipped') === true, 'pending->skipped');
assert(canTransition('approved', 'rejected') === false, 'approved->rejected blocked');
assert(canTransition('approved', 'pending') === false, 'approved->pending blocked');
assert(canTransition('rejected', 'approved') === false, 'rejected->approved blocked');
assert(canTransition('expired', 'pending') === true, 'expired->pending (retry)');
assert(canTransition('cancelled', 'pending') === true, 'cancelled->pending (retry)');
assert(canTransition('skipped', 'pending') === true, 'skipped->pending (retry)');

const pendTransitions = allowedTransitions('pending');
assert(pendTransitions.length === 5, 'pending has 5 transitions');
assert(allowedTransitions('approved').length === 0, 'approved has 0 transitions');

console.log('\n=== STEP STATE MACHINE ===\n');

assert(canTransition('pending', 'active', STEP_TRANSITIONS) === true, 'step pending->active');
assert(canTransition('pending', 'skipped', STEP_TRANSITIONS) === true, 'step pending->skipped');
assert(canTransition('active', 'approved', STEP_TRANSITIONS) === true, 'step active->approved');
assert(canTransition('active', 'rejected', STEP_TRANSITIONS) === true, 'step active->rejected');
assert(canTransition('active', 'expired', STEP_TRANSITIONS) === true, 'step active->expired');
assert(canTransition('active', 'delegated', STEP_TRANSITIONS) === true, 'step active->delegated');
assert(canTransition('approved', 'active', STEP_TRANSITIONS) === false, 'step approved->active blocked');
assert(canTransition('expired', 'active', STEP_TRANSITIONS) === true, 'step expired->active (retry)');
assert(canTransition('delegated', 'active', STEP_TRANSITIONS) === true, 'step delegated->active (retry)');

console.log('\n=== DELEGATION VALIDATION ===\n');

const goodDel = { delegatorId: 'a1', delegateId: 'b1', startDate: '2026-01-01', endDate: '2026-12-31' };
assert(validateDelegation(goodDel).length === 0, 'valid delegation passes');

const selfDel = { delegatorId: 'a1', delegateId: 'a1', startDate: '2026-01-01', endDate: '2026-12-31' };
assert(validateDelegation(selfDel).length > 0, 'rejects self-delegation');

const badDates = { delegatorId: 'a1', delegateId: 'b1', startDate: '2026-12-31', endDate: '2026-01-01' };
assert(validateDelegation(badDates).length > 0, 'rejects endDate before startDate');

const missingFields = { delegatorId: 'a1' };
assert(validateDelegation(missingFields).length > 0, 'rejects missing fields');

console.log('\n=== APPROVER RESOLUTION ===\n');

const delegationMap = { 'agent1': 'delegate1' };
const agentStep = { assigneeType: 'agent', assignee: 'agent1' };
const resolved = resolveApprovers(agentStep, delegationMap);
assert(resolved.length === 1, 'agent step resolves to 1 approver');
assert(resolved[0] === 'delegate1', 'agent step uses delegation');

const agentStepNoDel = { assigneeType: 'agent', assignee: 'agent2' };
const resolvedNoDel = resolveApprovers(agentStepNoDel, delegationMap);
assert(resolvedNoDel[0] === 'agent2', 'agent step without delegation uses original');

const teamStep = { assigneeType: 'team', memberIds: ['m1', 'm2', 'm3'] };
const resolvedTeam = resolveApprovers(teamStep);
assert(resolvedTeam.length === 3, 'team step resolves to 3 approvers');

const adminStep = { assigneeType: 'any_admin', adminIds: ['admin1', 'admin2'] };
const resolvedAdmin = resolveApprovers(adminStep);
assert(resolvedAdmin.length === 2, 'admin step resolves to 2 admins');

console.log('\n=== INSTANCE STATUS RECOMPUTATION ===\n');

assert(recomputeInstanceStatus([{ status: 'approved' }, { status: 'approved' }]) === 'approved', 'all approved = approved');
assert(recomputeInstanceStatus([{ status: 'approved' }, { status: 'rejected' }]) === 'rejected', '1 rejected = rejected');
assert(recomputeInstanceStatus([{ status: 'pending' }, { status: 'pending' }]) === 'pending', 'all pending = pending');
assert(recomputeInstanceStatus([{ status: 'approved' }, { status: 'skipped' }]) === 'approved', 'approved+skipped = approved');
assert(recomputeInstanceStatus([{ status: 'skipped' }, { status: 'skipped' }]) === 'skipped', 'all skipped = skipped');
assert(recomputeInstanceStatus([{ status: 'approved' }, { status: 'pending' }]) === 'pending', 'approved+pending = pending');

console.log('\n=== SEQUENTIAL STEP COMPLETION ===\n');

const steps = [
  { stepNumber: 1, status: 'approved' },
  { stepNumber: 2, status: 'pending' },
  { stepNumber: 3, status: 'pending' },
];
assert(isSequentialComplete(steps, 2) === true, 'step 1 complete -> can start step 2');
assert(isSequentialComplete(steps, 3) === false, 'step 2 not complete -> cannot start step 3');
steps[1].status = 'approved';
assert(isSequentialComplete(steps, 3) === true, 'step 2 complete -> can start step 3');

console.log('\n=== CONSTANTS VALIDATION ===\n');

assert(VALID_APPROVAL_STATUSES.length === 6, '6 approval statuses');
assert(VALID_STEP_STATUSES.length === 7, '7 step statuses');
assert(VALID_ASSIGNEE_TYPES.length === 7, '7 assignee types');
assert(VALID_STEP_MODES.length === 3, '3 step modes');
assert(VALID_DECISIONS.length === 5, '5 decisions');
assert(VALID_TIMEOUT_ACTIONS.length === 4, '4 timeout actions');
assert(VALID_ESCALATION_ACTIONS.length === 4, '4 escalation actions');
assert(VALID_ENTITY_TYPES.length === 10, '10 entity types');
assert(VALID_APPROVAL_MODES.length === 3, '3 approval modes');

console.log('\n✅ ALL APPROVAL ENGINE TESTS PASSED\n');
