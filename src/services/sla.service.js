const SlaPlan = require('../models/SlaPlan');
const Holiday = require('../models/Holiday');
const SystemSetting = require('../models/SystemSetting');
const { emit } = require('./events');
const SlaEvent = require('../models/SlaEvent');

const SLA_TYPES = ['assignment', 'first_response', 'next_response', 'resolution', 'update', 'escalation', 'callback', 'approval', 'task', 'vendor', 'closure'];

const recordSlaEvent = async (ticket, event, clock, extra = {}) => {
  if (!ticket?._id) return;
  await SlaEvent.create({ level: 'tenant', company: ticket.company, ticket: ticket._id, policy: ticket.sla || null, policyModel: 'SlaPlan', service: 'helpdesk', event, clock: clock || '', priority: ticket.priority || '', occurredAt: new Date(), startedAt: ticket.slaStartedAt || ticket.createdAt, dueAt: clock === 'first_response' ? ticket.responseDueAt : ticket.resolutionDueAt || ticket.dueDate, ...extra }).catch(() => {});
};

let settingsCache = null;
let settingsCacheAt = 0;

const getSlaSettings = async () => {
  if (!settingsCache || Date.now() - settingsCacheAt > 60000) {
    try {
      const settings = await SystemSetting.getSettings();
      settingsCache = {
        timezone: settings.schedules?.timezone || 'UTC',
        days: settings.schedules?.days || {},
        enforce: settings.schedules?.enforceBusinessHours !== false,
      };
    } catch (err) {
      settingsCache = { timezone: 'UTC', days: {}, enforce: false };
    }
    settingsCacheAt = Date.now();
  }
  return settingsCache;
};

const getBusinessHours = async () => {
  const settings = await getSlaSettings();
  const days = settings.days || {};
  const hours = {};
  for (let i = 0; i < 7; i++) {
    const key = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][i];
    const cfg = days[key];
    if (cfg && cfg.enabled !== false && cfg.open) {
      hours[i] = { open: cfg.open, close: cfg.close || '17:00' };
    }
  }
  return hours;
};

const getHolidays = async (company) => {
  try {
    const comp = company ? { $or: [{ company }, { company: null }] } : { company: null };
    const holidays = await Holiday.find({ ...comp, isActive: true, date: { $ne: null } }).lean();
    const out = [];
    for (const h of holidays) {
      const d = new Date(h.date);
      if (isNaN(d.getTime())) continue;
      if (h.recurring) {
        out.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate(), recurring: true });
      } else {
        out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), recurring: false });
      }
    }
    return out;
  } catch (err) {
    return [];
  }
};

const isWorkingMoment = async (date, company) => {
  const settings = await getSlaSettings();
  if (!settings.enforce) return true;
  const hours = await getBusinessHours();
  if (!Object.keys(hours).length) return true; // no schedule configured -> 24/7
  const cfg = hours[date.getDay()];
  if (!cfg) return false;
  const [oh, om] = cfg.open.split(':').map(Number);
  const [ch, cm] = cfg.close.split(':').map(Number);
  const t = date.getHours() * 60 + date.getMinutes();
  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;
  if (t < openMin || t >= closeMin) return false;
  const holidays = await getHolidays(company);
  for (const h of holidays) {
    if (h.recurring && h.month === date.getMonth() + 1 && h.day === date.getDate()) return false;
    if (!h.recurring && h.year === date.getFullYear() && h.month === date.getMonth() + 1 && h.day === date.getDate()) return false;
  }
  return true;
};

/**
 * Compute a due date honouring the SLA schedule (24/7 or business hours from admin
 * Schedules + Holidays) for the given SLA type target.
 */
const dueInHours = async (plan, hours, startDate, company) => {
  if (!plan || plan.schedule === '24/7') {
    return new Date(new Date(startDate).getTime() + hours * 60 * 60 * 1000);
  }
  // Walk in minute increments so sub-hour targets remain exact. The schedule
  // is evaluated in the SLA plan timezone, not the Node process timezone.
  let due = new Date(startDate);
  let remainingMinutes = Math.ceil(Number(hours) * 60);
  let steps = 0;
  const maxSteps = 60 * 24 * 366 * 5;
  const holidays = await getHolidays(company);
  while (remainingMinutes > 0 && steps < maxSteps) {
    due = new Date(due.getTime() + 60 * 1000);
    steps += 1;
    if (isWithinPlanHours(due, plan) && !isHolidayInTimezone(due, plan.timezone, holidays)) {
      remainingMinutes -= 1;
    }
  }
  if (remainingMinutes > 0) throw new Error('SLA target exceeds the supported five-year schedule window');
  return due;
};

const computeDueDate = async (sla, startDate = new Date(), opts = {}) => {
  if (!sla) return null;
  const plan = await SlaPlan.findById(sla);
  if (!plan) return null;
  const slaType = opts.slaType || 'first_response';
  let hours = plan.gracePeriod || 24;
  if (plan.targets && typeof plan.targets[slaType] === 'number') {
    hours = plan.targets[slaType];
  }
  return dueInHours(plan, hours, startDate, plan.company || opts.company || null);
};

/**
 * Start the separate response + resolution clocks (§14). dueDate remains the
 * resolution clock for backward compatibility.
 */
const startClocks = async (sla, startDate = new Date(), opts = {}) => {
  if (!sla) return { responseDue: null, resolutionDue: null };
  const plan = await SlaPlan.findById(sla);
  if (!plan) return { responseDue: null, resolutionDue: null };
  const company = plan.company || opts.company || null;
  const responseHours = plan.targets && typeof plan.targets.first_response === 'number'
    ? plan.targets.first_response
    : plan.gracePeriod || 24;
  const resolutionHours = plan.targets && typeof plan.targets.resolution === 'number'
    ? plan.targets.resolution
    : plan.gracePeriod || 24;
  const [responseDue, resolutionDue] = await Promise.all([
    dueInHours(plan, responseHours, startDate, company),
    dueInHours(plan, resolutionHours, startDate, company),
  ]);
  return { responseDue, resolutionDue };
};

const getSlaHours = async (sla, slaType = 'first_response') => {
  if (!sla) return null;
  const plan = await SlaPlan.findById(sla);
  if (!plan) return null;
  if (plan.targets && typeof plan.targets[slaType] === 'number') return plan.targets[slaType];
  return plan.gracePeriod || 24;
};

/**
 * Pause the SLA timer (e.g. waiting on customer). Stores elapsed time so
 * resume can continue from the same due date.
 */
const pauseSla = async (ticket, waitingOn) => {
  if (!ticket || ticket.slaPaused || !ticket.dueDate) return ticket;
  if (ticket.sla) {
    const plan = await SlaPlan.findById(ticket.sla).select('pauseRules').lean();
    const key = { customer: 'waiting_customer', approval: 'pending_approval', vendor: 'pending_vendor' }[waitingOn] || 'on_hold';
    if (plan?.pauseRules && plan.pauseRules[key] === false) return ticket;
  }
  ticket.slaPaused = true;
  ticket.slaPausedAt = new Date();
  ticket.slaResumeAt = null;
  ticket.waitingOn = waitingOn || ticket.waitingOn || 'customer';
  await ticket.save().catch(() => {});
  await recordSlaEvent(ticket, 'paused', 'resolution', { reason: ticket.waitingOn });
  emit('sla.paused', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number });
  return ticket;
};

/**
 * Resume a paused SLA timer: pushes the due date forward by the paused duration.
 */
const resumeSla = async (ticket) => {
  if (!ticket || !ticket.slaPaused) return ticket;
  const pausedMs = ticket.slaPausedAt ? Date.now() - new Date(ticket.slaPausedAt).getTime() : 0;
  if (pausedMs > 0 && ticket.dueDate) {
    ticket.dueDate = new Date(new Date(ticket.dueDate).getTime() + pausedMs);
    if (ticket.resolutionDueAt) ticket.resolutionDueAt = new Date(new Date(ticket.resolutionDueAt).getTime() + pausedMs);
    if (!ticket.responseMetAt && ticket.responseDueAt) ticket.responseDueAt = new Date(new Date(ticket.responseDueAt).getTime() + pausedMs);
  }
  ticket.slaPaused = false;
  ticket.slaPausedAt = null;
  ticket.waitingOn = 'none';
  await ticket.save().catch(() => {});
  await recordSlaEvent(ticket, 'resumed', 'resolution', { pausedDurationMs: pausedMs });
  emit('sla.resumed', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number });
  return ticket;
};

/**
 * Heuristic SLA breach prediction (0-100). Factors: remaining time vs target,
 * agent workload, ticket complexity, queue depth, past breach history.
 */
const predictBreachRisk = async (ticket) => {
  if (!ticket || !ticket.dueDate) return 0;
  const now = Date.now();
  const remaining = new Date(ticket.dueDate).getTime() - now;
  const total = ticket.slaStartedAt
    ? now - new Date(ticket.slaStartedAt).getTime() - (ticket.slaPausedAt ? now - new Date(ticket.slaPausedAt).getTime() : 0)
    : Math.max(remaining, 1);
  let risk = Math.max(0, Math.min(100, 100 - (remaining / Math.max(total, 1)) * 100));
  // workload penalty
  const Ticket = require('../models/Ticket');
  if (ticket.agent) {
    const workload = await Ticket.countDocuments({ agent: ticket.agent, status: { $in: ['new', 'open', 'triaged', 'assigned', 'in_progress', 'pending_customer', 'pending_vendor', 'pending_approval', 'on_hold', 'escalated', 'overdue'] } });
    if (workload > 8) risk += 10;
    if (workload > 15) risk += 10;
  }
  // complexity penalty
  const complexityPenalty = { low: 0, medium: 10, high: 20 };
  risk += complexityPenalty[ticket.complexity] || 0;
  // priority boost
  const priorityBoost = { Low: -5, Normal: 0, High: 10, Emergency: 20 };
  risk += priorityBoost[ticket.priority] || 0;
  return Math.max(0, Math.min(100, Math.round(risk)));
};

/**
 * Mark overdue + emit breach events (sla.breached) + optional template email.
 */
const markOverdueTickets = async () => {
  const Ticket = require('../models/Ticket');
  const now = new Date();
  const candidates = await Ticket.find({
    dueDate: { $ne: null, $lte: now },
    isOverdue: false,
    slaPaused: false,
    status: { $nin: [Ticket.STATUSES.RESOLVED, Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
  }).lean();
  if (!candidates.length) return { modified: 0 };

  const ids = candidates.map((t) => t._id);
  await Ticket.updateMany(
    { _id: { $in: ids } },
    { $set: { isOverdue: true, status: Ticket.STATUSES.OVERDUE } }
  );

  const { sendFromTemplate } = require('./email.service');
  const { notifyAgent, notifyAdminRoom } = require('./notification.service');

  for (const t of candidates) {
    emit('sla.breached', { company: t.company, ticketId: t._id, ticketNumber: t.number, dueDate: t.dueDate });
    await recordSlaEvent(t, 'breached', 'resolution', { completedAt: now, actual: new Date(t.dueDate).getTime() - new Date(t.slaStartedAt || t.createdAt).getTime(), unit: 'milliseconds' });
    emit('ticket.overdue', { company: t.company, ticketId: t._id, ticketNumber: t.number });
    const plan = t.sla ? await SlaPlan.findById(t.sla) : null;
    if (plan && plan.notifyOnBreach) {
      if (t.agent) {
        await notifyAgent({
          agentId: t.agent,
          type: 'overdue',
          message: `SLA breached for ticket #${t.number}`,
          link: `/agent/tickets/${t.number}`,
          ticket: t._id,
          company: t.company,
        });
        const assigned = t.agent ? await require('../models/Agent').findById(t.agent).select('email name').lean() : null;
        await sendFromTemplate({
          key: 'sla_breach',
          to: assigned?.email,
          data: { recipient: { name: assigned?.name || '' }, ticketNumber: t.number, dueDate: t.dueDate },
          event: 'sla_breach',
          ticket: t._id,
          company: t.company,
        }).catch(() => {});
      }
    }
  }
  return { modified: ids.length };
};

/**
 * Emit sla.at_risk warnings for tickets approaching their due date.
 */
const checkAtRiskTickets = async () => {
  const Ticket = require('../models/Ticket');
  const config = require('../config/config');
  const threshold = config.sla.warningThresholdHours || 2;
  const windowStart = new Date(Date.now() + threshold * 60 * 60 * 1000);
  const tickets = await Ticket.find({
    dueDate: { $ne: null, $gte: new Date(), $lte: windowStart },
    isOverdue: false,
    slaPaused: false,
    status: { $nin: [Ticket.STATUSES.RESOLVED, Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
  }).lean();
  for (const t of tickets) {
    emit('sla.at_risk', { company: t.company, ticketId: t._id, ticketNumber: t.number, dueDate: t.dueDate });
  }
};

const executeEscalationRules = async () => {
  const Ticket = require('../models/Ticket');
  const open = await Ticket.find({ sla: { $ne: null }, slaPaused: false, status: { $nin: ['resolved', 'closed', 'archived', 'deleted'] } }).populate('sla').limit(1000);
  let executed = 0;
  for (const ticket of open) {
    for (const rule of ticket.sla?.escalationRules || []) {
      const anchor = ticket.slaStartedAt || ticket.createdAt;
      if (Date.now() - new Date(anchor).getTime() < Number(rule.afterMinutes || 0) * 60000) continue;
      const exists = await SlaEvent.exists({ ticket: ticket._id, event: 'warning', 'metadata.ruleId': String(rule._id) });
      if (exists) continue;
      for (const action of rule.actions || []) {
        const payload = { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, action: action.type, target: action.target || '' };
        if (action.type === 'notify_agent' && ticket.agent) await require('./notification.service').notifyAgent({ agentId: ticket.agent, type: 'sla_breach', message: `SLA escalation for #${ticket.number}`, link: `/tickets/${ticket.number}`, ticket: ticket._id, company: ticket.company }).catch(() => {});
        else if (action.type === 'notify_company_admin' || action.type === 'notify_team_lead' || action.type === 'notify_department_manager') await require('./notification.service').notifyAdminRoom({ type: 'sla_breach', message: `SLA escalation for #${ticket.number}`, link: `/tickets/${ticket.number}`, ticket: ticket._id, company: ticket.company }).catch(() => {});
        else if (action.type === 'increase_priority') ticket.priority = ticket.priority === 'Emergency' ? 'Emergency' : 'Emergency';
        else if (action.type === 'escalate_ticket') ticket.status = Ticket.STATUSES.ESCALATED;
        emit(`sla.action.${action.type}`, payload); // email/SMS/push/webhook/major-incident workers consume this
      }
      await ticket.save().catch(() => {});
      await recordSlaEvent(ticket, 'warning', rule.clock || 'resolution', { metadata: { ruleId: String(rule._id), actions: rule.actions }, reason: `Escalation at ${rule.afterMinutes} minutes` });
      executed += 1;
    }
  }
  return { executed };
};

/**
 * Mark response-SLA breaches (first response clock). Unlike resolution
 * breaches this never flips status — it emits + notifies so the response
 * clock gets its own trackable event stream.
 */
const markResponseBreaches = async () => {
  const Ticket = require('../models/Ticket');
  const now = new Date();
  const open = await Ticket.find({
    responseDueAt: { $ne: null, $lte: now },
    responseMetAt: null,
    responseBreached: { $ne: true },
    status: { $nin: ['resolved', 'closed', 'archived', 'deleted'] },
  }).lean();
  if (!open.length) return { modified: 0 };

  await Ticket.updateMany(
    { _id: { $in: open.map((t) => t._id) } },
    { $set: { responseBreached: true } }
  );

  const { sendFromTemplate } = require('./email.service');
  const { notifyAgent } = require('./notification.service');
  for (const t of open) {
    emit('sla.breached', { company: t.company, ticketId: t._id, ticketNumber: t.number, clock: 'response', dueDate: t.responseDueAt });
    await recordSlaEvent(t, 'breached', 'first_response', { completedAt: now, actual: new Date(t.responseDueAt).getTime() - new Date(t.slaStartedAt || t.createdAt).getTime(), unit: 'milliseconds' });
    if (t.agent) {
      await notifyAgent({
        agentId: t.agent,
        type: 'overdue',
        message: `Response SLA breached for ticket #${t.number}`,
        link: `/agent/tickets/${t.number}`,
        ticket: t._id,
        company: t.company,
      }).catch(() => {});
      const assigned = await require('../models/Agent').findById(t.agent).select('email name').lean();
      if (assigned?.email) {
        await sendFromTemplate({
          key: 'sla_response_breach',
          to: assigned.email,
          data: { recipient: { name: assigned.name || '' }, ticketNumber: t.number, dueDate: t.responseDueAt },
          event: 'sla_response_breach',
          ticket: t._id,
          company: t.company,
        }).catch(() => {});
      }
    }
  }
  return { modified: open.length };
};

const scheduleOverdueCheck = () => {
  const config = require('../config/config');
  const minutes = config.sla.overdueIntervalMinutes || 5;
  setInterval(async () => {
    try {
      await markOverdueTickets();
      await checkAtRiskTickets();
      await markResponseBreaches();
      await executeEscalationRules();
    } catch (err) {
      // ignore
    }
  }, minutes * 60 * 1000);
};

/**
 * Per-plan calendar check (MD ITSM-09): is `date` inside this SLA plan's
 * business hours? Pure function — no DB. Plans with schedule '24/7' (or no
 * businessHours) always return true; otherwise the plan's days/start/end
 * are evaluated in the plan's timezone via Intl.
 */
const toMinutes = (hhmm) => {
  const [h = 0, m = 0] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

const partsInTz = (date, timezone) => {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    return { dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  } catch (_) {
    return { dow: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() };
  }
};

const calendarPartsInTz = (date, timezone) => {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
  } catch (_) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
};

const isHolidayInTimezone = (date, timezone, holidays = []) => {
  const local = calendarPartsInTz(date, timezone);
  return holidays.some((holiday) => holiday.month === local.month
    && holiday.day === local.day
    && (holiday.recurring || holiday.year === local.year));
};

const isWithinPlanHours = (date, plan) => {
  if (!plan || plan.schedule === '24/7' || !plan.businessHours) return true;
  const tz = plan.timezone || 'UTC';
  const { dow, minutes } = partsInTz(date instanceof Date ? date : new Date(date), tz);
  const days = plan.businessHours.days || [];
  if (!days.includes(dow)) return false;
  return minutes >= toMinutes(plan.businessHours.start) && minutes < toMinutes(plan.businessHours.end);
};

module.exports = {
  computeDueDate,
  startClocks,
  pauseSla,
  resumeSla,
  predictBreachRisk,
  markOverdueTickets,
  markResponseBreaches,
  checkAtRiskTickets,
  executeEscalationRules,
  scheduleOverdueCheck,
  getSlaHours,
  isWorkingMoment,
  isWithinPlanHours,
  dueInHours,
  SLA_TYPES,
  recordSlaEvent,
};
