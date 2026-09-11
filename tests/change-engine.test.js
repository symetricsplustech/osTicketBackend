/* eslint-disable no-console */
// Change Management tests: state machine, transitions
// DB-free unit tests. Run: node tests/change-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const { canTransition, allowedTransitions, CHANGE_TRANSITIONS } = require('../src/services/stateMachine.service');

(async () => {
  console.log('\n=== CHANGE STATE MACHINE TESTS ===\n');

  // --- new ---
  assert(canTransition('change', 'new', 'assess') === true, 'change new->assess');
  assert(canTransition('change', 'new', 'canceled') === true, 'change new->canceled');
  assert(canTransition('change', 'new', 'authorize') === false, 'change new cannot skip to authorize');
  assert(canTransition('change', 'new', 'scheduled') === false, 'change new cannot skip to scheduled');
  assert(canTransition('change', 'new', 'implement') === false, 'change new cannot skip to implement');
  assert(canTransition('change', 'new', 'review') === false, 'change new cannot skip to review');
  assert(canTransition('change', 'new', 'closed') === false, 'change new cannot skip to closed');

  // --- assess ---
  assert(canTransition('change', 'assess', 'authorize') === true, 'change assess->authorize');
  assert(canTransition('change', 'assess', 'canceled') === true, 'change assess->canceled');
  assert(canTransition('change', 'assess', 'scheduled') === false, 'change assess cannot skip to scheduled');
  assert(canTransition('change', 'assess', 'implement') === false, 'change assess cannot skip to implement');

  // --- authorize ---
  assert(canTransition('change', 'authorize', 'scheduled') === true, 'change authorize->scheduled');
  assert(canTransition('change', 'authorize', 'assess') === true, 'change authorize->assess (reject)');
  assert(canTransition('change', 'authorize', 'canceled') === true, 'change authorize->canceled');
  assert(canTransition('change', 'authorize', 'implement') === false, 'change authorize cannot skip to implement');

  // --- scheduled ---
  assert(canTransition('change', 'scheduled', 'implement') === true, 'change scheduled->implement');
  assert(canTransition('change', 'scheduled', 'authorize') === true, 'change scheduled->authorize (reschedule)');
  assert(canTransition('change', 'scheduled', 'canceled') === true, 'change scheduled->canceled');
  assert(canTransition('change', 'scheduled', 'review') === false, 'change scheduled cannot skip to review');

  // --- implement ---
  assert(canTransition('change', 'implement', 'review') === true, 'change implement->review');
  assert(canTransition('change', 'implement', 'scheduled') === true, 'change implement->scheduled (retry)');
  assert(canTransition('change', 'implement', 'closed') === false, 'change implement cannot skip to closed');

  // --- review ---
  assert(canTransition('change', 'review', 'closed') === true, 'change review->closed');
  assert(canTransition('change', 'review', 'implement') === true, 'change review->implement (rework)');
  assert(canTransition('change', 'review', 'scheduled') === false, 'change review cannot skip to scheduled');

  // --- closed ---
  assert(canTransition('change', 'closed', 'new') === false, 'change closed is terminal');
  assert(canTransition('change', 'closed', 'assess') === false, 'change closed cannot reopen');

  // --- canceled ---
  assert(canTransition('change', 'canceled', 'new') === true, 'change canceled->new (reopen)');
  assert(canTransition('change', 'canceled', 'assess') === false, 'change canceled cannot go to assess');
  assert(canTransition('change', 'canceled', 'scheduled') === false, 'change canceled cannot skip to scheduled');

  // --- No-op transitions ---
  assert(canTransition('change', 'new', 'new') === true, 'change no-op from new');
  assert(canTransition('change', 'assess', 'assess') === true, 'change no-op from assess');
  assert(canTransition('change', 'scheduled', 'scheduled') === true, 'change no-op from scheduled');

  // --- allowedTransitions ---
  const fromNew = allowedTransitions('change', 'new');
  assert(Array.isArray(fromNew), 'allowedTransitions returns array');
  assert(fromNew.includes('assess'), 'new allows assess');
  assert(fromNew.includes('canceled'), 'new allows canceled');
  assert(!fromNew.includes('scheduled'), 'new does NOT allow scheduled');

  const fromAuthorize = allowedTransitions('change', 'authorize');
  assert(fromAuthorize.includes('scheduled'), 'authorize allows scheduled');
  assert(fromAuthorize.includes('assess'), 'authorize allows assess');
  assert(!fromAuthorize.includes('implement'), 'authorize does NOT allow implement');

  const fromScheduled = allowedTransitions('change', 'scheduled');
  assert(fromScheduled.includes('implement'), 'scheduled allows implement');
  assert(fromScheduled.includes('authorize'), 'scheduled allows authorize');
  assert(!fromScheduled.includes('review'), 'scheduled does NOT allow review');

  // --- Legacy states removed ---
  assert(canTransition('change', 'draft', 'requested') === false, 'legacy draft->requested no longer valid');
  assert(canTransition('change', 'new', 'for_approval') === false, 'new cannot go to legacy for_approval');

  console.log('\n=== CHANGE STATE MACHINE: ALL TESTS PASSED ===\n');
})().catch(err => { console.error(err.message); process.exit(1); });
