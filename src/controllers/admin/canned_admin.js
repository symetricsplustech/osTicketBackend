const Agent = require('../../models/Agent');
const Team = require('../../models/Team');
const Role = require('../../models/Role');
const Department = require('../../models/Department');
const HelpTopic = require('../../models/HelpTopic');
const SlaPlan = require('../../models/SlaPlan');
const TicketFilter = require('../../models/TicketFilter');
const EmailTemplate = require('../../models/EmailTemplate');
const SystemSetting = require('../../models/SystemSetting');
const Ticket = require('../../models/Ticket');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const CannedResponse = require('../../models/CannedResponse');
const FaqCategory = require('../../models/FaqCategory');
const Faq = require('../../models/Faq');
const Announcement = require('../../models/Announcement');
const EmailLog = require('../../models/EmailLog');
const Notification = require('../../models/Notification');
const Company = require('../../models/Company');
const TicketStatus = require('../../models/TicketStatus');
const CustomField = require('../../models/CustomField');
const TicketForm = require('../../models/TicketForm');
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






exports.listCanned = asyncHandler(async (req, res) => {
  const items = await CannedResponse.find(req.companyId ? { company: req.companyId } : {}).sort({ title: 1 });
  res.json({ success: true, items });
});
exports.updateCanned = asyncHandler(async (req, res) => {
  const canned = await CannedResponse.findById(req.params.id);
  if (!canned) throw new ApiError(404, 'Canned response not found');
  if (req.companyId && String(canned.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { title, response, status } = req.body;
  if (title) canned.title = title;
  if (response !== undefined) canned.response = response;
  if (status !== undefined) canned.status = status;
  await canned.save();
  res.json({ success: true, canned });
});
exports.deleteCanned = asyncHandler(async (req, res) => {
  await CannedResponse.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Canned response deleted' });
});
