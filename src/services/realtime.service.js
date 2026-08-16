const Ticket = require('../models/Ticket');
const Agent = require('../models/Agent');
const { getIO } = require('../config/socket');

let lastSnapshot = null;
let lastComputedAt = 0;

/**
 * Compute real-time operational dashboard aggregates.
 * Live values: open/critical/SLA at risk/breached/waiting, agents online/busy/available,
 * avg response/resolution, CSAT.
 */
async function computeSnapshot({ company, force = false }) {
  const now = Date.now();
  if (!force && lastSnapshot && now - lastComputedAt < 10000) return lastSnapshot;

  const comp = company ? { company } : {};
  const agents = await Agent.find({ isActive: true, ...comp }).lean();
  const presenceCounts = { online: 0, busy: 0, away: 0, offline: 0, on_break: 0, in_meeting: 0, dnd: 0 };
  for (const a of agents) presenceCounts[a.presence] = (presenceCounts[a.presence] || 0) + 1;

  const [open, critical, atRisk, breached, waiting, avgFirst, avgResolve, csatStats] = await Promise.all([
    Ticket.countDocuments({ status: { $in: ['open', 'assigned'] }, ...comp }),
    Ticket.countDocuments({ priority: 'Emergency', status: { $in: ['open', 'assigned', 'overdue'] }, ...comp }),
    Ticket.countDocuments({ status: 'assigned', dueDate: { $gte: new Date(), $lte: new Date(now + 2 * 3600000) }, ...comp }),
    Ticket.countDocuments({ status: 'overdue', ...comp }),
    Ticket.countDocuments({ waitingOn: 'customer', status: { $in: ['open', 'assigned'] }, ...comp }),
    (async () => {
      const t = await Ticket.findOne({ 'stats.firstResponseAt': { $ne: null }, ...comp }).sort({ 'stats.firstResponseAt': -1 }).lean();
      return t ? null : null;
    })(),
    (async () => {
      const closed = await Ticket.find({ status: 'closed', closedAt: { $ne: null }, ...comp }).sort({ closedAt: -1 }).limit(100).lean();
      if (!closed.length) return null;
      const diffs = closed.map((t) => (new Date(t.closedAt) - new Date(t.createdAt)) / 3600000);
      return Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100;
    })(),
    (async () => {
      const SurveyResponse = require('../models/SurveyResponse');
      const Survey = require('../models/Survey');
      const surveys = await Survey.find({ ...comp, type: 'csat' }).lean();
      const ids = surveys.map((s) => s._id);
      if (!ids.length) return null;
      const rs = await SurveyResponse.find({ survey: { $in: ids } }).sort({ respondedAt: -1 }).limit(200).lean();
      if (!rs.length) return null;
      const avg = rs.reduce((a, r) => a + r.rating, 0) / rs.length;
      return Math.round(avg * 100) / 100;
    })(),
  ]);

  const avgResponseMin = await (async () => {
    const TicketThread = require('../models/TicketThread');
    const threads = await TicketThread.find({ type: 'message', posterType: 'agent', createdAt: { $gte: new Date(now - 7 * 86400000) }, ...comp })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    if (!threads.length) return null;
    const tickets = await Ticket.find({ _id: { $in: threads.map((t) => t.ticket) }, ...comp }).lean();
    const map = {};
    for (const t of tickets) map[String(t._id)] = new Date(t.createdAt).getTime();
    const diffs = threads
      .map((th) => {
        const c = map[String(th.ticket)];
        return c ? (new Date(th.createdAt).getTime() - c) / 60000 : null;
      })
      .filter((d) => d !== null && d >= 0 && d < 1440);
    return diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length)) : null;
  })();

  lastSnapshot = {
    computedAt: new Date().toISOString(),
    tickets: {
      open,
      critical,
      atRisk,
      breached,
      waitingCustomer: waiting,
    },
    agents: {
      online: presenceCounts.online,
      busy: presenceCounts.busy,
      available: presenceCounts.online + presenceCounts.busy,
      away: presenceCounts.away,
      offline: presenceCounts.offline,
      total: agents.length,
    },
    performance: {
      avgResponseMin,
      avgResolutionHours: avgResolve,
      csat: csatStats,
    },
  };
  lastComputedAt = now;
  return lastSnapshot;
}

/**
 * Broadcast the live snapshot to the admin room on a throttle.
 */
async function broadcastSnapshot({ company }) {
  try {
    const snap = await computeSnapshot({ company, force: true });
    const io = getIO();
    if (io) io.to('admin:room').emit('live:dashboard', snap);
    return snap;
  } catch (err) {
    return null;
  }
}

module.exports = { computeSnapshot, broadcastSnapshot };