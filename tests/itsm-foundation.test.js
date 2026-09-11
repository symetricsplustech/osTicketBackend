/* eslint-disable no-console */
// ITSM foundation: numbering format, state machines, SLA plan calendar,
// role-level deny. DB-free. Run: npm run test:itsm-foundation
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

const { formatNumber } = require('../src/services/numbering.service');
const { canTransition, assertTransition } = require('../src/services/stateMachine.service');
const { isWithinPlanHours, dueInHours } = require('../src/services/sla.service');
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
  const Holiday = require('../src/models/Holiday');
  const originalHolidayFind = Holiday.find;
  Holiday.find = () => ({ lean: async () => [] });
  const quarterHourDue = await dueInHours(bh, 0.25, new Date('2026-08-04T09:00:00Z'), null);
  assert(quarterHourDue.toISOString() === '2026-08-04T09:15:00.000Z', 'business-hours SLA preserves sub-hour targets');
  const indiaPlan = { schedule: 'Business Hours', timezone: 'Asia/Kolkata', businessHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } };
  const indiaDue = await dueInHours(indiaPlan, 0.25, new Date('2026-08-04T03:30:00Z'), null);
  assert(indiaDue.toISOString() === '2026-08-04T03:45:00.000Z', 'business-hours SLA evaluates the plan timezone');
  Holiday.find = originalHolidayFind;

  const Ticket = require('../src/models/helpdesk/tickets/Ticket');
  const urgency = Ticket.schema.path('urgency');
  assert(urgency && urgency.enumValues.includes('medium') && urgency.enumValues.includes('critical'), 'ticket urgency has one compatible schema definition');

  // Tenant-learned triage (pure ranking)
  const { tokenize, suggest } = require('../src/services/suggestion.service');
  assert(tokenize('Printer NOT printing, please HELP!!!').join(',') === 'printer,printing', 'tokenizer lowercases, strips stopwords/short tokens');
  const corpus = [
    { _id: '1', number: 'T1', title: 'Printer jam on floor 3', body: 'paper jam printer hardware', dept: 'd1', deptName: 'Hardware', topic: 't1', topicName: 'Printers', priority: 'Normal' },
    { _id: '2', number: 'T2', title: 'VPN access request', body: 'need vpn access remote network', dept: 'd2', deptName: 'Network', topic: 't2', topicName: 'Access', priority: 'High' },
    { _id: '3', number: 'T3', title: 'Printer toner replacement', body: 'toner empty printer replace cartridge', dept: 'd1', deptName: 'Hardware', topic: 't1', topicName: 'Printers', priority: 'Low' },
  ];
  const s = suggest({ text: 'my printer has a paper jam and will not print', docs: corpus });
  assert(s.department[0] && String(s.department[0].id) === 'd1', 'triage votes hardware department');
  assert(s.similar[0] && s.similar[0].number === 'T1', 'most similar ticket ranks first');
  assert(suggest({ text: '', docs: corpus }).similar.length === 0, 'empty query suggests nothing');
  assert(suggest({ text: 'printer jam', docs: [] }).similar.length === 0, 'no history suggests nothing');

  // Extractive summarization (offline tier)
  const { extractiveSummary } = require('../src/services/ai.service');
  const long = [
    'The customer reports that the printer on floor three is jammed with error code E51 showing on the display panel.',
    'Agent asked the customer to power cycle the device and the customer confirmed the jam persists after restart.',
    'Ok thanks.',
    'A technician is scheduled for tomorrow morning to replace the fuser unit and clear the paper path.',
  ];
  const sum = extractiveSummary(long, 2);
  assert(sum.sentences.length === 2 && sum.summary.includes('printer'), 'extractive summary picks content sentences');

  // Change safety: overlap math + deterministic risk score
  const { overlaps, scoreChangeRisk } = require('../src/services/taskCore.service');
  assert(overlaps('2026-09-10T10:00Z', '2026-09-10T12:00Z', '2026-09-10T11:00Z', '2026-09-10T13:00Z') === true, 'overlapping windows detected');
  assert(overlaps('2026-09-10T10:00Z', '2026-09-10T11:00Z', '2026-09-10T11:00Z', '2026-09-10T12:00Z') === false, 'adjacent windows do not overlap');
  const r1 = scoreChangeRisk({ type: 'emergency', risk: 'critical', rollbackPlan: '' }, { overlapping: [{}, {}], blackouts: [{}], sharedAssets: [] });
  assert(r1 === 30 + 25 + 25 + 15, 'risk score adds type/risk/conflicts(capped)/missing-backout');
  const r2 = scoreChangeRisk({ type: 'standard', risk: 'low', rollbackPlan: 'revert' }, { overlapping: [], blackouts: [], sharedAssets: [] });
  assert(r2 === 0, 'safe standard change scores zero');

  // Role-level deny (MD §22)
  const r = checkPermission(
    { _id: 'a', isActive: true, company: 'c', permissions: [], role: { permissions: ['tickets.delete'], deniedPermissions: ['tickets.delete'] } },
    'tickets.delete'
  );
  assert(r.granted === false && r.via === 'deny', 'role deny beats role allow');

  console.log('\nAll ITSM foundation tests passed.');
  process.exit(0);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
