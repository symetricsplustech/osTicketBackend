const Agent = require('../../models/Agent');
const Team = require('../../models/Team');
const Role = require('../../models/Role');
const Department = require('../../models/Department');
const HelpTopic = require('../../models/HelpTopic');
const SlaPlan = require('../../models/SlaPlan');
const TicketFilter = require('../../models/helpdesk/tickets/TicketFilter');
const EmailTemplate = require('../../models/EmailTemplate');
const SystemSetting = require('../../models/SystemSetting');
const Ticket = require('../../models/helpdesk/tickets/Ticket');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const CannedResponse = require('../../models/helpdesk/knowledge/CannedResponse');
const FaqCategory = require('../../models/helpdesk/knowledge/FaqCategory');
const Faq = require('../../models/helpdesk/knowledge/Faq');
const Announcement = require('../../models/helpdesk/knowledge/Announcement');
const EmailLog = require('../../models/EmailLog');
const Notification = require('../../models/Notification');
const Company = require('../../models/Company');
const TicketStatus = require('../../models/helpdesk/tickets/TicketStatus');
const CustomField = require('../../models/CustomField');
const TicketForm = require('../../models/helpdesk/tickets/TicketForm');
const Holiday = require('../../models/Holiday');
const Integration = require('../../models/Integration');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPagination, getSortObj } = require('../../utils/pagination');
const { computeDueDate } = require('../../services/sla.service');
const { uploadsDir } = require('../../config/multer');
const { audit } = require('../../services/audit.service');

const auditRoleChange = (req, action, role, before = null) => audit({
  company: req.companyId,
  actorType: 'agent',
  actor: req.agent?._id,
  actorName: req.agent?.name || '',
  action,
  entityType: 'role',
  entityId: role?._id || null,
  before,
  after: role?.toObject ? role.toObject() : role,
  source: 'admin.roles',
  req,
});







// ------------------------- Agents -------------------------

















// ------------------------- Teams -------------------------









// ------------------------- Departments -------------------------









// ------------------------- Help Topics -------------------------









// ------------------------- SLA Plans -------------------------









// ------------------------- Ticket Filters -------------------------









// ------------------------- Email Templates -------------------------

const validateTemplatePayload = (body, { partial = false } = {}) => {
  const errors = [];
  const data = {};
  const requiredFields = [
    { field: 'name', message: 'Name is required' },
    { field: 'subject', message: 'Subject is required' },
    { field: 'body', message: 'Body is required' },
  ];
  for (const { field, message } of requiredFields) {
    if (partial && body[field] === undefined) continue;
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      errors.push(message);
    } else {
      data[field] = body[field].trim();
    }
  }
  if (body.trigger !== undefined) {
    if (!EmailTemplate.TRIGGERS.some((t) => t.value === body.trigger)) errors.push('Trigger is invalid');
    else data.trigger = body.trigger;
  }
  if (body.recipient !== undefined) {
    if (!EmailTemplate.RECIPIENTS.some((r) => r.value === body.recipient)) errors.push('Recipient is invalid');
    else data.recipient = body.recipient;
  }
  if (body.description !== undefined) data.description = String(body.description ?? '').trim();
  if (body.context !== undefined) data.context = String(body.context ?? 'ticket').trim();
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (errors.length) throw new ApiError(422, errors.join(', '));
  return data;
};











// ------------------------- Settings -------------------------











// ------------------------- Users (admin) -------------------------









// ------------------------- Organizations (admin) -------------------------









// ------------------------- Canned (admin) -------------------------







// ------------------------- FAQ management -------------------------











// ------------------------- Announcements -------------------------







// ------------------------- Recompute due dates -------------------------



// ------------------------- Notifications -------------------------











// ------------------------- Generic CRUD -------------------------

const scopeQuery = (req) => {
  const base = {};
  if (req.companyId) base.$or = [{ company: req.companyId }, { company: null }];
  return base;
};

const companyOwned = (req, item) => {
  if (req.companyId && item.company && String(item.company) !== String(req.companyId)) {
    throw new ApiError(403, 'Access denied');
  }
};

const makeCrud = (Model, { listPopulate = '', preSave = null } = {}) => ({
  list: asyncHandler(async (req, res) => {
    const query = scopeQuery(req);
    let items = await Model.find(query);
    if (listPopulate) items = await Model.populate(items, listPopulate);
    res.json({ success: true, items });
  }),
  create: asyncHandler(async (req, res) => {
    const body = { ...req.body, company: req.companyId || null };
    if (preSave) preSave(body, req);
    const item = await Model.create(body);
    res.status(201).json({ success: true, item });
  }),
  update: asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    companyOwned(req, item);
    const body = { ...req.body };
    delete body._id;
    delete body.company;
    if (preSave) preSave(body, req);
    Object.assign(item, body);
    await item.save();
    res.json({ success: true, item });
  }),
  remove: asyncHandler(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    companyOwned(req, item);
    await Model.deleteOne({ _id: item._id });
    res.json({ success: true, message: 'Deleted' });
  }),
});

// ------------------------- Ticket Statuses -------------------------



// ------------------------- Custom Fields -------------------------

const normalizeCustomField = (body) => {
  if (typeof body.options === 'string') {
    body.options = body.options.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (body.helpTopic === '') body.helpTopic = null;
  if (Array.isArray(body.conditions)) {
    body.conditions = body.conditions
      .filter((c) => c && c.field && c.value !== undefined && c.value !== '')
      .map((c) => ({ field: c.field, operator: c.operator || 'equals', value: String(c.value) }));
  }
};



// ------------------------- Ticket Forms -------------------------



// ------------------------- Holidays -------------------------



// ------------------------- CSV Import / Export -------------------------

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur); cur = '';
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  }
  return rows;
};

const csvDownload = (res, filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.send(csv);
};













// ------------------------- Priorities -------------------------









// ------------------------- Integrations / Plugins -------------------------

const INTEGRATION_CATALOG = [
  { key: 'slack', name: 'Slack', category: 'chat', icon: '💬', description: 'Send ticket alerts and updates to Slack channels.' },
  { key: 'microsoft-teams', name: 'Microsoft Teams', category: 'chat', icon: '🧩', description: 'Post ticket notifications to Microsoft Teams channels.' },
  { key: 'whatsapp', name: 'WhatsApp', category: 'messaging', icon: '📱', description: 'Receive and respond to tickets via WhatsApp Business.' },
  { key: 'telegram', name: 'Telegram', category: 'messaging', icon: '✈️', description: 'Get ticket alerts and reply from Telegram.' },
  { key: 'twilio', name: 'Twilio Voice', category: 'phone', icon: '📞', description: 'Open tickets from phone calls and SMS via Twilio.' },
  { key: 'google-auth', name: 'Google Sign-In', category: 'authentication', icon: '🔐', description: 'Allow customers to sign in with their Google account.' },
  { key: 'zapier', name: 'Zapier', category: 'automation', icon: '⚡', description: 'Connect osTicket to 5000+ apps via Zapier.' },
  { key: 'webhooks', name: 'Webhooks', category: 'automation', icon: '🔗', description: 'Push ticket events to your own endpoints via webhooks.' },
];






exports.listSlaPlans = asyncHandler(async (req, res) => {
  const plans = await SlaPlan.find(req.companyId ? { company: req.companyId } : {}).sort({ name: 1 });
  res.json({ success: true, items: plans, plans });
});
exports.createSlaPlan = asyncHandler(async (req, res) => {
  const { name, gracePeriod, schedule, status, notes, targets, responseMinutes, resolutionMinutes, timezone, businessHours, pauseRules, escalationRules, notifyOnBreach, notifyOnAtRisk, breachEscalate } = req.body;
  if (!name) throw new ApiError(422, 'SLA name is required');
  const plan = await SlaPlan.create({
    name,
    company: req.companyId,
    gracePeriod: parseInt(gracePeriod, 10) || 24,
    schedule: schedule || '24/7',
    status: status || 'active',
    notes: notes || '',
    targets: { ...(targets || {}), ...(responseMinutes !== undefined ? { first_response: Number(responseMinutes) / 60 } : {}), ...(resolutionMinutes !== undefined ? { resolution: Number(resolutionMinutes) / 60 } : {}) },
    timezone: timezone || 'UTC',
    businessHours: businessHours || undefined,
    pauseRules: pauseRules || undefined,
    escalationRules: escalationRules || [],
    notifyOnBreach: notifyOnBreach !== false,
    notifyOnAtRisk: !!notifyOnAtRisk,
    breachEscalate: !!breachEscalate,
  });
  res.status(201).json({ success: true, plan });
});
exports.updateSlaPlan = asyncHandler(async (req, res) => {
  const plan = await SlaPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'SLA plan not found');
  if (req.companyId && String(plan.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, gracePeriod, schedule, status, notes, targets, responseMinutes, resolutionMinutes, timezone, businessHours, pauseRules, escalationRules, notifyOnBreach, notifyOnAtRisk, breachEscalate } = req.body;
  if (name) plan.name = name;
  if (gracePeriod !== undefined) plan.gracePeriod = parseInt(gracePeriod, 10);
  if (schedule !== undefined) plan.schedule = schedule;
  if (status !== undefined) plan.status = status;
  if (notes !== undefined) plan.notes = notes;
  if (targets !== undefined) plan.targets = { ...plan.targets?.toObject?.(), ...targets };
  if (responseMinutes !== undefined) plan.targets.first_response = Number(responseMinutes) / 60;
  if (resolutionMinutes !== undefined) plan.targets.resolution = Number(resolutionMinutes) / 60;
  if (timezone !== undefined) plan.timezone = timezone;
  if (businessHours !== undefined) plan.businessHours = businessHours;
  if (pauseRules !== undefined) plan.pauseRules = pauseRules;
  if (escalationRules !== undefined) plan.escalationRules = escalationRules;
  if (notifyOnBreach !== undefined) plan.notifyOnBreach = !!notifyOnBreach;
  if (notifyOnAtRisk !== undefined) plan.notifyOnAtRisk = !!notifyOnAtRisk;
  if (breachEscalate !== undefined) plan.breachEscalate = !!breachEscalate;
  await plan.save();
  res.json({ success: true, plan });
});
exports.deleteSlaPlan = asyncHandler(async (req, res) => {
  await SlaPlan.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'SLA plan deleted' });
});

exports.slaDashboard = asyncHandler(async (req, res) => {
  const SlaEvent = require('../../models/SlaEvent');
  const Ticket = require('../../models/helpdesk/tickets/Ticket');
  const since = new Date(Date.now() - Math.min(Number(req.query.days) || 30, 365) * 86400000);
  const [events, openTickets, atRisk, breached, departments] = await Promise.all([
    SlaEvent.find({ level: 'tenant', company: req.companyId, occurredAt: { $gte: since }, event: { $in: ['met', 'breached'] } }).lean(),
    Ticket.countDocuments({ company: req.companyId, status: { $nin: ['resolved', 'closed', 'archived', 'deleted'] } }),
    Ticket.countDocuments({ company: req.companyId, isOverdue: false, dueDate: { $gt: new Date(), $lte: new Date(Date.now() + 2 * 3600000) } }),
    Ticket.countDocuments({ company: req.companyId, $or: [{ isOverdue: true }, { responseBreached: true }] }),
    Ticket.aggregate([{ $match: { company: req.companyId } }, { $group: { _id: '$dept', total: { $sum: 1 }, breached: { $sum: { $cond: [{ $or: [{ $eq: ['$isOverdue', true] }, { $eq: ['$responseBreached', true] }] }, 1, 0] } } } }]),
  ]);
  const summarize = (clock) => {
    const selected = events.filter((event) => event.clock === clock);
    const met = selected.filter((event) => event.event === 'met').length;
    return { measured: selected.length, met, breached: selected.length - met, compliance: selected.length ? (met / selected.length) * 100 : 100 };
  };
  res.json({ success: true, data: { openTickets, withinSla: Math.max(0, openTickets - breached), atRisk, breached, response: summarize('first_response'), resolution: summarize('resolution'), departments } });
});

exports.ticketSlaHistory = asyncHandler(async (req, res) => {
  const Ticket = require('../../models/helpdesk/tickets/Ticket');
  const SlaEvent = require('../../models/SlaEvent');
  const ticket = await Ticket.findOne({ number: req.params.number, company: req.companyId }).select('_id number sla responseDueAt resolutionDueAt').populate('sla', 'name');
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const events = await SlaEvent.find({ level: 'tenant', company: req.companyId, ticket: ticket._id }).sort({ occurredAt: 1 }).lean();
  res.json({ success: true, data: { ticket, events } });
});
