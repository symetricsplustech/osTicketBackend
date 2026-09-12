/* eslint-disable no-console */
// Walk-Up Experience tests: state machines, validation, wait time, check-in flow
// DB-free unit tests. Run: node tests/walkup-engine.test.js
const assert = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); console.log(`PASS ${message}`); };

// ─── Constants ──────────────────────────────────────────────────────────

const LOCATION_STATUS = ['active', 'inactive', 'maintenance'];
const SERVICE_STATUS = ['active', 'inactive'];
const QUEUE_STATUS = ['open', 'paused', 'closed'];
const CHECKIN_METHOD = ['kiosk', 'mobile', 'desk', 'qr', 'appointment'];
const CHECKIN_STATUS = ['waiting', 'called', 'in_service', 'completed', 'no_show', 'cancelled'];
const APPOINTMENT_STATUS = ['scheduled', 'confirmed', 'checked_in', 'in_service', 'completed', 'no_show', 'cancelled', 'rescheduled'];
const INTERACTION_TYPE = ['checkin', 'consultation', 'troubleshooting', 'hardware_swap', 'software_install', 'access_request', 'training', 'other'];
const INTERACTION_OUTCOME = ['resolved', 'escalated', 'deferred', 'partial', 'no_action'];
const KIOSK_STATUS = ['online', 'offline', 'maintenance', 'error'];
const WAIT_EVENT_TYPE = ['checkin', 'called', 'started', 'completed', 'abandoned', 'reestimate'];

// ─── State Machines ────────────────────────────────────────────────────

const CHECKIN_TRANSITIONS = {
  waiting: ['called', 'cancelled', 'no_show'],
  called: ['in_service', 'cancelled', 'waiting'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const APPOINTMENT_TRANSITIONS = {
  scheduled: ['confirmed', 'checked_in', 'cancelled', 'rescheduled'],
  confirmed: ['checked_in', 'cancelled', 'rescheduled'],
  checked_in: ['in_service', 'cancelled', 'no_show'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: ['rescheduled'],
  rescheduled: ['scheduled', 'cancelled'],
};

const QUEUE_TRANSITIONS = {
  open: ['paused', 'closed'],
  paused: ['open', 'closed'],
  closed: ['open'],
};

const KIOSK_TRANSITIONS = {
  online: ['offline', 'maintenance', 'error'],
  offline: ['online', 'maintenance'],
  maintenance: ['online', 'offline'],
  error: ['online', 'maintenance', 'offline'],
};

function canTransition(current, target, transitions) {
  return transitions[current]?.includes(target) || false;
}

// ─── Validation ────────────────────────────────────────────────────────

function validateLocation(loc) {
  const errors = [];
  if (!loc.name) errors.push('name required');
  if (!loc.timezone) errors.push('timezone required');
  if (loc.status && !LOCATION_STATUS.includes(loc.status)) errors.push('invalid status');
  if (typeof loc.maxConcurrentCheckins === 'number' && loc.maxConcurrentCheckins < 1) errors.push('maxConcurrentCheckins >= 1');
  return errors;
}

function validateService(svc) {
  const errors = [];
  if (!svc.name) errors.push('name required');
  if (!svc.category || !['hardware', 'software', 'access', 'account', 'network', 'printer', 'phone', 'other'].includes(svc.category)) errors.push('invalid category');
  if (typeof svc.estimatedDuration === 'number' && svc.estimatedDuration < 1) errors.push('estimatedDuration >= 1');
  if (typeof svc.slaTargetMinutes === 'number' && svc.slaTargetMinutes < 1) errors.push('slaTargetMinutes >= 1');
  if (svc.status && !SERVICE_STATUS.includes(svc.status)) errors.push('invalid status');
  return errors;
}

function validateQueue(q) {
  const errors = [];
  if (!q.name) errors.push('name required');
  if (!q.locationId) errors.push('locationId required');
  if (!q.serviceId) errors.push('serviceId required');
  if (typeof q.maxSize === 'number' && q.maxSize < 1) errors.push('maxSize >= 1');
  if (q.status && !QUEUE_STATUS.includes(q.status)) errors.push('invalid status');
  return errors;
}

function validateCheckin(c) {
  const errors = [];
  if (!c.queueId) errors.push('queueId required');
  if (!c.userId) errors.push('userId required');
  if (!c.userName) errors.push('userName required');
  if (!c.checkinMethod || !CHECKIN_METHOD.includes(c.checkinMethod)) errors.push('invalid checkinMethod');
  if (c.priority && c.priority < 0) errors.push('priority >= 0');
  return errors;
}

function validateAppointment(a) {
  const errors = [];
  if (!a.locationId) errors.push('locationId required');
  if (!a.serviceId) errors.push('serviceId required');
  if (!a.userId) errors.push('userId required');
  if (!a.userName) errors.push('userName required');
  if (!a.scheduledAt) errors.push('scheduledAt required');
  if (typeof a.durationMinutes === 'number' && a.durationMinutes < 1) errors.push('durationMinutes >= 1');
  if (a.status && !APPOINTMENT_STATUS.includes(a.status)) errors.push('invalid status');
  return errors;
}

function validateInteraction(i) {
  const errors = [];
  if (!i.checkinId && !i.appointmentId) errors.push('checkinId or appointmentId required');
  if (!i.locationId) errors.push('locationId required');
  if (!i.userId) errors.push('userId required');
  if (!i.technicianId) errors.push('technicianId required');
  if (!i.subject) errors.push('subject required');
  if (i.type && !INTERACTION_TYPE.includes(i.type)) errors.push('invalid type');
  if (i.outcome && !INTERACTION_OUTCOME.includes(i.outcome)) errors.push('invalid outcome');
  return errors;
}

function validateKiosk(k) {
  const errors = [];
  if (!k.locationId) errors.push('locationId required');
  if (!k.name) errors.push('name required');
  if (k.status && !KIOSK_STATUS.includes(k.status)) errors.push('invalid status');
  return errors;
}

// ─── Wait Time Estimation ────────────────────────────────────────────

function estimateWaitTime(queueSize, avgServiceMinutes, avgConcurrent) {
  if (!avgServiceMinutes || !avgConcurrent) return 0;
  return Math.ceil((queueSize * avgServiceMinutes) / avgConcurrent);
}

function calculateWaitPercentile(times, percentile) {
  if (!times.length) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  const index = Math.ceil(percentile / 100 * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ─── Hours Helper ────────────────────────────────────────────────────

function isLocationOpen(hours, exceptions, date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = dayNames[date.getDay()];
  const exception = exceptions?.find(e => e.date.toDateString() === date.toDateString());
  if (exception?.closed) return false;
  if (exception) return !exception.closed;
  const dayHours = hours[day];
  if (dayHours?.closed) return false;
  const time = date.toTimeString().slice(0, 5);
  return time >= dayHours.open && time <= dayHours.close;
}

// ─── TESTS ─────────────────────────────────────────────────────────────

console.log('\n=== CHECK-IN STATE MACHINE ===\n');

assert(canTransition('waiting', 'called', CHECKIN_TRANSITIONS) === true, 'waiting->called');
assert(canTransition('waiting', 'cancelled', CHECKIN_TRANSITIONS) === true, 'waiting->cancelled');
assert(canTransition('waiting', 'no_show', CHECKIN_TRANSITIONS) === true, 'waiting->no_show');
assert(canTransition('called', 'in_service', CHECKIN_TRANSITIONS) === true, 'called->in_service');
assert(canTransition('called', 'waiting', CHECKIN_TRANSITIONS) === true, 'called->waiting (recall)');
assert(canTransition('in_service', 'completed', CHECKIN_TRANSITIONS) === true, 'in_service->completed');
assert(canTransition('completed', 'in_service', CHECKIN_TRANSITIONS) === false, 'completed->in_service blocked');

console.log('\n=== APPOINTMENT STATE MACHINE ===\n');

assert(canTransition('scheduled', 'confirmed', APPOINTMENT_TRANSITIONS) === true, 'scheduled->confirmed');
assert(canTransition('scheduled', 'cancelled', APPOINTMENT_TRANSITIONS) === true, 'scheduled->cancelled');
assert(canTransition('confirmed', 'checked_in', APPOINTMENT_TRANSITIONS) === true, 'confirmed->checked_in');
assert(canTransition('checked_in', 'in_service', APPOINTMENT_TRANSITIONS) === true, 'checked_in->in_service');
assert(canTransition('in_service', 'completed', APPOINTMENT_TRANSITIONS) === true, 'in_service->completed');
assert(canTransition('no_show', 'rescheduled', APPOINTMENT_TRANSITIONS) === true, 'no_show->rescheduled');
assert(canTransition('completed', 'in_service', APPOINTMENT_TRANSITIONS) === false, 'completed->in_service blocked');

console.log('\n=== QUEUE STATE MACHINE ===\n');

assert(canTransition('open', 'paused', QUEUE_TRANSITIONS) === true, 'open->paused');
assert(canTransition('paused', 'open', QUEUE_TRANSITIONS) === true, 'paused->open');
assert(canTransition('closed', 'open', QUEUE_TRANSITIONS) === true, 'closed->open (reopen)');

console.log('\n=== KIOSK STATE MACHINE ===\n');

assert(canTransition('online', 'offline', KIOSK_TRANSITIONS) === true, 'online->offline');
assert(canTransition('online', 'maintenance', KIOSK_TRANSITIONS) === true, 'online->maintenance');
assert(canTransition('maintenance', 'online', KIOSK_TRANSITIONS) === true, 'maintenance->online');
assert(canTransition('error', 'online', KIOSK_TRANSITIONS) === true, 'error->online');

console.log('\n=== VALIDATION: LOCATION ===\n');

assert(validateLocation({ name: 'Main Lobby', timezone: 'UTC', maxConcurrentCheckins: 10 }).length === 0, 'valid location passes');
assert(validateLocation({ name: 'Test', timezone: 'UTC', maxConcurrentCheckins: 0 }).length > 0, 'maxConcurrentCheckins < 1 rejected');
assert(validateLocation({ name: 'Test', timezone: 'UTC', status: 'invalid' }).length > 0, 'invalid status rejected');

console.log('\n=== VALIDATION: SERVICE ===\n');

assert(validateService({ name: 'Hardware Support', category: 'hardware', estimatedDuration: 15, slaTargetMinutes: 30 }).length === 0, 'valid service passes');
assert(validateService({ name: 'Test', category: 'invalid' }).length > 0, 'invalid category rejected');
assert(validateService({ name: 'Test', category: 'hardware', estimatedDuration: 0 }).length > 0, 'estimatedDuration < 1 rejected');
assert(validateService({ name: 'Test', category: 'hardware', slaTargetMinutes: 0 }).length > 0, 'slaTargetMinutes < 1 rejected');

console.log('\n=== VALIDATION: QUEUE ===\n');

assert(validateQueue({ name: 'Hardware Queue', locationId: 'loc1', serviceId: 'svc1', maxSize: 20 }).length === 0, 'valid queue passes');
assert(validateQueue({ name: 'Test', locationId: 'loc1', serviceId: 'svc1', maxSize: 0 }).length > 0, 'maxSize < 1 rejected');

console.log('\n=== VALIDATION: CHECK-IN ===\n');

assert(validateCheckin({ queueId: 'q1', userId: 'u1', userName: 'John', checkinMethod: 'kiosk' }).length === 0, 'valid check-in passes');
assert(validateCheckin({ queueId: 'q1', userId: 'u1', userName: 'John', checkinMethod: 'invalid' }).length > 0, 'invalid checkinMethod rejected');
assert(validateCheckin({ queueId: 'q1', userId: 'u1', userName: 'John', checkinMethod: 'kiosk', priority: -1 }).length > 0, 'negative priority rejected');

console.log('\n=== VALIDATION: APPOINTMENT ===\n');

assert(validateAppointment({ locationId: 'loc1', serviceId: 'svc1', userId: 'u1', userName: 'John', scheduledAt: '2026-01-01T10:00:00' }).length === 0, 'valid appointment passes');
assert(validateAppointment({ locationId: 'loc1', serviceId: 'svc1', userId: 'u1', userName: 'John', scheduledAt: '2026-01-01T10:00:00', durationMinutes: 0 }).length > 0, 'durationMinutes < 1 rejected');

console.log('\n=== VALIDATION: INTERACTION ===\n');

assert(validateInteraction({ checkinId: 'ci1', locationId: 'loc1', userId: 'u1', technicianId: 't1', subject: 'Laptop issue' }).length === 0, 'valid interaction (checkin) passes');
assert(validateInteraction({ appointmentId: 'ap1', locationId: 'loc1', userId: 'u1', technicianId: 't1', subject: 'Setup' }).length === 0, 'valid interaction (appointment) passes');
assert(validateInteraction({ locationId: 'loc1', userId: 'u1', technicianId: 't1', subject: 'Test' }).length > 0, 'missing checkinId/appointmentId rejected');
assert(validateInteraction({ checkinId: 'ci1', locationId: 'loc1', userId: 'u1', technicianId: 't1', subject: 'Test', type: 'invalid' }).length > 0, 'invalid type rejected');
assert(validateInteraction({ checkinId: 'ci1', locationId: 'loc1', userId: 'u1', technicianId: 't1', subject: 'Test', outcome: 'invalid' }).length > 0, 'invalid outcome rejected');

console.log('\n=== VALIDATION: KIOSK ===\n');

assert(validateKiosk({ locationId: 'loc1', name: 'Kiosk 1' }).length === 0, 'valid kiosk passes');
assert(validateKiosk({ locationId: 'loc1', name: 'Kiosk 1', status: 'invalid' }).length > 0, 'invalid status rejected');

console.log('\n=== WAIT TIME ESTIMATION ===\n');

assert(estimateWaitTime(10, 15, 2) === 75, '10 in queue, 15 min service, 2 concurrent = 75 min');
assert(estimateWaitTime(5, 10, 1) === 50, '5 in queue, 10 min service, 1 concurrent = 50 min');
assert(estimateWaitTime(0, 15, 2) === 0, 'empty queue = 0 wait');
assert(estimateWaitTime(10, 0, 2) === 0, 'zero service time = 0 wait');
assert(estimateWaitTime(10, 15, 0) === 0, 'zero concurrent = 0 wait');

const times = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
assert(calculateWaitPercentile(times, 50) === 25, '50th percentile of 5-50 is 25');
assert(calculateWaitPercentile(times, 90) === 45, '90th percentile of 5-50 is 45');
assert(calculateWaitPercentile([], 50) === 0, 'empty times = 0');

console.log('\n=== HOURS HELPER ===\n');

const hours = {
  monday: { open: '09:00', close: '17:00', closed: false },
  tuesday: { open: '09:00', close: '17:00', closed: false },
  wednesday: { open: '09:00', close: '17:00', closed: false },
  thursday: { open: '09:00', close: '17:00', closed: false },
  friday: { open: '09:00', close: '17:00', closed: false },
  saturday: { open: '10:00', close: '14:00', closed: true },
  sunday: { open: '10:00', close: '14:00', closed: true },
};

assert(isLocationOpen(hours, [], new Date('2026-01-05T10:00:00')) === true, 'Monday 10am open');
assert(isLocationOpen(hours, [], new Date('2026-01-05T08:00:00')) === false, 'Monday 8am closed');
assert(isLocationOpen(hours, [], new Date('2026-01-05T18:00:00')) === false, 'Monday 6pm closed');
assert(isLocationOpen(hours, [], new Date('2026-01-10T11:00:00')) === false, 'Saturday closed (default)');
assert(isLocationOpen(hours, [], new Date('2026-01-11T11:00:00')) === false, 'Sunday closed (default)');

const exceptions = [{ date: new Date('2026-01-05'), closed: true, reason: 'Holiday' }];
assert(isLocationOpen(hours, exceptions, new Date('2026-01-05T10:00:00')) === false, 'Exception day closed');

console.log('\n=== CONSTANTS ===\n');

assert(LOCATION_STATUS.length === 3, '3 location statuses');
assert(SERVICE_STATUS.length === 2, '2 service statuses');
assert(QUEUE_STATUS.length === 3, '3 queue statuses');
assert(CHECKIN_METHOD.length === 5, '5 check-in methods');
assert(CHECKIN_STATUS.length === 6, '6 check-in statuses');
assert(APPOINTMENT_STATUS.length === 8, '8 appointment statuses');
assert(INTERACTION_TYPE.length === 8, '8 interaction types');
assert(INTERACTION_OUTCOME.length === 5, '5 interaction outcomes');
assert(KIOSK_STATUS.length === 4, '4 kiosk statuses');
assert(WAIT_EVENT_TYPE.length === 6, '6 wait event types');

console.log('\n✅ ALL WALK-UP ENGINE TESTS PASSED\n');
