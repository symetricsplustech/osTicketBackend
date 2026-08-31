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






exports.listAgents = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const agents = await Agent.find(comp).populate('role', 'name').populate('departments.department', 'name').populate('teams', 'name').sort({ name: 1 });
  res.json({ success: true, items: agents });
});
exports.createAgent = asyncHandler(async (req, res) => {
  const { name, email, password, role, isAdmin, isActive, departments, teams, signature, notes, permissions } = req.body;
  if (!name || !email || !password) throw new ApiError(422, 'Name, email and password are required');
  if (await Agent.findOne({ email: email.toLowerCase(), ...(req.companyId ? { company: req.companyId } : {}) })) throw new ApiError(409, 'An agent with this email already exists');
  const agent = await Agent.create({
    name,
    email,
    password,
    company: req.companyId,
    role: role || null,
    isAdmin: !!isAdmin,
    isActive: isActive !== false,
    departments: departments || [],
    teams: teams || [],
    permissions: Array.isArray(permissions) ? permissions : [],
    signature: signature || '',
    notes: notes || '',
  });
  res.status(201).json({ success: true, agent });
});
exports.updateAgent = asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.params.id);
  if (!agent) throw new ApiError(404, 'Agent not found');
  if (req.companyId && String(agent.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, email, password, role, isAdmin, isActive, departments, teams, signature, notes, permissions, skills, presence, capacity, notificationPrefs } = req.body;
  if (name) agent.name = name;
  if (email) agent.email = email;
  if (password) agent.password = password;
  if (role !== undefined) agent.role = role;
  if (isAdmin !== undefined) agent.isAdmin = isAdmin;
  if (isActive !== undefined) agent.isActive = isActive;
  if (departments !== undefined) agent.departments = departments;
  if (teams !== undefined) agent.teams = teams;
  if (permissions !== undefined) agent.permissions = Array.isArray(permissions) ? permissions : [];
  if (skills !== undefined) agent.skills = Array.isArray(skills) ? skills : [];
  if (presence !== undefined) agent.presence = presence;
  if (capacity !== undefined) agent.capacity = capacity;
  if (notificationPrefs !== undefined && typeof notificationPrefs === 'object') agent.notificationPrefs = notificationPrefs || {};
  if (agent.skillsChanged) { delete agent.skillsChanged; }
  if (signature !== undefined) agent.signature = signature;
  if (notes !== undefined) agent.notes = notes;
  await agent.save();
  res.json({ success: true, agent });
});
exports.deleteAgent = asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.params.id);
  if (!agent) throw new ApiError(404, 'Agent not found');
  if (req.companyId && String(agent.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  if (agent.isAdmin) throw new ApiError(400, 'Cannot delete an admin account');
  await Agent.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Agent deleted' });
});
exports.getRoles = asyncHandler(async (req, res) => {
  const comp = { company: req.companyId, scope: 'tenant' };
  const roles = await Role.find(comp).sort({ name: 1 });
  res.json({ success: true, items: roles });
});
exports.createRole = asyncHandler(async (req, res) => {
  const { name, permissions, isAdmin, notes, category, moduleKeys, recordScopes, fieldAccess, approvalLimit, assignableBy } = req.body;
  if (!name) throw new ApiError(422, 'Role name is required');
  if (category === 'platform') {
    auditRoleChange(req, 'role.platform_creation_denied', { name, category, scope: 'platform' });
    throw new ApiError(422, 'Platform roles can only be managed through the platform administration boundary');
  }
  const role = await Role.create({ name, scope: 'tenant', permissions: permissions || [], isAdmin: !!isAdmin, notes: notes || '', category, moduleKeys, recordScopes, fieldAccess, approvalLimit, assignableBy, company: req.companyId });
  auditRoleChange(req, 'role.created', role);
  res.status(201).json({ success: true, role });
});
exports.updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found');
  if (role.scope !== 'tenant' || String(role.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const before = role.toObject();
  const { name, permissions, isAdmin, notes, category, moduleKeys, recordScopes, fieldAccess, approvalLimit, assignableBy } = req.body;
  if (category === 'platform') {
    auditRoleChange(req, 'role.platform_update_denied', { _id: role._id, name: role.name, category, scope: 'platform' }, before);
    throw new ApiError(422, 'Platform roles can only be managed through the platform administration boundary');
  }
  if (name) role.name = name;
  if (permissions !== undefined) role.permissions = permissions;
  if (isAdmin !== undefined) role.isAdmin = isAdmin;
  if (notes !== undefined) role.notes = notes;
  if (category !== undefined) role.category = category;
  if (moduleKeys !== undefined) role.moduleKeys = moduleKeys;
  if (recordScopes !== undefined) role.recordScopes = recordScopes;
  if (fieldAccess !== undefined) role.fieldAccess = fieldAccess;
  if (approvalLimit !== undefined) role.approvalLimit = approvalLimit;
  if (assignableBy !== undefined) role.assignableBy = assignableBy;
  await role.save();
  auditRoleChange(req, 'role.updated', role, before);
  res.json({ success: true, role });
});
exports.deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, company: req.companyId, scope: 'tenant' });
  if (!role) throw new ApiError(404, 'Role not found');
  const before = role.toObject();
  await role.deleteOne();
  auditRoleChange(req, 'role.deleted', before, before);
  res.json({ success: true, message: 'Role deleted' });
});
