/* eslint-disable no-console */
// Outage / Service Availability tests: state machine, validation, availability calc
// DB-free unit tests. Run: node tests/outage-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Constants ──────────────────────────────────────────────────────────

const OUTAGE_STATUS = ['investigating', 'identified', 'monitoring', 'resolved', 'closed', 'canceled'];
const OUTAGE_TYPE = ['planned', 'unplanned'];
const OUTAGE_SEVERITY = ['minor', 'major', 'critical'];
const CI_ROLE = ['primary', 'affected', 'related', 'dependency', 'root_cause'];
const CI_IMPACT = ['none', 'degraded', 'partial', 'complete'];
const SERVICE_ROLE = ['primary', 'supporting', 'dependent', 'customer_facing'];
const SERVICE_IMPACT = ['none', 'degraded', 'partial', 'complete'];
const TIMELINE_STATUS = ['investigating', 'identified', 'monitoring', 'resolved', 'closed', 'canceled'];
const COMM_INTERNAL = ['enabled', 'cadenceMinutes', 'channels'];
const COMM_EXTERNAL = ['enabled', 'cadenceMinutes', 'channels'];
const AVAILABILITY_GRANULARITY = ['hourly', 'daily', 'weekly', 'monthly'];

// ─── State Machine ────────────────────────────────────────────────────

const OUTAGE_TRANSITIONS = {
  investigating: ['identified', 'canceled'],
  identified: ['monitoring', 'investigating', 'canceled'],
  monitoring: ['resolved', 'identified', 'canceled'],
  resolved: ['closed', 'monitoring'],
  closed: [],
  canceled: [],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation ────────────────────────────────────────────────────────

function validateOutage(o) {
  const errors = [];
  if (!o.title) errors.push('title required');
  if (!o.type || !OUTAGE_TYPE.includes(o.type)) errors.push('invalid type');
  if (!o.severity || !OUTAGE_SEVERITY.includes(o.severity)) errors.push('invalid severity');
  if (o.status && !OUTAGE_STATUS.includes(o.status)) errors.push('invalid status');
  if (o.startTime && o.plannedEnd && new Date(o.plannedEnd) <= new Date(o.startTime)) errors.push('plannedEnd must be after startTime');
  if (o.estimatedRestoration && o.startTime && new Date(o.estimatedRestoration) <= new Date(o.startTime)) errors.push('estimatedRestoration must be after startTime');
  return errors;
}

function validateCIAssociation(c) {
  const errors = [];
  if (!c.ciId) errors.push('ciId required');
  if (!c.outageId) errors.push('outageId required');
  if (c.role && !CI_ROLE.includes(c.role)) errors.push('invalid role');
  if (c.impact && !CI_IMPACT.includes(c.impact)) errors.push('invalid impact');
  return errors;
}

function validateServiceAssociation(s) {
  const errors = [];
  if (!s.serviceId) errors.push('serviceId required');
  if (!s.outageId) errors.push('outageId required');
  if (s.role && !SERVICE_ROLE.includes(s.role)) errors.push('invalid role');
  if (s.impact && !SERVICE_IMPACT.includes(s.impact)) errors.push('invalid impact');
  return errors;
}

function validateTimelineEntry(t) {
  const errors = [];
  if (!t.status || !TIMELINE_STATUS.includes(t.status)) errors.push('invalid status');
  if (!t.message) errors.push('message required');
  return errors;
}

function validateAvailabilityRecord(r) {
  const errors = [];
  if (!r.entityType || !['business_service', 'technical_service', 'ci'].includes(r.entityType)) errors.push('invalid entityType');
  if (!r.entityId) errors.push('entityId required');
  if (!r.periodStart) errors.push('periodStart required');
  if (!r.periodEnd) errors.push('periodEnd required');
  if (r.availabilityPercentage !== undefined && (r.availabilityPercentage < 0 || r.availabilityPercentage > 100)) errors.push('availabilityPercentage 0-100');
  return errors;
}

function validateCommunicationPlan(c) {
  const errors = [];
  if (c.internal?.enabled && (c.internal.cadenceMinutes < 1 || c.internal.cadenceMinutes > 1440)) errors.push('internal cadence 1-1440 min');
  if (c.external?.enabled && (c.external.cadenceMinutes < 1 || c.external.cadenceMinutes > 1440)) errors.push('external cadence 1-1440 min');
  return errors;
}

// ─── Availability Calculation ─────────────────────────────────────────

function calculateAvailability(outages, periodStart, periodEnd) {
  const totalMs = periodEnd - periodStart;
  const totalMinutes = totalMs / 60000;
  if (totalMinutes <= 0) return { availability: 100, downtimeMinutes: 0, uptimeMinutes: 0 };

  let downtimeMs = 0;
  for (const o of outages) {
    if (!o.startTime) continue;
    const outageStart = Math.max(o.startTime, periodStart);
    const outageEnd = o.actualRestoration ? Math.min(o.actualRestoration, periodEnd) : periodEnd;
    if (outageEnd > outageStart) downtimeMs += outageEnd - outageStart;
  }

  const downtimeMinutes = downtimeMs / 60000;
  const uptimeMinutes = totalMinutes - downtimeMinutes;
  const availability = totalMinutes > 0 ? Math.max(0, (uptimeMinutes / totalMinutes) * 100) : 100;

  return {
    availability: Math.round(availability * 100) / 100,
    uptimeMinutes: Math.round(uptimeMinutes),
    downtimeMinutes: Math.round(downtimeMinutes),
    totalMinutes: Math.round(totalMinutes),
  };
}

// ─── Communication Cadence ────────────────────────────────────────────

function nextCommunicationTime(lastAt, cadenceMinutes) {
  if (!lastAt) return new Date();
  return new Date(new Date(lastAt).getTime() + cadenceMinutes * 60000);
}

function isCommunicationDue(nextAt) {
  if (!nextAt) return false;
  return new Date(nextAt) <= new Date();
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log('\n=== OUTAGE STATE MACHINE ===\n');

assert(canTransition('investigating', 'identified', OUTAGE_TRANSITIONS) === true, 'investigating->identified');
assert(canTransition('investigating', 'canceled', OUTAGE_TRANSITIONS) === true, 'investigating->canceled');
assert(canTransition('identified', 'monitoring', OUTAGE_TRANSITIONS) === true, 'identified->monitoring');
assert(canTransition('identified', 'investigating', OUTAGE_TRANSITIONS) === true, 'identified->investigating');
assert(canTransition('monitoring', 'resolved', OUTAGE_TRANSITIONS) === true, 'monitoring->resolved');
assert(canTransition('monitoring', 'identified', OUTAGE_TRANSITIONS) === true, 'monitoring->identified');
assert(canTransition('resolved', 'closed', OUTAGE_TRANSITIONS) === true, 'resolved->closed');
assert(canTransition('resolved', 'monitoring', OUTAGE_TRANSITIONS) === true, 'resolved->monitoring (reopen)');
assert(canTransition('closed', 'investigating', OUTAGE_TRANSITIONS) === false, 'closed->investigating blocked');
assert(canTransition('canceled', 'investigating', OUTAGE_TRANSITIONS) === false, 'canceled->investigating blocked');

console.log('\n=== VALIDATION: OUTAGE ===\n');

assert(validateOutage({ title: 'DB Outage', type: 'unplanned', severity: 'critical', startTime: new Date() }).length === 0, 'valid outage passes');
assert(validateOutage({ title: 'Test', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateOutage({ title: 'Test', severity: 'invalid' }).length > 0, 'invalid severity rejected');
assert(validateOutage({ title: 'Test', type: 'unplanned', severity: 'major', startTime: new Date(), plannedEnd: new Date(Date.now() - 1000) }).length > 0, 'plannedEnd before startTime rejected');
assert(validateOutage({ title: 'Test', type: 'planned', severity: 'minor', startTime: new Date('2026-01-01'), plannedEnd: new Date('2026-01-02'), estimatedRestoration: new Date('2025-12-31') }).length > 0, 'estimatedRestoration before startTime rejected');

console.log('\n=== VALIDATION: CI ASSOCIATION ===\n');

assert(validateCIAssociation({ ciId: 'ci1', outageId: 'out1', role: 'primary', impact: 'complete' }).length === 0, 'valid CI association passes');
assert(validateCIAssociation({ ciId: 'ci1', outageId: 'out1', role: 'invalid' }).length > 0, 'invalid role rejected');
assert(validateCIAssociation({ ciId: 'ci1', outageId: 'out1', impact: 'invalid' }).length > 0, 'invalid impact rejected');
assert(validateCIAssociation({ outageId: 'out1', role: 'primary' }).length > 0, 'ciId required rejected');

console.log('\n=== VALIDATION: SERVICE ASSOCIATION ===\n');

assert(validateServiceAssociation({ serviceId: 'svc1', outageId: 'out1', role: 'primary', impact: 'degraded' }).length === 0, 'valid service association passes');
assert(validateServiceAssociation({ serviceId: 'svc1', outageId: 'out1', role: 'invalid' }).length > 0, 'invalid role rejected');
assert(validateServiceAssociation({ serviceId: 'svc1', outageId: 'out1', impact: 'invalid' }).length > 0, 'invalid impact rejected');

console.log('\n=== VALIDATION: TIMELINE ===\n');

assert(validateTimelineEntry({ status: 'identified', message: 'Root cause found' }).length === 0, 'valid timeline passes');
assert(validateTimelineEntry({ status: 'invalid', message: 'test' }).length > 0, 'invalid status rejected');
assert(validateTimelineEntry({ status: 'identified' }).length > 0, 'message required rejected');

console.log('\n=== VALIDATION: AVAILABILITY RECORD ===\n');

assert(validateAvailabilityRecord({ entityType: 'business_service', entityId: 'svc1', periodStart: new Date(), periodEnd: new Date(), availabilityPercentage: 99.9 }).length === 0, 'valid record passes');
assert(validateAvailabilityRecord({ entityType: 'invalid', entityId: 'svc1', periodStart: new Date(), periodEnd: new Date() }).length > 0, 'invalid entityType rejected');
assert(validateAvailabilityRecord({ entityType: 'business_service', entityId: 'svc1', availabilityPercentage: 150 }).length > 0, 'availability > 100 rejected');
assert(validateAvailabilityRecord({ entityType: 'business_service', entityId: 'svc1', availabilityPercentage: -5 }).length > 0, 'availability < 0 rejected');

console.log('\n=== VALIDATION: COMMUNICATION PLAN ===\n');

assert(validateCommunicationPlan({ internal: { enabled: true, cadenceMinutes: 30 } }).length === 0, 'valid comm plan passes');
assert(validateCommunicationPlan({ internal: { enabled: true, cadenceMinutes: 0 } }).length > 0, 'cadence < 1 rejected');
assert(validateCommunicationPlan({ internal: { enabled: true, cadenceMinutes: 2000 } }).length > 0, 'cadence > 1440 rejected');

console.log('\n=== AVAILABILITY CALCULATION ===\n');

const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;
const periodStart = now - dayMs;
const periodEnd = now;

// No outages = 100% availability
assert(calculateAvailability([], periodStart, periodEnd).availability === 100, 'no outages = 100%');

// One 1-hour outage in 24h = 95.83%
const outage1h = [{ startTime: periodStart + 2 * 3600 * 1000, actualRestoration: periodStart + 3 * 3600 * 1000 }];
const result1h = calculateAvailability(outage1h, periodStart, periodEnd);
assert(Math.abs(result1h.availability - 95.83) < 0.02, '1h outage in 24h = 95.83%');

// 2-hour outage in 24h = 91.67%
const outage2h = [{ startTime: periodStart, actualRestoration: periodStart + 2 * 3600 * 1000 }];
const result2h = calculateAvailability(outage2h, periodStart, periodEnd);
assert(Math.abs(result2h.availability - 91.67) < 0.02, '2h outage in 24h = 91.67%');

// Outage spanning boundary
const outageBoundary = [{ startTime: periodStart - 3600 * 1000, actualRestoration: periodStart + 3600 * 1000 }];
const resultBoundary = calculateAvailability(outageBoundary, periodStart, periodEnd);
assert(Math.abs(resultBoundary.availability - 95.83) < 0.02, 'outage spanning boundary calculated correctly');

// Outage after period
const outageAfter = [{ startTime: periodEnd + 3600 * 1000, actualRestoration: periodEnd + 2 * 3600 * 1000 }];
assert(calculateAvailability(outageAfter, periodStart, periodEnd).availability === 100, 'outage after period = 100%');

// Multiple outages
const multiOutages = [
  { startTime: periodStart, actualRestoration: periodStart + 3600 * 1000 },
  { startTime: periodStart + 12 * 3600 * 1000, actualRestoration: periodStart + 13 * 3600 * 1000 },
];
const multiResult = calculateAvailability(multiOutages, periodStart, periodEnd);
assert(Math.abs(multiResult.availability - 91.67) < 0.02, '2x 1h outages = 91.67%');

console.log('\n=== COMMUNICATION CADENCE ===\n');

const base = new Date('2026-01-01T10:00:00');
assert(nextCommunicationTime(base, 30).getTime() === new Date('2026-01-01T10:30:00').getTime(), '30 min cadence');
assert(nextCommunicationTime(base, 60).getTime() === new Date('2026-01-01T11:00:00').getTime(), '60 min cadence');
assert(nextCommunicationTime(base, 1440).getTime() === new Date('2026-01-02T10:00:00').getTime(), '24h cadence');
assert(nextCommunicationTime(null, 30).getTime() <= Date.now(), 'null lastAt = now');

const future = new Date(Date.now() + 3600000);
const past = new Date(Date.now() - 3600000);
assert(isCommunicationDue(future) === false, 'future not due');
assert(isCommunicationDue(past) === true, 'past due');
assert(isCommunicationDue(null) === false, 'null not due');

console.log('\n=== CONSTANTS ===\n');

assert(OUTAGE_STATUS.length === 6, '6 outage statuses');
assert(OUTAGE_TYPE.length === 2, '2 outage types');
assert(OUTAGE_SEVERITY.length === 3, '3 severity levels');
assert(CI_ROLE.length === 5, '5 CI roles');
assert(CI_IMPACT.length === 4, '4 CI impact levels');
assert(SERVICE_ROLE.length === 4, '4 service roles');
assert(SERVICE_IMPACT.length === 4, '4 service impact levels');
assert(TIMELINE_STATUS.length === 6, '6 timeline statuses');
assert(AVAILABILITY_GRANULARITY.length === 4, '4 granularities');

console.log('\n✅ ALL OUTAGE ENGINE TESTS PASSED\n');
