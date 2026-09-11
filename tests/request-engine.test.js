/* eslint-disable no-console */
// Request Management state machine tests
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const { canTransition, allowedTransitions, REQUEST_TRANSITIONS, RITM_TRANSITIONS, CART_TRANSITIONS, CATALOG_TASK_TRANSITIONS } = require('../src/services/stateMachine.service');

(async () => {
  console.log('\n=== REQUEST MANAGEMENT STATE MACHINE TESTS ===\n');

  // ─── REQ State Machine ──────────────────────────────────────────────
  console.log('--- REQ Transitions ---');
  assert(canTransition('request', 'open', 'work_in_progress') === true, 'REQ open->work_in_progress');
  assert(canTransition('request', 'open', 'closed_complete') === true, 'REQ open->closed_complete');
  assert(canTransition('request', 'open', 'closed_incomplete') === true, 'REQ open->closed_incomplete');
  assert(canTransition('request', 'open', 'closed_canceled') === true, 'REQ open->closed_canceled');
  assert(canTransition('request', 'open', 'pending_approval') === false, 'REQ open cannot go to pending_approval');
  assert(canTransition('request', 'work_in_progress', 'open') === true, 'REQ work_in_progress->open');
  assert(canTransition('request', 'work_in_progress', 'closed_complete') === true, 'REQ work_in_progress->closed_complete');
  assert(canTransition('request', 'work_in_progress', 'closed_incomplete') === true, 'REQ work_in_progress->closed_incomplete');
  assert(canTransition('request', 'work_in_progress', 'closed_canceled') === true, 'REQ work_in_progress->closed_canceled');
  assert(canTransition('request', 'closed_complete', 'open') === true, 'REQ closed_complete->open (reopen)');
  assert(canTransition('request', 'closed_incomplete', 'open') === true, 'REQ closed_incomplete->open (reopen)');
  assert(canTransition('request', 'closed_canceled', 'open') === true, 'REQ closed_canceled->open (reopen)');
  assert(canTransition('request', 'closed_complete', 'work_in_progress') === false, 'REQ closed_complete cannot go to work_in_progress');
  assert(canTransition('request', 'closed_canceled', 'closed_complete') === false, 'REQ closed_canceled cannot go to closed_complete');
  assert(canTransition('request', 'open', 'open') === true, 'REQ no-op');

  // ─── RITM State Machine ─────────────────────────────────────────────
  console.log('\n--- RITM Transitions ---');
  assert(canTransition('ritm', 'pending_approval', 'open') === true, 'RITM pending_approval->open (approved)');
  assert(canTransition('ritm', 'pending_approval', 'closed_canceled') === true, 'RITM pending_approval->closed_canceled (rejected)');
  assert(canTransition('ritm', 'pending_approval', 'work_in_progress') === false, 'RITM pending_approval cannot skip to work_in_progress');
  assert(canTransition('ritm', 'pending_approval', 'closed_complete') === false, 'RITM pending_approval cannot skip to closed_complete');
  assert(canTransition('ritm', 'open', 'work_in_progress') === true, 'RITM open->work_in_progress');
  assert(canTransition('ritm', 'open', 'pending_approval') === true, 'RITM open->pending_approval');
  assert(canTransition('ritm', 'open', 'closed_complete') === true, 'RITM open->closed_complete');
  assert(canTransition('ritm', 'open', 'closed_incomplete') === true, 'RITM open->closed_incomplete');
  assert(canTransition('ritm', 'open', 'closed_canceled') === true, 'RITM open->closed_canceled');
  assert(canTransition('ritm', 'work_in_progress', 'open') === true, 'RITM work_in_progress->open');
  assert(canTransition('ritm', 'work_in_progress', 'closed_complete') === true, 'RITM work_in_progress->closed_complete');
  assert(canTransition('ritm', 'work_in_progress', 'closed_incomplete') === true, 'RITM work_in_progress->closed_incomplete');
  assert(canTransition('ritm', 'work_in_progress', 'closed_canceled') === true, 'RITM work_in_progress->closed_canceled');
  assert(canTransition('ritm', 'closed_complete', 'open') === true, 'RITM closed_complete->open (reopen)');
  assert(canTransition('ritm', 'closed_incomplete', 'open') === true, 'RITM closed_incomplete->open (reopen)');
  assert(canTransition('ritm', 'closed_canceled', 'open') === true, 'RITM closed_canceled->open (reopen)');
  assert(canTransition('ritm', 'closed_complete', 'work_in_progress') === false, 'RITM closed_complete cannot go to work_in_progress');
  assert(canTransition('ritm', 'open', 'open') === true, 'RITM no-op');

  // ─── Cart State Machine ─────────────────────────────────────────────
  console.log('\n--- Cart Transitions ---');
  assert(canTransition('cart', 'active', 'submitted') === true, 'Cart active->submitted');
  assert(canTransition('cart', 'active', 'abandoned') === true, 'Cart active->abandoned');
  assert(canTransition('cart', 'active', 'active') === true, 'Cart no-op');
  assert(canTransition('cart', 'submitted', 'active') === true, 'Cart submitted->active');
  assert(canTransition('cart', 'abandoned', 'active') === true, 'Cart abandoned->active');
  assert(canTransition('cart', 'submitted', 'abandoned') === false, 'Cart submitted cannot go to abandoned');
  assert(canTransition('cart', 'abandoned', 'submitted') === false, 'Cart abandoned cannot go to submitted');

  // ─── Catalog Task State Machine ─────────────────────────────────────
  console.log('\n--- Catalog Task Transitions ---');
  assert(canTransition('catalogTask', 'open', 'work_in_progress') === true, 'SCTASK open->work_in_progress');
  assert(canTransition('catalogTask', 'open', 'closed_complete') === true, 'SCTASK open->closed_complete');
  assert(canTransition('catalogTask', 'open', 'closed_incomplete') === true, 'SCTASK open->closed_incomplete');
  assert(canTransition('catalogTask', 'open', 'closed_skipped') === true, 'SCTASK open->closed_skipped');
  assert(canTransition('catalogTask', 'work_in_progress', 'open') === true, 'SCTASK work_in_progress->open');
  assert(canTransition('catalogTask', 'work_in_progress', 'closed_complete') === true, 'SCTASK work_in_progress->closed_complete');
  assert(canTransition('catalogTask', 'work_in_progress', 'closed_incomplete') === true, 'SCTASK work_in_progress->closed_incomplete');
  assert(canTransition('catalogTask', 'work_in_progress', 'closed_skipped') === true, 'SCTASK work_in_progress->closed_skipped');
  assert(canTransition('catalogTask', 'closed_complete', 'open') === true, 'SCTASK closed_complete->open (reopen)');
  assert(canTransition('catalogTask', 'closed_incomplete', 'open') === true, 'SCTASK closed_incomplete->open (reopen)');
  assert(canTransition('catalogTask', 'closed_skipped', 'open') === true, 'SCTASK closed_skipped->open (reopen)');
  assert(canTransition('catalogTask', 'closed_complete', 'work_in_progress') === false, 'SCTASK closed_complete cannot go to work_in_progress');
  assert(canTransition('catalogTask', 'open', 'open') === true, 'SCTASK no-op');

  // ─── allowedTransitions tests ───────────────────────────────────────
  console.log('\n--- allowedTransitions ---');
  const ritmFromOpen = allowedTransitions('ritm', 'open');
  assert(ritmFromOpen.includes('work_in_progress'), 'ritm open allows work_in_progress');
  assert(ritmFromOpen.includes('closed_complete'), 'ritm open allows closed_complete');
  assert(!ritmFromOpen.includes('closed'), 'ritm open does NOT allow closed');

  const cartFromActive = allowedTransitions('cart', 'active');
  assert(cartFromActive.includes('submitted'), 'cart active allows submitted');
  assert(cartFromActive.includes('abandoned'), 'cart active allows abandoned');
  assert(!cartFromActive.includes('closed'), 'cart active does NOT allow closed');

  console.log('\n=== REQUEST MANAGEMENT STATE MACHINE: ALL TESTS PASSED ===\n');
})().catch(err => { console.error(err.message); process.exit(1); });
