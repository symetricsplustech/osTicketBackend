/**
 * Controlled state transitions (MD §65).
 *
 * Every workflow record moves through an explicit allow-list. Arbitrary
 * client updates (e.g. status='closed' from any state) are rejected with
 * 422 + the allowed targets. Terminal states (deleted/archived/closed)
 * cannot be exited through the status endpoint — restore/reopen flows own
 * those paths.
 *
 * Matrices are derived from the current Mongoose enums plus TicketStatus
 * custom statuses (custom keys are allowed to/from any non-terminal state;
 * per-status matrices are future tenant configuration).
 */

const ApiError = require('../utils/ApiError');

const TICKET_TERMINAL = ['closed', 'archived', 'deleted'];

const TICKET_TRANSITIONS = {
  open: ['assigned', 'overdue', 'closed'],
  assigned: ['open', 'overdue', 'closed'],
  overdue: ['open', 'assigned', 'closed'],
  closed: ['open', 'assigned'], // reopen
  archived: [], // exit only via restore flow
  deleted: [], // exit only via restore flow
};

const INCIDENT_TRANSITIONS = {
  investigating: ['identified', 'monitoring', 'resolved'],
  identified: ['monitoring', 'resolved', 'investigating'],
  monitoring: ['resolved', 'investigating'],
  resolved: ['closed', 'investigating'],
  closed: ['investigating'], // reopen
};

const PROBLEM_TRANSITIONS = {
  open: ['investigation', 'closed'],
  investigation: ['known_error', 'workaround', 'root_cause', 'closed'],
  known_error: ['workaround', 'root_cause', 'fix_in_progress', 'closed'],
  workaround: ['root_cause', 'fix_in_progress', 'closed'],
  root_cause: ['fix_in_progress', 'closed'],
  fix_in_progress: ['fixed', 'closed'],
  fixed: ['closed', 'investigation'],
  closed: ['investigation'], // reopen
};

const CHANGE_TRANSITIONS = {
  draft: ['requested', 'for_approval'],
  requested: ['for_approval', 'draft'],
  for_approval: ['approved', 'rejected', 'draft'],
  approved: ['scheduled', 'implementing'],
  scheduled: ['implementing'],
  implementing: ['validating', 'rolled_back'],
  validating: ['closed', 'implementing'],
  rejected: ['draft'],
  rolled_back: ['closed', 'draft'],
  closed: [], // terminal — clone to rework
};

const FAQ_TRANSITIONS = {
  draft: ['review', 'archived'],
  review: ['approved', 'draft'],
  approved: ['published', 'review'],
  published: ['expired', 'archived', 'review'],
  expired: ['review', 'archived'],
  archived: ['draft'],
};

const MATRICES = {
  ticket: TICKET_TRANSITIONS,
  incident: INCIDENT_TRANSITIONS,
  problem: PROBLEM_TRANSITIONS,
  change: CHANGE_TRANSITIONS,
  faq: FAQ_TRANSITIONS,
};

function allowedTransitions(entity, from, customStatuses = []) {
  const matrix = MATRICES[entity];
  if (!matrix) return null; // unknown entity — caller decides
  const base = [...(matrix[from] || [])];
  // Custom (tenant-configured) statuses participate freely except that
  // terminal states can never be exited via the status endpoint.
  if (entity === 'ticket' && !TICKET_TERMINAL.includes(from)) {
    for (const s of customStatuses) {
      if (!base.includes(s) && s !== from) base.push(s);
    }
  }
  return base;
}

function canTransition(entity, from, to, customStatuses = []) {
  if (from === to) return true; // no-op writes are always fine
  const allowed = allowedTransitions(entity, from, customStatuses);
  if (!allowed) return true; // unknown entity — do not block
  return allowed.includes(to);
}

function assertTransition(entity, from, to, customStatuses = []) {
  if (!canTransition(entity, from, to, customStatuses)) {
    throw new ApiError(
      422,
      `Invalid ${entity} transition from '${from}' to '${to}'. Allowed: ${(allowedTransitions(entity, from, customStatuses) || []).join(', ') || 'none'}`
    );
  }
}

module.exports = {
  TICKET_TERMINAL,
  TICKET_TRANSITIONS,
  INCIDENT_TRANSITIONS,
  PROBLEM_TRANSITIONS,
  CHANGE_TRANSITIONS,
  FAQ_TRANSITIONS,
  allowedTransitions,
  canTransition,
  assertTransition,
};
