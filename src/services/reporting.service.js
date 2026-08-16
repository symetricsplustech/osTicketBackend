const Ticket = require('../models/Ticket');
const Agent = require('../models/Agent');
const User = require('../models/User');
const Department = require('../models/Department');
const Team = require('../models/Team');

const sinceDays = (days) => new Date(Date.now() - days * 86400000);

const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0);

/**
 * Agent metrics: first response time, avg response time, avg resolution time,
 * tickets resolved, reopen rate, SLA compliance, CSAT, handling time, utilization, backlog.
 */
async function agentMetrics({ company, fromDays = 30 }) {
  const from = sinceDays(fromDays);
  const agents = await Agent.find({ company, isActive: true }).lean();
  const tickets = await Ticket.find({
    company,
    agent: { $in: agents.map((a) => a._id) },
    createdAt: { $gte: from },
  }).populate('user', 'name');

  const byAgent = {};
  for (const t of tickets) {
    const id = String(t.agent);
    const m = (byAgent[id] = byAgent[id] || {
      agentId: id,
      resolved: 0,
      firstResponseTimes: [],
      responseTimes: [],
      resolutionTimes: [],
      reopened: 0,
      closed: 0,
      slaCompliant: 0,
      slaTotal: 0,
      assigned: 0,
    });
    m.assigned += 1;
    const first = t.stats?.firstResponseAt ? new Date(t.stats.firstResponseAt) - new Date(t.createdAt) : null;
    if (first) m.firstResponseTimes.push(first / 60000);
    if (t.stats?.responses) m.responseTimes.push(t.stats.responses);
    if (t.closedAt && t.createdAt) m.resolutionTimes.push((new Date(t.closedAt) - new Date(t.createdAt)) / 3600000);
    if (t.stats?.reopened) m.reopened += t.stats.reopened;
    if (['closed', 'archived'].includes(t.status)) {
      m.resolved += 1;
      m.closed += 1;
    }
    if (t.dueDate) {
      m.slaTotal += 1;
      if (new Date(t.dueDate) >= t.closedAt || !t.isOverdue) m.slaCompliant += 1;
    }
  }

  const SurveyResponse = require('../models/SurveyResponse');
  const responses = await SurveyResponse.find({ company, agent: { $in: agents.map((a) => a._id) }, respondedAt: { $gte: from } });
  const csatByAgent = {};
  for (const r of responses) {
    const id = String(r.agent);
    csatByAgent[id] = csatByAgent[id] || { total: 0, count: 0 };
    csatByAgent[id].total += r.rating;
    csatByAgent[id].count += 1;
  }

  const AgentAvailability = null; // presence derived live
  const presence = {};
  for (const a of agents) presence[String(a._id)] = a.presence;

  return {
    from: from.toISOString(),
    agents: agents.map((a) => {
      const m = byAgent[String(a._id)] || {};
      const csat = csatByAgent[String(a._id)];
      const resolved = m.resolved || 0;
      return {
        agentId: a._id,
        name: a.name,
        email: a.email,
        presence: presence[String(a._id)],
        capacity: a.capacity || 10,
        assigned: m.assigned || 0,
        resolved,
        backlog: (m.assigned || 0) - resolved,
        avgFirstResponseMin: avg(m.firstResponseTimes || []),
        avgResolutionHours: avg(m.resolutionTimes || []),
        reopenRate: m.closed ? Math.round((m.reopened / m.closed) * 100) : 0,
        slaCompliance: m.slaTotal ? Math.round((m.slaCompliant / m.slaTotal) * 100) : null,
        csat: csat && csat.count ? Math.round((csat.total / csat.count) * 100) / 100 : null,
        utilization: (m.assigned || 0) / Math.max(a.capacity || 10, 1),
      };
    }),
  };
}

/**
 * Department metrics: incoming, resolved, backlog, SLA breaches, escalations, capacity.
 */
async function departmentMetrics({ company, fromDays = 30 }) {
  const from = sinceDays(fromDays);
  const depts = await Department.find({ company, status: 'active' }).lean();
  const tickets = await Ticket.find({ company, dept: { $in: depts.map((d) => d._id) }, createdAt: { $gte: from } });

  const byDept = {};
  for (const t of tickets) {
    const id = String(t.dept);
    const m = (byDept[id] = byDept[id] || { deptId: id, incoming: 0, resolved: 0, slaBreaches: 0, escalations: 0, avgResolutionHours: [], avgResponseMin: [] });
    m.incoming += 1;
    if (['closed', 'archived'].includes(t.status)) m.resolved += 1;
    if (t.isOverdue) m.slaBreaches += 1;
    if (t.escalatedBy?.length) m.escalations += 1;
    if (t.closedAt && t.createdAt) m.avgResolutionHours.push((new Date(t.closedAt) - new Date(t.createdAt)) / 3600000);
    const first = t.stats?.firstResponseAt ? new Date(t.stats.firstResponseAt) - new Date(t.createdAt) : null;
    if (first) m.avgResponseMin.push(first / 60000);
  }

  return {
    from: from.toISOString(),
    departments: depts.map((d) => {
      const m = byDept[String(d._id)] || {};
      return {
        deptId: d._id,
        name: d.name,
        incoming: m.incoming || 0,
        resolved: m.resolved || 0,
        backlog: (m.incoming || 0) - (m.resolved || 0),
        slaBreaches: m.slaBreaches || 0,
        escalations: m.escalations || 0,
        avgResolutionHours: avg(m.avgResolutionHours || []),
        avgResponseMin: avg(m.avgResponseMin || []),
      };
    }),
  };
}

/**
 * Customer metrics: ticket volume, SLA, CSAT, NPS, escalations, churn risk.
 */
async function customerMetrics({ company, fromDays = 30, limit = 25 }) {
  const from = sinceDays(fromDays);
  const users = await User.find({ company, isRegistered: true }).sort({ createdAt: -1 }).limit(500).lean();
  const tickets = await Ticket.find({ company, createdAt: { $gte: from }, user: { $in: users.map((u) => u._id) } });

  const SurveyResponse = require('../models/SurveyResponse');
  const responses = await SurveyResponse.find({ company, user: { $in: users.map((u) => u._id) }, respondedAt: { $gte: from } }).populate('survey', 'type').lean();

  const byUser = {};
  for (const t of tickets) {
    const id = String(t.user);
    const m = (byUser[id] = byUser[id] || { userId: id, tickets: 0, open: 0, overdue: 0, slaBreaches: 0, escalations: 0, csatTotal: 0, csatCount: 0, npsTotal: 0, npsCount: 0 });
    m.tickets += 1;
    if (['open', 'assigned'].includes(t.status)) m.open += 1;
    if (t.isOverdue) { m.overdue += 1; m.slaBreaches += 1; }
    if (t.escalatedBy?.length) m.escalations += 1;
  }
  for (const r of responses) {
    const id = String(r.user);
    const m = (byUser[id] = byUser[id] || { userId: id, tickets: 0, open: 0, overdue: 0, slaBreaches: 0, escalations: 0, csatTotal: 0, csatCount: 0, npsTotal: 0, npsCount: 0 });
    if (r.survey?.type === 'csat') { m.csatTotal += r.rating; m.csatCount += 1; }
    if (r.survey?.type === 'nps') { m.npsTotal += r.rating; m.npsCount += 1; }
  }

  return {
    from: from.toISOString(),
    customers: users
      .map((u) => {
        const m = byUser[String(u._id)] || {};
        return {
          userId: u._id,
          name: u.name,
          email: u.email,
          tier: u.tier,
          organization: u.organization,
          tickets: m.tickets || 0,
          open: m.open || 0,
          overdue: m.overdue || 0,
          slaBreaches: m.slaBreaches || 0,
          escalations: m.escalations || 0,
          csat: m.csatCount ? Math.round((m.csatTotal / m.csatCount) * 100) / 100 : null,
          nps: m.npsCount ? Math.round((m.npsTotal / m.npsCount) * 100) / 100 : null,
          health: u.health?.score ?? null,
        };
      })
      .filter((c) => c.tickets > 0 || c.csat !== null || c.nps !== null)
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, limit),
  };
}

/**
 * Time-series ticket volume for charts.
 */
async function volumeTrend({ company, days = 30 }) {
  const from = sinceDays(days);
  const tickets = await Ticket.find({ company, createdAt: { $gte: from } }).lean();
  const map = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    map[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), created: 0, resolved: 0 };
  }
  for (const t of tickets) {
    const key = new Date(t.createdAt).toISOString().slice(0, 10);
    if (map[key]) map[key].created += 1;
    if (t.closedAt) {
      const k2 = new Date(t.closedAt).toISOString().slice(0, 10);
      if (map[k2]) map[k2].resolved += 1;
    }
  }
  return Object.values(map);
}

module.exports = { agentMetrics, departmentMetrics, customerMetrics, volumeTrend };