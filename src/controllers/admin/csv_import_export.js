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






exports.exportUsers = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const users = await User.find(comp).populate('organization', 'name').sort({ name: 1 }).lean();
  csvDownload(res, `users-${new Date().toISOString().slice(0, 10)}`, ['name', 'email', 'phone', 'organization', 'status', 'isRegistered', 'lastLogin'],
    users.map((u) => [u.name, u.email, u.phone, u.organization?.name || '', u.status, u.isRegistered ? 'yes' : 'no', u.lastLogin ? new Date(u.lastLogin).toISOString() : '']));
});
exports.exportOrgs = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const orgs = await Organization.find(comp).populate('accountManager', 'name').sort({ name: 1 }).lean();
  csvDownload(res, `orgs-${new Date().toISOString().slice(0, 10)}`, ['name', 'address', 'phone', 'website', 'domain', 'status', 'accountManager', 'tier'],
    orgs.map((o) => [o.name, o.address, o.phone, o.website, o.domain, o.status, o.accountManager?.name || '', o.tier]));
});
exports.exportAgents = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const agents = await Agent.find(comp).populate('role', 'name').populate('departments.department', 'name').lean();
  csvDownload(res, `agents-${new Date().toISOString().slice(0, 10)}`, ['name', 'email', 'role', 'departments', 'isAdmin', 'isActive', 'lastLogin'],
    agents.map((a) => [a.name, a.email, a.role?.name || '', (a.departments || []).map((d) => d.department?.name).join('; '), a.isAdmin ? 'yes' : 'no', a.isActive ? 'yes' : 'no', a.lastLogin ? new Date(a.lastLogin).toISOString() : '']));
});
exports.exportTickets = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const tickets = await Ticket.find(comp).sort({ updatedAt: -1 }).limit(5000)
    .populate('user', 'name email').populate('dept', 'name').populate('agent', 'name').populate('topic', 'topic').lean();
  csvDownload(res, `tickets-${new Date().toISOString().slice(0, 10)}`, ['number', 'status', 'priority', 'subject', 'customerName', 'customerEmail', 'department', 'agent', 'helpTopic', 'source', 'dueDate', 'createdAt', 'closedAt'],
    tickets.map((t) => [t.number, t.status, t.priority, t.subject, t.user?.name, t.user?.email, t.dept?.name, t.agent?.name, t.topic?.topic, t.source,
      t.dueDate ? new Date(t.dueDate).toISOString() : '', t.createdAt ? new Date(t.createdAt).toISOString() : '', t.closedAt ? new Date(t.closedAt).toISOString() : '']));
});
exports.importUsers = asyncHandler(async (req, res) => {
  const { csv } = req.body;
  if (!csv || !String(csv).trim()) throw new ApiError(422, 'CSV content is required');
  const rows = parseCsv(csv);
  if (!rows.length) throw new ApiError(422, 'CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes('email') || header.includes('name');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const idx = (k) => {
    if (!hasHeader) return { name: 0, email: 1, phone: 2, organization: 3 }[k];
    return header.indexOf(k);
  };
  let created = 0, skipped = 0;
  const orgCache = {};
  for (const r of dataRows) {
    const name = r[idx('name')]?.trim() || '';
    const email = (r[idx('email')]?.trim() || '').toLowerCase();
    if (!email) { skipped++; continue; }
    if (await User.findOne({ email })) { skipped++; continue; }
    let organization = null;
    const orgName = r[idx('organization')]?.trim();
    if (orgName) {
      if (!orgCache[orgName]) {
        orgCache[orgName] = await Organization.findOne({ name: orgName, ...(req.companyId ? { company: req.companyId } : {}) }).lean();
      }
      organization = orgCache[orgName]?._id || null;
    }
    await User.create({
      name: name || email.split('@')[0],
      email,
      phone: r[idx('phone')]?.trim() || '',
      organization,
      company: req.companyId,
      isRegistered: false,
      createdBy: req.agent?._id || req.admin?._id || null,
    });
    created++;
  }
  res.status(201).json({ success: true, created, skipped });
});
exports.importOrgs = asyncHandler(async (req, res) => {
  const { csv } = req.body;
  if (!csv || !String(csv).trim()) throw new ApiError(422, 'CSV content is required');
  const rows = parseCsv(csv);
  if (!rows.length) throw new ApiError(422, 'CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes('name');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const idx = (k) => {
    if (!hasHeader) return { name: 0, address: 1, phone: 2, website: 3, domain: 4 }[k];
    return header.indexOf(k);
  };
  let created = 0, skipped = 0;
  for (const r of dataRows) {
    const name = r[idx('name')]?.trim();
    if (!name) { skipped++; continue; }
    if (await Organization.findOne({ name, ...(req.companyId ? { company: req.companyId } : {}) })) { skipped++; continue; }
    await Organization.create({
      name,
      company: req.companyId,
      address: r[idx('address')]?.trim() || '',
      phone: r[idx('phone')]?.trim() || '',
      website: r[idx('website')]?.trim() || '',
      domain: r[idx('domain')]?.trim() || '',
    });
    created++;
  }
  res.status(201).json({ success: true, created, skipped });
});
