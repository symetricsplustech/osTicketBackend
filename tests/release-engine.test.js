/* eslint-disable no-console */
// Release Management tests: state machine, validation, phase/task logic, deployment
// DB-free unit tests. Run: node tests/release-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Constants ──────────────────────────────────────────────────────────

const RELEASE_STATUS = ['planning', 'build', 'test', 'ready', 'deploying', 'completed', 'failed', 'cancelled'];
const RELEASE_TYPE = ['major', 'minor', 'patch', 'hotfix', 'emergency', 'maintenance'];
const PHASE_TYPE = ['build', 'test', 'staging', 'deploy', 'validate', 'rollback', 'custom'];
const PHASE_STATUS = ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled'];
const TASK_TYPE = ['build', 'test', 'deploy', 'validation', 'configuration', 'documentation', 'approval', 'communication', 'rollback', 'custom'];
const TASK_STATUS = ['pending', 'in_progress', 'completed', 'failed', 'skipped', 'cancelled', 'blocked'];
const COMPONENT_TYPE = ['application', 'service', 'database', 'library', 'infrastructure', 'configuration', 'documentation', 'script', 'other'];
const COMPONENT_BUILD_STATUS = ['pending', 'building', 'built', 'failed', 'promoted'];
const DEPLOYMENT_STATUS = ['scheduled', 'in_progress', 'completed', 'failed', 'rolled_back', 'cancelled'];
const DEPLOYMENT_TYPE = ['full', 'incremental', 'hotfix', 'rollback', 'canary', 'blue_green'];
const DEPLOYMENT_STRATEGY = ['big_bang', 'phased', 'canary', 'blue_green', 'rolling'];
const DEPENDENCY_TYPE = ['blocks', 'is_blocked_by', 'requires', 'provides', 'conflicts_with', 'depends_on'];
const DEPENDENCY_STATUS = ['pending', 'resolved', 'blocked', 'waived', 'cancelled'];
const APPROVAL_TYPE = ['readiness', 'deployment', 'rollback', 'go_no_go', 'post_deployment', 'emergency'];
const APPROVAL_STATUS = ['pending', 'approved', 'rejected', 'cancelled', 'expired'];

// ─── State Machine ────────────────────────────────────────────────────

const RELEASE_TRANSITIONS = {
  planning: ['build', 'cancelled'],
  build: ['test', 'planning', 'cancelled'],
  test: ['ready', 'build', 'cancelled'],
  ready: ['deploying', 'build', 'cancelled'],
  deploying: ['completed', 'failed', 'cancelled'],
  completed: ['planning'],
  failed: ['build', 'cancelled'],
  cancelled: ['planning'],
};

const PHASE_TRANSITIONS = {
  pending: ['in_progress', 'skipped', 'cancelled'],
  in_progress: ['completed', 'failed', 'skipped', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  skipped: [],
  cancelled: [],
};

const TASK_TRANSITIONS = {
  pending: ['in_progress', 'cancelled', 'blocked'],
  in_progress: ['completed', 'failed', 'skipped', 'blocked', 'cancelled'],
  completed: [],
  failed: ['in_progress', 'cancelled'],
  skipped: [],
  cancelled: [],
  blocked: ['pending', 'cancelled'],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation ────────────────────────────────────────────────────────

function validateRelease(r) {
  const errors = [];
  if (!r.name) errors.push('name required');
  if (!r.version) errors.push('version required');
  if (r.status && !RELEASE_STATUS.includes(r.status)) errors.push('invalid status');
  if (r.type && !RELEASE_TYPE.includes(r.type)) errors.push('invalid type');
  if (r.environment && !['development', 'test', 'staging', 'production', 'dr'].includes(r.environment)) errors.push('invalid environment');
  if (r.rolloutPercentage && (r.rolloutPercentage < 0 || r.rolloutPercentage > 100)) errors.push('rolloutPercentage 0-100');
  return errors;
}

function validatePhase(p) {
  const errors = [];
  if (!p.name) errors.push('name required');
  if (!p.releaseId) errors.push('releaseId required');
  if (typeof p.order !== 'number') errors.push('order required');
  if (p.type && !PHASE_TYPE.includes(p.type)) errors.push('invalid type');
  if (p.status && !PHASE_STATUS.includes(p.status)) errors.push('invalid status');
  return errors;
}

function validateTask(t) {
  const errors = [];
  if (!t.name) errors.push('name required');
  if (!t.releaseId) errors.push('releaseId required');
  if (t.type && !TASK_TYPE.includes(t.type)) errors.push('invalid type');
  if (t.status && !TASK_STATUS.includes(t.status)) errors.push('invalid status');
  if (t.priority && !['low', 'medium', 'high', 'critical'].includes(t.priority)) errors.push('invalid priority');
  return errors;
}

function validateComponent(c) {
  const errors = [];
  if (!c.name) errors.push('name required');
  if (!c.releaseId) errors.push('releaseId required');
  if (!c.version) errors.push('version required');
  if (c.type && !COMPONENT_TYPE.includes(c.type)) errors.push('invalid type');
  if (c.buildStatus && !COMPONENT_BUILD_STATUS.includes(c.buildStatus)) errors.push('invalid buildStatus');
  if (c.deploymentStatus && !['not_deployed', 'deploying', 'deployed', 'failed', 'rolled_back'].includes(c.deploymentStatus)) errors.push('invalid deploymentStatus');
  return errors;
}

function validateDependency(d) {
  const errors = [];
  if (!d.name) errors.push('name required');
  if (!d.releaseId) errors.push('releaseId required');
  if (d.type && !['release', 'change', 'ci', 'service', 'environment', 'external', 'manual'].includes(d.type)) errors.push('invalid type');
  if (d.dependencyType && !DEPENDENCY_TYPE.includes(d.dependencyType)) errors.push('invalid dependencyType');
  if (d.status && !DEPENDENCY_STATUS.includes(d.status)) errors.push('invalid status');
  if (d.severity && !['low', 'medium', 'high', 'critical'].includes(d.severity)) errors.push('invalid severity');
  return errors;
}

function validateDeployment(d) {
  const errors = [];
  if (!d.releaseId) errors.push('releaseId required');
  if (!d.environment) errors.push('environment required');
  if (!['development', 'test', 'staging', 'production', 'dr'].includes(d.environment)) errors.push('invalid environment');
  if (d.status && !DEPLOYMENT_STATUS.includes(d.status)) errors.push('invalid status');
  if (d.deploymentType && !DEPLOYMENT_TYPE.includes(d.deploymentType)) errors.push('invalid deploymentType');
  if (d.strategy && !DEPLOYMENT_STRATEGY.includes(d.strategy)) errors.push('invalid strategy');
  if (d.rolloutPercentage && (d.rolloutPercentage < 0 || d.rolloutPercentage > 100)) errors.push('rolloutPercentage 0-100');
  return errors;
}

function validateApproval(a) {
  const errors = [];
  if (!a.name) errors.push('name required');
  if (!a.releaseId) errors.push('releaseId required');
  if (a.type && !APPROVAL_TYPE.includes(a.type)) errors.push('invalid type');
  if (a.status && !APPROVAL_STATUS.includes(a.status)) errors.push('invalid status');
  if (typeof a.requiredApprovals === 'number' && a.requiredApprovals < 1) errors.push('requiredApprovals >= 1');
  return errors;
}

// ─── Dependency Resolution ────────────────────────────────────────────

function checkDependenciesMet(dependencies, dependencyType = 'depends_on') {
  return dependencies
    .filter(d => d.dependencyType === dependencyType)
    .every(d => d.status === 'resolved' || d.status === 'waived');
}

function hasBlockedDependencies(dependencies) {
  return dependencies.some(d => d.dependencyType === 'blocks' && d.status === 'blocked');
}

function getUnresolvedDependencies(dependencies) {
  return dependencies.filter(d => d.status === 'pending' || d.status === 'blocked');
}

function resolveDependency(dependencies, depId) {
  return dependencies.map(d => d._id === depId ? { ...d, status: 'resolved', resolvedAt: new Date() } : d);
}

// ─── Release Rollout Calculation ─────────────────────────────────────

function calculateRolloutPercentage(current, target, step) {
  const next = current + step;
  return Math.min(next, target);
}

function isRolloutComplete(current, target) {
  return current >= target;
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log('\n=== RELEASE STATE MACHINE ===\n');

assert(canTransition('planning', 'build', RELEASE_TRANSITIONS) === true, 'planning->build');
assert(canTransition('planning', 'cancelled', RELEASE_TRANSITIONS) === true, 'planning->cancelled');
assert(canTransition('build', 'test', RELEASE_TRANSITIONS) === true, 'build->test');
assert(canTransition('build', 'planning', RELEASE_TRANSITIONS) === true, 'build->planning (replan)');
assert(canTransition('test', 'ready', RELEASE_TRANSITIONS) === true, 'test->ready');
assert(canTransition('test', 'build', RELEASE_TRANSITIONS) === true, 'test->build (retest)');
assert(canTransition('ready', 'deploying', RELEASE_TRANSITIONS) === true, 'ready->deploying');
assert(canTransition('ready', 'build', RELEASE_TRANSITIONS) === true, 'ready->build (rebuild)');
assert(canTransition('deploying', 'completed', RELEASE_TRANSITIONS) === true, 'deploying->completed');
assert(canTransition('deploying', 'failed', RELEASE_TRANSITIONS) === true, 'deploying->failed');
assert(canTransition('completed', 'planning', RELEASE_TRANSITIONS) === true, 'completed->planning (next cycle)');
assert(canTransition('failed', 'build', RELEASE_TRANSITIONS) === true, 'failed->build (retry)');
assert(canTransition('cancelled', 'planning', RELEASE_TRANSITIONS) === true, 'cancelled->planning (replan)');
assert(canTransition('build', 'deploying', RELEASE_TRANSITIONS) === false, 'build->deploying blocked');
assert(canTransition('test', 'deploying', RELEASE_TRANSITIONS) === false, 'test->deploying blocked');
assert(canTransition('ready', 'completed', RELEASE_TRANSITIONS) === false, 'ready->completed blocked');

console.log('\n=== PHASE STATE MACHINE ===\n');

assert(canTransition('pending', 'in_progress', PHASE_TRANSITIONS) === true, 'pending->in_progress');
assert(canTransition('in_progress', 'completed', PHASE_TRANSITIONS) === true, 'in_progress->completed');
assert(canTransition('in_progress', 'failed', PHASE_TRANSITIONS) === true, 'in_progress->failed');
assert(canTransition('completed', 'in_progress', PHASE_TRANSITIONS) === false, 'completed->in_progress blocked');

console.log('\n=== TASK STATE MACHINE ===\n');

assert(canTransition('pending', 'in_progress', TASK_TRANSITIONS) === true, 'pending->in_progress');
assert(canTransition('pending', 'blocked', TASK_TRANSITIONS) === true, 'pending->blocked');
assert(canTransition('in_progress', 'completed', TASK_TRANSITIONS) === true, 'in_progress->completed');
assert(canTransition('in_progress', 'blocked', TASK_TRANSITIONS) === true, 'in_progress->blocked');
assert(canTransition('blocked', 'pending', TASK_TRANSITIONS) === true, 'blocked->pending (unblock)');

console.log('\n=== VALIDATION: RELEASE ===\n');

assert(validateRelease({ name: 'Release 1.0', version: '1.0.0', status: 'planning', type: 'major', environment: 'production' }).length === 0, 'valid release passes');
assert(validateRelease({ name: 'Test', version: '1.0', status: 'invalid' }).length > 0, 'invalid status rejected');
assert(validateRelease({ name: 'Test', version: '1.0', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateRelease({ name: 'Test', version: '1.0', rolloutPercentage: 150 }).length > 0, 'rolloutPercentage > 100 rejected');
assert(validateRelease({ name: 'Test', version: '1.0', environment: 'invalid' }).length > 0, 'invalid environment rejected');

console.log('\n=== VALIDATION: PHASE ===\n');

assert(validatePhase({ name: 'Build', releaseId: 'rel1', order: 1, type: 'build' }).length === 0, 'valid phase passes');
assert(validatePhase({ name: 'Test', releaseId: 'rel1', type: 'invalid' }).length > 0, 'invalid type rejected');

console.log('\n=== VALIDATION: TASK ===\n');

assert(validateTask({ name: 'Run Tests', releaseId: 'rel1', type: 'test' }).length === 0, 'valid task passes');
assert(validateTask({ name: 'Test', releaseId: 'rel1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateTask({ name: 'Test', releaseId: 'rel1', priority: 'invalid' }).length > 0, 'invalid priority rejected');

console.log('\n=== VALIDATION: COMPONENT ===\n');

assert(validateComponent({ name: 'API', releaseId: 'rel1', version: '1.0.0', type: 'application' }).length === 0, 'valid component passes');
assert(validateComponent({ name: 'Test', releaseId: 'rel1', version: '1.0', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateComponent({ name: 'Test', releaseId: 'rel1', version: '1.0', buildStatus: 'invalid' }).length > 0, 'invalid buildStatus rejected');

console.log('\n=== VALIDATION: DEPENDENCY ===\n');

assert(validateDependency({ name: 'Depends on DB', releaseId: 'rel1', type: 'service', dependencyType: 'depends_on' }).length === 0, 'valid dependency passes');
assert(validateDependency({ name: 'Test', releaseId: 'rel1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateDependency({ name: 'Test', releaseId: 'rel1', dependencyType: 'invalid' }).length > 0, 'invalid dependencyType rejected');
assert(validateDependency({ name: 'Test', releaseId: 'rel1', severity: 'invalid' }).length > 0, 'invalid severity rejected');

console.log('\n=== VALIDATION: DEPLOYMENT ===\n');

assert(validateDeployment({ releaseId: 'rel1', environment: 'production', status: 'scheduled', deploymentType: 'full' }).length === 0, 'valid deployment passes');
assert(validateDeployment({ releaseId: 'rel1', environment: 'invalid' }).length > 0, 'invalid environment rejected');
assert(validateDeployment({ releaseId: 'rel1', deploymentType: 'invalid' }).length > 0, 'invalid deploymentType rejected');
assert(validateDeployment({ releaseId: 'rel1', rolloutPercentage: 150 }).length > 0, 'rolloutPercentage > 100 rejected');
assert(validateDeployment({ releaseId: 'rel1', strategy: 'invalid' }).length > 0, 'invalid strategy rejected');

console.log('\n=== VALIDATION: APPROVAL ===\n');

assert(validateApproval({ name: 'Go/No-Go', releaseId: 'rel1', type: 'deployment', requiredApprovals: 2 }).length === 0, 'valid approval passes');
assert(validateApproval({ name: 'Test', releaseId: 'rel1', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateApproval({ name: 'Test', releaseId: 'rel1', requiredApprovals: 0 }).length > 0, 'requiredApprovals < 1 rejected');

console.log('\n=== DEPENDENCY RESOLUTION ===\n');

const deps = [
  { _id: 'd1', dependencyType: 'depends_on', status: 'pending' },
  { _id: 'd2', dependencyType: 'depends_on', status: 'resolved' },
  { _id: 'd3', dependencyType: 'blocks', status: 'pending' },
];

assert(checkDependenciesMet(deps, 'depends_on') === false, 'not all depends_on resolved');
const resolved = resolveDependency(deps, 'd1');
assert(checkDependenciesMet(resolved, 'depends_on') === true, 'all depends_on resolved after resolve');

assert(hasBlockedDependencies(deps) === false, 'no blocked yet');
const withBlocked = [...deps, { _id: 'd4', dependencyType: 'blocks', status: 'blocked' }];
assert(hasBlockedDependencies(withBlocked) === true, 'blocked detected');

const unresolved = getUnresolvedDependencies(deps);
assert(unresolved.length === 2, '2 unresolved (d1 pending, d3 pending)');

const resolved2 = resolveDependency(deps, 'd1');
const unresolved2 = getUnresolvedDependencies(resolved2);
assert(unresolved2.length === 1, '1 unresolved (d3 still pending)');

console.log('\n=== ROLLOUT CALCULATION ===\n');

assert(calculateRolloutPercentage(0, 100, 25) === 25, '0->25 step 25');
assert(calculateRolloutPercentage(50, 100, 25) === 75, '50->75 step 25');
assert(calculateRolloutPercentage(90, 100, 25) === 100, '90->100 capped');
assert(calculateRolloutPercentage(100, 100, 10) === 100, 'already complete');

assert(isRolloutComplete(100, 100) === true, '100/100 complete');
assert(isRolloutComplete(99, 100) === false, '99/100 not complete');

console.log('\n=== CONSTANTS ===\n');

assert(RELEASE_STATUS.length === 8, '8 release statuses');
assert(RELEASE_TYPE.length === 6, '6 release types');
assert(PHASE_TYPE.length === 7, '7 phase types');
assert(PHASE_STATUS.length === 6, '6 phase statuses');
assert(TASK_TYPE.length === 10, '10 task types');
assert(TASK_STATUS.length === 7, '7 task statuses');
assert(COMPONENT_TYPE.length === 9, '9 component types');
assert(DEPLOYMENT_STATUS.length === 6, '6 deployment statuses');
assert(DEPLOYMENT_TYPE.length === 6, '6 deployment types');
assert(DEPLOYMENT_STRATEGY.length === 5, '5 deployment strategies');
assert(DEPENDENCY_TYPE.length === 6, '6 dependency types');
assert(DEPENDENCY_STATUS.length === 5, '5 dependency statuses');
assert(APPROVAL_TYPE.length === 6, '6 approval types');
assert(APPROVAL_STATUS.length === 5, '5 approval statuses');

console.log('\n✅ ALL RELEASE ENGINE TESTS PASSED\n');
