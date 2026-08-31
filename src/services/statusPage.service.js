const StatusPage = require('../models/StatusPage');
const StatusIncident = require('../models/StatusIncident');
const Incident = require('../models/Incident');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { notifyUser, notifyAgent } = require('./notification.service');
const { sendFromTemplate } = require('./email.service');
const { emit } = require('./events');
const { getIO } = require('../config/socket');

const OVERALL = (components) => {
  if (components.some((c) => c.status === 'major_outage')) return 'major_outage';
  if (components.some((c) => c.status === 'partial_outage')) return 'partial_outage';
  if (components.some((c) => c.status === 'degraded')) return 'degraded';
  return 'operational';
};

/**
 * Public status page payload (no auth).
 */
async function publicStatus(slug) {
  const page = await StatusPage.findOne({ slug: slug.toLowerCase(), isPublic: true }).lean();
  if (!page) return null;
  const incidents = await StatusIncident.find({ company: page.company, statusPage: page._id })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean();
  const active = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'maintenance');
  const resolved = incidents.filter((i) => i.status === 'resolved' || i.status === 'maintenance');
  return {
    page: {
      ...page,
      overall: OVERALL(page.components || []),
    },
    incidents: { active, resolved },
  };
}

async function updateComponent(pageId, componentId, status) {
  const page = await StatusPage.findById(pageId);
  if (!page) throw new Error('Status page not found');
  const comp = page.components.id(componentId);
  if (!comp) throw new Error('Component not found');
  comp.status = status;
  comp.updatedAt = new Date();
  await page.save();
  const io = getIO();
  if (io) io.to(`status:${page.slug}`).emit('status:update', await publicStatus(page.slug));
  return page;
}

/**
 * Create a status incident. Optionally notify all users of affected orgs and
 * link existing tickets (proactive support).
 */
async function createStatusIncident({ company, statusPageId, title, body, severity = 'major', componentsAffected = [], notifyCustomers = false, createLinkedIncident = false }) {
  const incident = await StatusIncident.create({
    company,
    statusPage: statusPageId,
    title,
    body,
    status: 'investigating',
    severity,
    componentsAffected,
    updates: [{ status: 'investigating', message: body }],
  });

  const page = await StatusPage.findById(statusPageId);
  for (const name of componentsAffected) {
    const comp = page?.components?.find((c) => c.name === name);
    if (comp) {
      comp.status = severity === 'minor' ? 'degraded' : severity === 'maintenance' ? 'maintenance' : 'partial_outage';
      comp.updatedAt = new Date();
    }
  }
  if (page) await page.save();

  if (createLinkedIncident) {
    const count = await Incident.countDocuments({ company });
    const inc = await Incident.create({
      number: `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      company,
      title,
      summary: body,
      severity: severity === 'critical' ? 'Sev1' : severity === 'major' ? 'Sev2' : 'Sev3',
      status: 'investigating',
      startedAt: new Date(),
      affectedServices: componentsAffected,
    });
    await StatusIncident.updateOne({ _id: incident._id }, { $set: { linkedIncident: inc._id } });
    emit('incident.created', { company, incidentId: inc._id, number: inc.number });
  }

  if (notifyCustomers) {
    const orgs = await Organization.find({ company }).distinct('_id');
    const users = await User.find({ company, organization: { $in: orgs } }).limit(500).lean();
    for (const u of users) {
      await notifyUser({ userId: u._id, type: 'system', message: `Service incident: ${title}`, link: `/status`, ticket: null, company });
    }
  }

  emit('status.incident', { company, statusIncidentId: incident._id, title, severity });
  const io = getIO();
  if (io && page) io.to(`status:${page.slug}`).emit('status:update', await publicStatus(page.slug));
  return incident;
}

async function updateStatusIncident(id, { status, message }) {
  const incident = await StatusIncident.findById(id);
  if (!incident) throw new Error('Status incident not found');
  incident.status = status;
  if (message) incident.updates.push({ status, message });
  if (status === 'resolved') incident.resolvedAt = new Date();
  await incident.save();
  const io = getIO();
  if (io && incident.statusPage) {
    const page = await StatusPage.findById(incident.statusPage);
    if (page) io.to(`status:${page.slug}`).emit('status:update', await publicStatus(page.slug));
  }
  if (status === 'resolved') emit('incident.resolved', { company: incident.company, statusIncidentId: incident._id });
  return incident;
}

/**
 * Proactive support: detect tickets sharing a root cause and surface them
 * for incident creation (grouped by intent + subject keyword).
 */
async function detectOutageSignals({ company, minTickets = 5, windowMinutes = 60 }) {
  const since = new Date(Date.now() - windowMinutes * 60000);
  const tickets = await Ticket.find({
    company,
    createdAt: { $gte: since },
    status: { $nin: ['closed', 'archived', 'deleted'] },
  }).lean();
  const groups = {};
  for (const t of tickets) {
    const key = (t.intent || 'general');
    groups[key] = groups[key] || [];
    groups[key].push(t);
  }
  const signals = [];
  for (const [intent, list] of Object.entries(groups)) {
    if (list.length >= minTickets) {
      const subjects = list.slice(0, 8).map((t) => t.subject);
      const keyword = commonKeyword(subjects);
      const matched = list.filter((t) => !keyword || t.subject.toLowerCase().includes(keyword.toLowerCase()));
      if (matched.length >= minTickets) {
        signals.push({ intent, keyword, count: matched.length, tickets: matched.slice(0, 20).map((t) => ({ id: t._id, number: t.number, subject: t.subject })), detectedAt: new Date() });
      }
    }
  }
  return signals;
}

const commonKeyword = (subjects) => {
  const freq = {};
  for (const s of subjects) {
    for (const w of s.toLowerCase().split(/\W+/)) {
      if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
    }
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= Math.max(2, Math.ceil(subjects.length / 2)) ? top[0] : '';
};

module.exports = { publicStatus, updateComponent, createStatusIncident, updateStatusIncident, detectOutageSignals, OVERALL };
