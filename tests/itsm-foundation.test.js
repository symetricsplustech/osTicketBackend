/* eslint-disable no-console */
// ITSM foundation: numbering format, state machines, SLA plan calendar,
// role-level deny. DB-free. Run: npm run test:itsm-foundation
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const { formatNumber } = require('../src/services/numbering.service');
const { canTransition, assertTransition } = require('../src/services/stateMachine.service');
const { isWithinPlanHours } = require('../src/services/sla.service');
const { checkPermission } = require('../src/services/authorization.service');

(async () => {
  // Numbering format (MD §68)
  assert(formatNumber('INC', 1) === 'INC-000001', 'incident numbers zero-pad');
  assert(formatNumber('RITM', 42) === 'RITM-000042', 'ritm prefix formats');

  // Ticket lifecycle (MD §65)
  assert(canTransition('ticket', 'open', 'assigned') === true, 'ticket open->assigned');
  assert(canTransition('ticket', 'open', 'closed') === true, 'ticket open->closed');
  assert(canTransition('ticket', 'closed', 'open') === true, 'ticket closed->open (reopen)');
  assert(canTransition('ticket', 'archived', 'open') === false, 'ticket archived cannot reopen via status');
  assert(canTransition('ticket', 'deleted', 'open') === false, 'ticket deleted is terminal via status');
  assert(canTransition('ticket', 'open', 'my_custom', ['my_custom']) === true, 'custom statuses participate');
  let threw = null;
  try { assertTransition('ticket', 'archived', 'open'); } catch (e) { threw = e; }
  assert(threw && threw.statusCode === 422 && /Allowed/.test(threw.message), 'illegal transition throws 422 with allowed list');

  // Incident / problem / change / faq matrices
  assert(canTransition('incident', 'investigating', 'resolved') === true, 'incident fast resolve');
  assert(canTransition('incident', 'closed', 'investigating') === true, 'incident reopen');
  assert(canTransition('incident', 'resolved', 'identified') === false, 'incident no backward jump');
  assert(canTransition('problem', 'open', 'investigation') === true, 'problem open->investigation');
  assert(canTransition('problem', 'fixed', 'closed') === true, 'problem fixed->closed');
  assert(canTransition('problem', 'open', 'fixed') === false, 'problem cannot skip RCA');
  assert(canTransition('change', 'for_approval', 'approved') === true, 'CAB approve');
  assert(canTransition('change', 'for_approval', 'rejected') === true, 'CAB reject');
  assert(canTransition('change', 'draft', 'approved') === false, 'change cannot skip CAB');
  assert(canTransition('change', 'closed', 'draft') === false, 'closed change is terminal');
  assert(canTransition('faq', 'draft', 'review') === true, 'kb draft->review');
  assert(canTransition('faq', 'approved', 'published') === true, 'kb approved->published');
  assert(canTransition('faq', 'draft', 'published') === false, 'kb cannot skip review');

  // SLA plan calendar (MD ITSM-09)
  const plan247 = { schedule: '24/7' };
  assert(isWithinPlanHours(new Date('2026-01-04T03:00:00Z'), plan247) === true, '24/7 plan always in hours');
  const bh = { schedule: 'Business Hours', timezone: 'UTC', businessHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } };
  assert(isWithinPlanHours(new Date('2026-08-04T10:00:00Z'), bh) === true, 'tuesday 10am inside hours'); // 2026-08-04 is a Tuesday
  assert(isWithinPlanHours(new Date('2026-08-04T20:00:00Z'), bh) === false, 'tuesday 8pm outside hours');
  assert(isWithinPlanHours(new Date('2026-08-08T10:00:00Z'), bh) === false, 'saturday outside days'); // 2026-08-08 is a Saturday

  // Role-level deny (MD §22)
  const r = checkPermission(
    { _id: 'a', isActive: true, company: 'c', permissions: [], role: { permissions: ['tickets.delete'], deniedPermissions: ['tickets.delete'] } },
    'tickets.delete'
  );
  assert(r.granted === false && r.via === 'deny', 'role deny beats role allow');

  console.log('\nAll ITSM foundation tests passed.');
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
