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

const TICKET_WORKING = ['triaged', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated'];

const TICKET_TRANSITIONS = {
  new: ['open', 'triaged', 'assigned', 'cancelled', 'rejected', 'duplicate', 'spam'],
  open: ['triaged', 'assigned', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'overdue', 'resolved', 'closed', 'cancelled', 'rejected', 'duplicate', 'spam'],
  triaged: ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'cancelled', 'rejected', 'duplicate', 'spam'],
  assigned: ['open', 'triaged', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'overdue', 'resolved', 'closed', 'cancelled', 'rejected', 'duplicate', 'spam'],
  in_progress: ['pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'resolved', 'open', 'assigned', 'cancelled'],
  pending_customer: ['open', 'assigned', 'in_progress', 'resolved', 'cancelled'],
  pending_vendor: ['open', 'assigned', 'in_progress', 'resolved', 'cancelled'],
  pending_approval: ['open', 'assigned', 'in_progress', 'resolved', 'cancelled', 'rejected'],
  on_hold: ['open', 'assigned', 'in_progress', 'resolved', 'cancelled'],
  escalated: ['open', 'assigned', 'in_progress', 'resolved', 'closed'],
  overdue: ['open', 'assigned', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'resolved', 'closed'],
  resolved: ['verification', 'open', 'assigned', 'closed'],
  verification: ['closed', 'open', 'assigned'],
  closed: ['open', 'assigned'], // reopen
  cancelled: ['open', 'assigned'],
  rejected: ['open', 'assigned'],
  duplicate: ['open', 'assigned'],
  spam: ['open', 'assigned'],
  archived: [], // exit only via restore flow
  deleted: [], // exit only via restore flow
};

const INCIDENT_TRANSITIONS = {
  new: ['in_progress', 'on_hold_caller', 'on_hold_change', 'on_hold_problem', 'on_hold_vendor', 'resolved', 'closed', 'canceled', 'investigating'],
  in_progress: ['on_hold_caller', 'on_hold_change', 'on_hold_problem', 'on_hold_vendor', 'resolved', 'closed', 'canceled', 'new'],
  on_hold_caller: ['in_progress', 'new', 'canceled'],
  on_hold_change: ['in_progress', 'new', 'canceled'],
  on_hold_problem: ['in_progress', 'new', 'canceled'],
  on_hold_vendor: ['in_progress', 'new', 'canceled'],
  resolved: ['closed', 'in_progress', 'new'],
  closed: ['in_progress', 'new'], // reopen
  canceled: ['new'], // reopen from cancellation
  investigating: ['identified', 'monitoring', 'resolved', 'in_progress'],
  identified: ['monitoring', 'resolved', 'in_progress', 'investigating'],
  monitoring: ['resolved', 'in_progress', 'investigating'],
};

const PROBLEM_TRANSITIONS = {
  new: ['assess', 'canceled'],
  assess: ['root_cause_analysis', 'fix_in_progress', 'resolved', 'canceled', 'risk_accepted'],
  root_cause_analysis: ['fix_in_progress', 'assess', 'canceled', 'risk_accepted'],
  fix_in_progress: ['resolved', 'root_cause_analysis', 'assess', 'canceled'],
  resolved: ['closed', 'fix_in_progress', 'assess'],
  closed: ['assess'],
  canceled: ['new'],
  risk_accepted: ['assess', 'canceled'],
};

const CHANGE_TRANSITIONS = {
  new: ['assess', 'canceled'],
  assess: ['authorize', 'canceled'],
  authorize: ['scheduled', 'assess', 'canceled'],
  scheduled: ['implement', 'authorize', 'canceled'],
  implement: ['review', 'scheduled'],
  review: ['closed', 'implement'],
  closed: [],
  canceled: ['new'],
};

const FAQ_TRANSITIONS = {
  draft: ['review', 'archived'],
  review: ['approved', 'draft'],
  approved: ['published', 'review'],
  published: ['expired', 'archived', 'review', 'draft'],
  expired: ['review', 'archived'],
  archived: ['draft'],
};

const TASK_TRANSITIONS = {
  new: ['open', 'in_progress', 'cancelled'],
  open: ['in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'cancelled'],
  in_progress: ['pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'resolved', 'open'],
  pending_customer: ['open', 'in_progress', 'resolved', 'cancelled'],
  pending_vendor: ['open', 'in_progress', 'resolved', 'cancelled'],
  pending_approval: ['open', 'in_progress', 'resolved', 'cancelled'],
  on_hold: ['open', 'in_progress', 'resolved', 'cancelled'],
  resolved: ['closed', 'open', 'in_progress'],
  closed: ['open'],
  cancelled: ['open'],
};

const CART_TRANSITIONS = {
  active: ['submitted', 'abandoned'],
  submitted: ['active'],
  abandoned: ['active'],
};

const REQUEST_TRANSITIONS = {
  open: ['work_in_progress', 'closed_complete', 'closed_incomplete', 'closed_canceled'],
  work_in_progress: ['open', 'closed_complete', 'closed_incomplete', 'closed_canceled'],
  closed_complete: ['open'],
  closed_incomplete: ['open'],
  closed_canceled: ['open'],
};

const RITM_TRANSITIONS = {
  pending_approval: ['open', 'closed_canceled'],
  open: ['work_in_progress', 'pending_approval', 'closed_complete', 'closed_incomplete', 'closed_canceled'],
  work_in_progress: ['open', 'pending_approval', 'closed_complete', 'closed_incomplete', 'closed_canceled'],
  closed_complete: ['open'],
  closed_incomplete: ['open'],
  closed_canceled: ['open'],
};

const CATALOG_TASK_TRANSITIONS = {
  open: ['work_in_progress', 'closed_complete', 'closed_incomplete', 'closed_skipped'],
  work_in_progress: ['open', 'closed_complete', 'closed_incomplete', 'closed_skipped'],
  closed_complete: ['open'],
  closed_incomplete: ['open'],
  closed_skipped: ['open'],
};

const MATRICES = {
  ticket: TICKET_TRANSITIONS,
  task: TASK_TRANSITIONS,
  incident: INCIDENT_TRANSITIONS,
  problem: PROBLEM_TRANSITIONS,
  change: CHANGE_TRANSITIONS,
  faq: FAQ_TRANSITIONS,
  cart: CART_TRANSITIONS,
  request: REQUEST_TRANSITIONS,
  ritm: RITM_TRANSITIONS,
  catalogTask: CATALOG_TASK_TRANSITIONS,
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
  TASK_TRANSITIONS,
  INCIDENT_TRANSITIONS,
  PROBLEM_TRANSITIONS,
  CHANGE_TRANSITIONS,
  FAQ_TRANSITIONS,
  CART_TRANSITIONS,
  REQUEST_TRANSITIONS,
  RITM_TRANSITIONS,
  CATALOG_TASK_TRANSITIONS,
  allowedTransitions,
  canTransition,
  assertTransition,
};
