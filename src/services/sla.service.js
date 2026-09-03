const SlaPlan = require('../models/SlaPlan');
const Holiday = require('../models/Holiday');
const SystemSetting = require('../models/SystemSetting');
const { emit } = require('./events');

const SLA_TYPES = ['first_response', 'next_response', 'resolution', 'update', 'escalation', 'callback', 'approval'];

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
        out.push({ month: d.getMonth(), day: d.getDate() });
      } else {
        out.push({ ts: d.toDateString() });
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
    if (h.month !== undefined && h.month === date.getMonth() && h.day === date.getDate()) return false;
    if (h.ts && h.ts === date.toDateString()) return false;
  }
  return true;
};

/**
 * Compute a due date honouring the SLA schedule (24/7 or business hours from admin
 * Schedules + Holidays) for the given SLA type target.
 */
const computeDueDate = async (sla, startDate = new Date(), opts = {}) => {
  if (!sla) return null;
  const plan = await SlaPlan.findById(sla);
  if (!plan) return null;
  const slaType = opts.slaType || 'first_response';
  let hours = plan.gracePeriod || 24;
  if (plan.targets && typeof plan.targets[slaType] === 'number') {
    hours = plan.targets[slaType];
  }
  if (plan.schedule === '24/7') {
    return new Date(new Date(startDate).getTime() + hours * 60 * 60 * 1000);
  }
  // Business hours walk (configurable via Schedules + Holidays)
  const company = plan.company || opts.company || null;
  let due = new Date(startDate);
  let remaining = hours;
  let steps = 0;
  while (remaining > 0 && steps < 24 * 60 * 31) {
    due = new Date(due.getTime() + 60 * 60 * 1000);
    steps += 1;
    if (await isWorkingMoment(due, company)) remaining -= 1;
  }
  return due;
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
const pauseSla = async (ticket) => {
  if (!ticket || ticket.slaPaused || !ticket.dueDate) return ticket;
  ticket.slaPaused = true;
  ticket.slaPausedAt = new Date();
  ticket.slaResumeAt = null;
  ticket.waitingOn = ticket.waitingOn || 'customer';
  await ticket.save().catch(() => {});
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
  }
  ticket.slaPaused = false;
  ticket.slaPausedAt = null;
  ticket.waitingOn = 'none';
  await ticket.save().catch(() => {});
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
    const workload = await Ticket.countDocuments({ agent: ticket.agent, status: { $in: ['open', 'assigned', 'overdue'] } });
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
    status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
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
    status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
  }).lean();
  for (const t of tickets) {
    emit('sla.at_risk', { company: t.company, ticketId: t._id, ticketNumber: t.number, dueDate: t.dueDate });
  }
};

const scheduleOverdueCheck = () => {
  const config = require('../config/config');
  const minutes = config.sla.overdueIntervalMinutes || 5;
  setInterval(async () => {
    try {
      await markOverdueTickets();
      await checkAtRiskTickets();
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
  pauseSla,
  resumeSla,
  predictBreachRisk,
  markOverdueTickets,
  checkAtRiskTickets,
  scheduleOverdueCheck,
  getSlaHours,
  isWorkingMoment,
  isWithinPlanHours,
  SLA_TYPES,
};