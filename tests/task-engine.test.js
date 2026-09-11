/* eslint-disable no-console */
// Core Task Engine tests: task CRUD, state machine, watchers, relationships, numbering
// DB-free unit tests. Run: npm run test:task-engine
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const { canTransition, allowedTransitions, TASK_TRANSITIONS } = require('../src/services/stateMachine.service');
const { formatNumber } = require('../src/services/numbering.service');

(async () => {
  // Task numbering (MD §68)
  assert(formatNumber('TASK', 1) === 'TASK-000001', 'task numbering format');
  assert(formatNumber('INC', 42) === 'INC-000042', 'incident numbering format');
  assert(formatNumber('PRB', 100) === 'PRB-000100', 'problem numbering format');

  // Task state machine (MD §65)
  assert(canTransition('task', 'new', 'open') === true, 'task new->open');
  assert(canTransition('task', 'new', 'in_progress') === true, 'task new->in_progress');
  assert(canTransition('task', 'new', 'cancelled') === true, 'task new->cancelled');
  assert(canTransition('task', 'new', 'closed') === false, 'task new cannot skip to closed');
  assert(canTransition('task', 'new', 'resolved') === false, 'task new cannot skip to resolved');

  assert(canTransition('task', 'open', 'in_progress') === true, 'task open->in_progress');
  assert(canTransition('task', 'open', 'pending_customer') === true, 'task open->pending_customer');
  assert(canTransition('task', 'open', 'pending_vendor') === true, 'task open->pending_vendor');
  assert(canTransition('task', 'open', 'pending_approval') === true, 'task open->pending_approval');
  assert(canTransition('task', 'open', 'on_hold') === true, 'task open->on_hold');
  assert(canTransition('task', 'open', 'cancelled') === true, 'task open->cancelled');
  assert(canTransition('task', 'open', 'closed') === false, 'task open cannot close directly');

  assert(canTransition('task', 'in_progress', 'resolved') === true, 'task in_progress->resolved');
  assert(canTransition('task', 'in_progress', 'pending_customer') === true, 'task in_progress->pending_customer');
  assert(canTransition('task', 'in_progress', 'open') === true, 'task in_progress->open (reopen)');
  assert(canTransition('task', 'in_progress', 'cancelled') === false, 'task in_progress cannot cancel');

  assert(canTransition('task', 'pending_customer', 'in_progress') === true, 'task pending_customer->in_progress');
  assert(canTransition('task', 'pending_customer', 'resolved') === true, 'task pending_customer->resolved');
  assert(canTransition('task', 'pending_customer', 'cancelled') === true, 'task pending_customer->cancelled');

  assert(canTransition('task', 'resolved', 'closed') === true, 'task resolved->closed');
  assert(canTransition('task', 'resolved', 'open') === true, 'task resolved->open (reopen)');
  assert(canTransition('task', 'resolved', 'cancelled') === false, 'task resolved cannot cancel');

  assert(canTransition('task', 'closed', 'open') === true, 'task closed->open (reopen)');
  assert(canTransition('task', 'closed', 'in_progress') === false, 'task closed cannot go to in_progress');

  assert(canTransition('task', 'cancelled', 'open') === true, 'task cancelled->open (reopen)');
  assert(canTransition('task', 'cancelled', 'in_progress') === false, 'task cancelled cannot go to in_progress');

  // allowedTransitions returns correct list
  const newAllowed = allowedTransitions('task', 'new');
  assert(newAllowed.includes('open'), 'allowedTransitions new includes open');
  assert(newAllowed.includes('in_progress'), 'allowedTransitions new includes in_progress');
  assert(newAllowed.includes('cancelled'), 'allowedTransitions new includes cancelled');
  assert(!newAllowed.includes('closed'), 'allowedTransitions new does not include closed');
  assert(!newAllowed.includes('resolved'), 'allowedTransitions new does not include resolved');

  const resolvedAllowed = allowedTransitions('task', 'resolved');
  assert(resolvedAllowed.includes('closed'), 'allowedTransitions resolved includes closed');
  assert(resolvedAllowed.includes('open'), 'allowedTransitions resolved includes open');

  // No-op transition (same state)
  assert(canTransition('task', 'open', 'open') === true, 'task no-op transition');

  // Unknown entity returns true (no blocking)
  assert(canTransition('custom_entity', 'a', 'b') === true, 'unknown entity not blocked');

  console.log('\nAll Task Engine tests passed!');
})().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
