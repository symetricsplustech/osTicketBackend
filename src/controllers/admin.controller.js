const Agent = require('../models/Agent');
const Team = require('../models/Team');
const Role = require('../models/Role');
const Department = require('../models/Department');
const HelpTopic = require('../models/HelpTopic');
const SlaPlan = require('../models/SlaPlan');
const TicketFilter = require('../models/TicketFilter');
const EmailTemplate = require('../models/EmailTemplate');
const SystemSetting = require('../models/SystemSetting');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Organization = require('../models/Organization');
const CannedResponse = require('../models/CannedResponse');
const FaqCategory = require('../models/FaqCategory');
const Faq = require('../models/Faq');
const Announcement = require('../models/Announcement');
const EmailLog = require('../models/EmailLog');
const Notification = require('../models/Notification');
const Company = require('../models/Company');
const TicketStatus = require('../models/TicketStatus');
const CustomField = require('../models/CustomField');
const TicketForm = require('../models/TicketForm');
const Holiday = require('../models/Holiday');
const Integration = require('../models/Integration');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const { computeDueDate } = require('../services/sla.service');
const { uploadsDir } = require('../config/multer');

exports.dashboard = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const [open, assigned, overdue, closed, archived, total, users, agents, depts, byPriority, latest] = await Promise.all([
    Ticket.countDocuments({ status: Ticket.STATUSES.OPEN, ...comp }),
    Ticket.countDocuments({ status: Ticket.STATUSES.ASSIGNED, ...comp }),
    Ticket.countDocuments({ status: Ticket.STATUSES.OVERDUE, ...comp }),
    Ticket.countDocuments({ status: Ticket.STATUSES.CLOSED, ...comp }),
    Ticket.countDocuments({ status: Ticket.STATUSES.ARCHIVED, ...comp }),
    Ticket.countDocuments({ status: { $ne: Ticket.STATUSES.DELETED }, ...comp }),
    User.countDocuments(comp),
    Agent.countDocuments({ isActive: true, ...comp }),
    Department.countDocuments({ status: 'active', ...comp }),
    Ticket.aggregate([{ $match: comp }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Ticket.find({ status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.DELETED] }, ...comp })
      .sort({ updatedAt: -1 })
      .limit(6)
      .populate('user', 'name email')
      .populate('dept', 'name')
      .populate('agent', 'name'),
  ]);
  res.json({
    success: true,
    stats: { open, assigned, overdue, closed, archived, total, users, agents, depts, byPriority },
    latest,
  });
});

exports.systemInfo = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    info: {
      name: 'osTicket MERN',
      version: '1.0.0',
      node: process.version,
      mongo: require('mongoose').version,
      env: process.env.NODE_ENV || 'development',
    },
  });
});

exports.emailLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const comp = req.companyId ? { company: req.companyId } : {};
  const [items, total] = await Promise.all([
    EmailLog.find(comp).sort(getSortObj(sort)).skip(skip).limit(limit),
    EmailLog.countDocuments(comp),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

// ------------------------- Agents -------------------------

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
  const comp = req.companyId ? { company: req.companyId } : {};
  const roles = await Role.find(comp).sort({ name: 1 });
  res.json({ success: true, items: roles });
});

exports.createRole = asyncHandler(async (req, res) => {
  const { name, permissions, isAdmin, notes } = req.body;
  if (!name) throw new ApiError(422, 'Role name is required');
  const role = await Role.create({ name, permissions: permissions || [], isAdmin: !!isAdmin, notes: notes || '', company: req.companyId });
  res.status(201).json({ success: true, role });
});

exports.updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found');
  if (req.companyId && String(role.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, permissions, isAdmin, notes } = req.body;
  if (name) role.name = name;
  if (permissions !== undefined) role.permissions = permissions;
  if (isAdmin !== undefined) role.isAdmin = isAdmin;
  if (notes !== undefined) role.notes = notes;
  await role.save();
  res.json({ success: true, role });
});

exports.deleteRole = asyncHandler(async (req, res) => {
  await Role.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Role deleted' });
});

// ------------------------- Teams -------------------------

exports.listTeams = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const teams = await Team.find(comp).populate('lead', 'name').populate('members', 'name').sort({ name: 1 });
  res.json({ success: true, items: teams });
});

exports.createTeam = asyncHandler(async (req, res) => {
  const { name, lead, members, notes, status } = req.body;
  if (!name) throw new ApiError(422, 'Team name is required');
  const team = await Team.create({ name, lead: lead || null, members: members || [], notes: notes || '', status: status || 'active', company: req.companyId });
  res.status(201).json({ success: true, team });
});

exports.updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');
  if (req.companyId && String(team.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, lead, members, notes, status } = req.body;
  if (name) team.name = name;
  if (lead !== undefined) team.lead = lead;
  if (members !== undefined) team.members = members;
  if (notes !== undefined) team.notes = notes;
  if (status !== undefined) team.status = status;
  await team.save();
  res.json({ success: true, team });
});

exports.deleteTeam = asyncHandler(async (req, res) => {
  await Team.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Team deleted' });
});

// ------------------------- Departments -------------------------

exports.listDepartments = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const departments = await Department.find(comp)
    .populate('parent', 'name')
    .populate('manager', 'name')
    .populate('sla', 'name')
    .sort({ name: 1 });
  res.json({ success: true, items: departments });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, parent, email, isPublic, sla, manager, autoAssignAgent, autoAssignTeam, signature, notes } = req.body;
  if (!name) throw new ApiError(422, 'Department name is required');
  const dept = await Department.create({
    name,
    company: req.companyId,
    parent: parent || null,
    email: email || '',
    isPublic: isPublic !== false,
    sla: sla || null,
    manager: manager || null,
    autoAssignAgent: autoAssignAgent || null,
    autoAssignTeam: autoAssignTeam || null,
    signature: signature || '',
    notes: notes || '',
  });
  res.status(201).json({ success: true, dept });
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new ApiError(404, 'Department not found');
  if (req.companyId && String(dept.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, parent, email, isPublic, sla, manager, autoAssignAgent, autoAssignTeam, signature, notes, status, schedule } = req.body;
  if (name) dept.name = name;
  if (parent !== undefined) dept.parent = parent;
  if (email !== undefined) dept.email = email;
  if (isPublic !== undefined) dept.isPublic = isPublic;
  if (sla !== undefined) dept.sla = sla;
  if (manager !== undefined) dept.manager = manager;
  if (autoAssignAgent !== undefined) dept.autoAssignAgent = autoAssignAgent;
  if (autoAssignTeam !== undefined) dept.autoAssignTeam = autoAssignTeam;
  if (signature !== undefined) dept.signature = signature;
  if (schedule !== undefined) dept.schedule = schedule;
  if (notes !== undefined) dept.notes = notes;
  if (status !== undefined) dept.status = status;
  await dept.save();
  res.json({ success: true, dept });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  await Department.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Department deleted' });
});

// ------------------------- Help Topics -------------------------

exports.listHelpTopics = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const topics = await HelpTopic.find(comp)
    .populate('department', 'name')
    .populate('sla', 'name')
    .populate('autoAssignAgent', 'name')
    .populate('autoAssignTeam', 'name')
    .sort({ topic: 1 });
  res.json({ success: true, items: topics });
});

exports.createHelpTopic = asyncHandler(async (req, res) => {
  const { topic, category, parent, department, priority, sla, autoAssignAgent, autoAssignTeam, autoresponder, isPublic, status, notes } = req.body;
  if (!topic) throw new ApiError(422, 'Help topic is required');
  const ht = await HelpTopic.create({
    topic,
    company: req.companyId,
    category: category || '',
    parent: parent || null,
    department: department || null,
    priority: priority || 'Normal',
    sla: sla || null,
    autoAssignAgent: autoAssignAgent || null,
    autoAssignTeam: autoAssignTeam || null,
    autoresponder: autoresponder && autoresponder.enabled !== undefined ? autoresponder : undefined,
    isPublic: isPublic !== false,
    status: status || 'active',
    notes: notes || '',
  });
  res.status(201).json({ success: true, ht });
});

exports.updateHelpTopic = asyncHandler(async (req, res) => {
  const ht = await HelpTopic.findById(req.params.id);
  if (!ht) throw new ApiError(404, 'Help topic not found');
  if (req.companyId && String(ht.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { topic, category, parent, department, priority, sla, autoAssignAgent, autoAssignTeam, autoresponder, isPublic, status, notes } = req.body;
  if (topic) ht.topic = topic;
  if (category !== undefined) ht.category = category;
  if (parent !== undefined) ht.parent = parent || null;
  if (department !== undefined) ht.department = department || null;
  if (priority !== undefined) ht.priority = priority;
  if (sla !== undefined) ht.sla = sla || null;
  if (autoAssignAgent !== undefined) ht.autoAssignAgent = autoAssignAgent || null;
  if (autoAssignTeam !== undefined) ht.autoAssignTeam = autoAssignTeam || null;
  if (autoresponder !== undefined) ht.autoresponder = autoresponder;
  if (isPublic !== undefined) ht.isPublic = isPublic;
  if (status !== undefined) ht.status = status;
  if (notes !== undefined) ht.notes = notes;
  await ht.save();
  res.json({ success: true, ht });
});

exports.deleteHelpTopic = asyncHandler(async (req, res) => {
  await HelpTopic.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Help topic deleted' });
});

// ------------------------- SLA Plans -------------------------

exports.listSlaPlans = asyncHandler(async (req, res) => {
  const plans = await SlaPlan.find(req.companyId ? { company: req.companyId } : {}).sort({ name: 1 });
  res.json({ success: true, items: plans });
});

exports.createSlaPlan = asyncHandler(async (req, res) => {
  const { name, gracePeriod, schedule, status, notes } = req.body;
  if (!name) throw new ApiError(422, 'SLA name is required');
  const plan = await SlaPlan.create({
    name,
    company: req.companyId,
    gracePeriod: parseInt(gracePeriod, 10) || 24,
    schedule: schedule || '24/7',
    status: status || 'active',
    notes: notes || '',
  });
  res.status(201).json({ success: true, plan });
});

exports.updateSlaPlan = asyncHandler(async (req, res) => {
  const plan = await SlaPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'SLA plan not found');
  if (req.companyId && String(plan.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, gracePeriod, schedule, status, notes } = req.body;
  if (name) plan.name = name;
  if (gracePeriod !== undefined) plan.gracePeriod = parseInt(gracePeriod, 10);
  if (schedule !== undefined) plan.schedule = schedule;
  if (status !== undefined) plan.status = status;
  if (notes !== undefined) plan.notes = notes;
  await plan.save();
  res.json({ success: true, plan });
});

exports.deleteSlaPlan = asyncHandler(async (req, res) => {
  await SlaPlan.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'SLA plan deleted' });
});

// ------------------------- Ticket Filters -------------------------

exports.listFilters = asyncHandler(async (req, res) => {
  const filters = await TicketFilter.find(req.companyId ? { company: req.companyId } : {}).sort({ order: 1 });
  res.json({ success: true, items: filters });
});

exports.createFilter = asyncHandler(async (req, res) => {
  const { name, rules, actions, match, status, order } = req.body;
  if (!name) throw new ApiError(422, 'Filter name is required');
  const filter = await TicketFilter.create({
    name,
    company: req.companyId,
    rules: rules || [],
    actions: actions || [],
    match: match || 'all',
    status: status || 'active',
    order: order || 0,
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, filter });
});

exports.updateFilter = asyncHandler(async (req, res) => {
  const filter = await TicketFilter.findById(req.params.id);
  if (!filter) throw new ApiError(404, 'Filter not found');
  if (req.companyId && String(filter.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, rules, actions, match, status, order } = req.body;
  if (name) filter.name = name;
  if (rules !== undefined) filter.rules = rules;
  if (actions !== undefined) filter.actions = actions;
  if (match !== undefined) filter.match = match;
  if (status !== undefined) filter.status = status;
  if (order !== undefined) filter.order = order;
  await filter.save();
  res.json({ success: true, filter });
});

exports.deleteFilter = asyncHandler(async (req, res) => {
  await TicketFilter.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Filter deleted' });
});

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

exports.listEmailTemplates = asyncHandler(async (req, res) => {
  const companyId = req.companyId || null;
  const filter = companyId ? { $or: [{ company: null }, { company: companyId }] } : { company: null };
  const templates = await EmailTemplate.find(filter).sort({ name: 1 }).lean();
  const items = templates.map((t) => ({
    ...t,
    isGlobal: !t.company,
    triggerLabel: EmailTemplate.getTriggerByKey(t.trigger || t.key).label,
  }));
  res.json({
    success: true,
    items,
    meta: { triggers: EmailTemplate.TRIGGERS, recipients: EmailTemplate.RECIPIENTS },
  });
});

exports.getEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');
  if (req.companyId && template.company && String(template.company) !== String(req.companyId)) {
    throw new ApiError(403, 'Access denied');
  }
  res.json({ success: true, template, meta: { triggers: EmailTemplate.TRIGGERS, recipients: EmailTemplate.RECIPIENTS } });
});

exports.createEmailTemplate = asyncHandler(async (req, res) => {
  const data = validateTemplatePayload(req.body);
  const companyId = req.companyId || null;
  const key = data.trigger;
  if (!key) throw new ApiError(422, 'Trigger (when the notification is sent) is required');

  const existing = await EmailTemplate.findOne({ key, company: companyId });
  if (existing) {
    throw new ApiError(409, `A template for this trigger already exists${companyId ? ' for your company' : ''}`);
  }

  const template = await EmailTemplate.create({
    key,
    name: data.name,
    description: data.description || '',
    subject: data.subject,
    body: data.body,
    trigger: data.trigger || key,
    recipient: data.recipient || EmailTemplate.getTriggerByKey(key).recipient,
    isActive: data.isActive !== undefined ? data.isActive : true,
    context: data.context || 'ticket',
    company: companyId,
  });
  res.status(201).json({ success: true, template });
});

exports.updateEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');

  const companyId = req.companyId || null;
  // A company admin editing a system (global) template creates a scoped override
  // instead of mutating the shared template for every tenant.
  if (companyId && !template.company) {
    let override = await EmailTemplate.findOne({ key: template.key, company: companyId });
    if (override) {
      Object.assign(override, validateTemplatePayload(req.body, { partial: true }));
      await override.save();
      return res.json({ success: true, template: override, overridden: true });
    }
    override = await EmailTemplate.create({
      key: template.key,
      name: template.name,
      description: template.description || '',
      subject: template.subject,
      body: template.body,
      trigger: template.trigger || template.key,
      recipient: template.recipient || EmailTemplate.getTriggerByKey(template.key).recipient,
      isActive: template.isActive !== false,
      context: template.context || 'ticket',
      company: companyId,
      ...validateTemplatePayload(req.body, { partial: true }),
    });
    return res.status(201).json({ success: true, template: override, overridden: true });
  }

  if (companyId && template.company && String(template.company) !== String(companyId)) {
    throw new ApiError(403, 'Access denied');
  }
  Object.assign(template, validateTemplatePayload(req.body, { partial: true }));
  await template.save();
  res.json({ success: true, template });
});

exports.deleteEmailTemplate = asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');
  const companyId = req.companyId || null;
  if (companyId && (!template.company || String(template.company) !== String(companyId))) {
    throw new ApiError(403, 'System templates cannot be deleted. Edit them to create a company-specific override instead.');
  }
  await template.deleteOne();
  res.json({ success: true, message: 'Template deleted' });
});

// ------------------------- Settings -------------------------

exports.getSettings = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const settings = await SystemSetting.getSettings();
  const slas = await SlaPlan.find(comp).select('name');
  const depts = await Department.find(comp).select('name');
  res.json({ success: true, settings, refs: { slas, depts } });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const { section, values } = req.body;
  if (!section || typeof values !== 'object') throw new ApiError(422, 'section and values are required');
  for (const [key, value] of Object.entries(values)) {
    await SystemSetting.setSetting(`${section}.${key}`, value);
  }
  const settings = await SystemSetting.getSettings();
  res.json({ success: true, settings });
});

exports.getCompanySettings = asyncHandler(async (req, res) => {
  if (!req.companyId) throw new ApiError(404, 'No company is associated with your account');
  const company = await Company.findById(req.companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  res.json({ success: true, data: company });
});

exports.updateCompanySettings = asyncHandler(async (req, res) => {
  if (!req.companyId) throw new ApiError(404, 'No company is associated with your account');
  const company = await Company.findById(req.companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  const allowed = ['name', 'email', 'phone', 'domain', 'logo', 'address', 'contactPerson'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) company[key] = String(req.body[key]).trim();
  }
  await company.save();
  res.json({ success: true, data: company });
});

exports.uploadCompanyLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'No file uploaded');
  const url = `/uploads/${req.file.filename}`;
  if (req.companyId) {
    const company = await Company.findById(req.companyId);
    if (company) {
      company.logo = url;
      await company.save();
    }
  }
  res.json({ success: true, url });
});

// ------------------------- Users (admin) -------------------------

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search } = req.query;
  const query = {};
  if (req.companyId) query.company = req.companyId;
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const [items, total] = await Promise.all([
    User.find(query).sort(getSortObj(sort)).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, organization, status } = req.body;
  if (!name || !email) throw new ApiError(422, 'Name and email are required');
  const exists = await User.findOne({ email: String(email).toLowerCase().trim(), ...(req.companyId ? { company: req.companyId } : {}) });
  if (exists) throw new ApiError(409, 'A user with this email already exists');
  const user = await User.create({
    name,
    email: String(email).toLowerCase().trim(),
    company: req.companyId,
    phone: phone || '',
    password: password || null,
    organization: organization || null,
    status: status || 'active',
    isRegistered: !!password,
    emailConfirmed: !!password,
  });
  res.status(201).json({ success: true, user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (req.companyId && String(user.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, email, phone, organization, status, notes } = req.body;
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (organization !== undefined) user.organization = organization;
  if (status !== undefined) user.status = status;
  if (notes !== undefined) user.notes = notes;
  await user.save();
  res.json({ success: true, user });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (req.companyId && String(user.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  user.status = 'disabled';
  await user.save();
  res.json({ success: true, message: 'User disabled' });
});

// ------------------------- Organizations (admin) -------------------------

exports.listOrgs = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const orgs = await Organization.find(comp).populate('accountManager', 'name').sort({ name: 1 });
  res.json({ success: true, items: orgs });
});

exports.createOrg = asyncHandler(async (req, res) => {
  const { name, address, phone, website, domain, accountManager, sla, notes } = req.body;
  if (!name) throw new ApiError(422, 'Organization name is required');
  const org = await Organization.create({ name, address, phone, website, domain, accountManager, sla: sla || null, notes, company: req.companyId });
  res.status(201).json({ success: true, org });
});

exports.updateOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw new ApiError(404, 'Organization not found');
  if (req.companyId && String(org.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, address, phone, website, domain, accountManager, sla, status, notes } = req.body;
  if (name) org.name = name;
  if (address !== undefined) org.address = address;
  if (phone !== undefined) org.phone = phone;
  if (website !== undefined) org.website = website;
  if (domain !== undefined) org.domain = domain;
  if (accountManager !== undefined) org.accountManager = accountManager;
  if (sla !== undefined) org.sla = sla || null;
  if (status !== undefined) org.status = status;
  if (notes !== undefined) org.notes = notes;
  await org.save();
  res.json({ success: true, org });
});

exports.deleteOrg = asyncHandler(async (req, res) => {
  await Organization.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Organization deleted' });
});

// ------------------------- Canned (admin) -------------------------

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

// ------------------------- FAQ management -------------------------

exports.updateFaqCategory = asyncHandler(async (req, res) => {
  const cat = await FaqCategory.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  if (req.companyId && String(cat.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, description, isPublic, sortOrder } = req.body;
  if (name) cat.name = name;
  if (description !== undefined) cat.description = description;
  if (isPublic !== undefined) cat.isPublic = isPublic;
  if (sortOrder !== undefined) cat.sortOrder = sortOrder;
  await cat.save();
  res.json({ success: true, cat });
});

exports.deleteFaqCategory = asyncHandler(async (req, res) => {
  const cat = await FaqCategory.findById(req.params.id);
  if (!cat) throw new ApiError(404, 'Category not found');
  if (req.companyId && String(cat.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  await FaqCategory.findByIdAndDelete(req.params.id);
  await Faq.updateMany({ category: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) }, { $set: { category: null } });
  res.json({ success: true, message: 'Category deleted' });
});

exports.createFaq = asyncHandler(async (req, res) => {
  const { category, question, answer, keywords, isPublished } = req.body;
  if (!question || !answer) throw new ApiError(422, 'Question and answer are required');
  const faq = await Faq.create({ category: category || null, company: req.companyId, question, answer, keywords: keywords || [], isPublished: isPublished !== false, createdBy: req.agent._id });
  res.status(201).json({ success: true, faq });
});

exports.updateFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw new ApiError(404, 'FAQ not found');
  if (req.companyId && String(faq.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { category, question, answer, keywords, isPublished } = req.body;
  if (category !== undefined) faq.category = category;
  if (question) faq.question = question;
  if (answer !== undefined) faq.answer = answer;
  if (keywords !== undefined) faq.keywords = keywords;
  if (isPublished !== undefined) faq.isPublished = isPublished;
  await faq.save();
  res.json({ success: true, faq });
});

exports.deleteFaq = asyncHandler(async (req, res) => {
  await Faq.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'FAQ deleted' });
});

// ------------------------- Announcements -------------------------

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const { title, body, showDate, isActive } = req.body;
  if (!title || !body) throw new ApiError(422, 'Title and body are required');
  const ann = await Announcement.create({ title, body, showDate: showDate || null, isActive: isActive !== false, createdBy: req.agent._id, company: req.companyId });
  res.status(201).json({ success: true, ann });
});

exports.updateAnnouncement = asyncHandler(async (req, res) => {
  const ann = await Announcement.findById(req.params.id);
  if (!ann) throw new ApiError(404, 'Announcement not found');
  if (req.companyId && String(ann.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { title, body, showDate, isActive } = req.body;
  if (title) ann.title = title;
  if (body !== undefined) ann.body = body;
  if (showDate !== undefined) ann.showDate = showDate;
  if (isActive !== undefined) ann.isActive = isActive;
  await ann.save();
  res.json({ success: true, ann });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  await Announcement.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Announcement deleted' });
});

// ------------------------- Recompute due dates -------------------------

exports.recomputeDueDates = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const tickets = await Ticket.find({ status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.DELETED] }, ...comp });
  let updated = 0;
  for (const t of tickets) {
    const due = await computeDueDate(t.sla, t.createdAt);
    if (due) {
      t.dueDate = due;
      await t.save();
      updated++;
    }
  }
  res.json({ success: true, message: `${updated} tickets updated`, updated });
});

// ------------------------- Notifications -------------------------

exports.notifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ recipient: req.agent._id, recipientType: 'agent' })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('ticket', 'number subject');
  const unread = items.filter((n) => !n.read).length;
  res.json({ success: true, items, unread });
});

exports.markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.agent._id, recipientType: 'agent', read: false },
    { $set: { read: true } }
  );
  res.json({ success: true, message: 'Notifications marked as read' });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipient: req.agent._id, recipientType: 'agent' },
    { $set: { read: true } }
  );
  res.json({ success: true, message: 'Notification marked as read' });
});

exports.deleteReadNotifications = asyncHandler(async (req, res) => {
  const { deletedCount } = await Notification.deleteMany({
    recipient: req.agent._id,
    recipientType: 'agent',
    read: true,
  });
  res.json({ success: true, message: `${deletedCount} read notification(s) removed` });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  await Notification.deleteOne({ _id: req.params.id, recipient: req.agent._id, recipientType: 'agent' });
  res.json({ success: true, message: 'Notification removed' });
});

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

exports.ticketStatuses = makeCrud(TicketStatus);

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

exports.customFields = makeCrud(CustomField, { preSave: normalizeCustomField });

// ------------------------- Ticket Forms -------------------------

exports.ticketForms = makeCrud(TicketForm, { listPopulate: [{ path: 'fields', select: 'name label type' }, { path: 'helpTopic', select: 'topic' }] });

// ------------------------- Holidays -------------------------

exports.holidays = makeCrud(Holiday);

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

// ------------------------- Priorities -------------------------

exports.listPriorities = asyncHandler(async (req, res) => {
  const { listPriorities } = require('../services/priority.service');
  const items = await listPriorities(req.companyId || null);
  res.json({ success: true, items });
});

exports.createPriority = asyncHandler(async (req, res) => {
  const Priority = require('../models/Priority');
  const { name, level, color, isDefault, sla, notes } = req.body;
  if (!name) throw new ApiError(422, 'Priority name is required');
  const exists = await Priority.findOne({ name, company: req.companyId || null });
  if (exists) throw new ApiError(409, 'A priority with this name already exists');
  if (isDefault) {
    await Priority.updateMany({ company: req.companyId || null }, { $set: { isDefault: false } });
  }
  const item = await Priority.create({
    name,
    company: req.companyId || null,
    level: level || 2,
    color: color || '#64748b',
    isDefault: !!isDefault,
    sla: sla || null,
    notes: notes || '',
    isActive: true,
  });
  res.status(201).json({ success: true, item });
});

exports.updatePriority = asyncHandler(async (req, res) => {
  const Priority = require('../models/Priority');
  const item = await Priority.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Priority not found');
  if (req.companyId && String(item.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, level, color, isDefault, sla, notes, isActive } = req.body;
  if (name) item.name = name;
  if (level !== undefined) item.level = level;
  if (color !== undefined) item.color = color;
  if (isDefault) {
    await Priority.updateMany({ company: item.company }, { $set: { isDefault: false } });
    item.isDefault = true;
  } else if (isDefault === false) {
    item.isDefault = false;
  }
  if (sla !== undefined) item.sla = sla || null;
  if (notes !== undefined) item.notes = notes;
  if (isActive !== undefined) item.isActive = isActive;
  await item.save();
  res.json({ success: true, item });
});

exports.deletePriority = asyncHandler(async (req, res) => {
  const Priority = require('../models/Priority');
  await Priority.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Priority deleted' });
});

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

exports.integrations = {
  list: asyncHandler(async (req, res) => {
    const comp = req.companyId ? { company: req.companyId } : {};
    for (const item of INTEGRATION_CATALOG) {
      const exists = await Integration.findOne({ key: item.key, ...comp });
      if (!exists) await Integration.create({ ...item, config: {}, isEnabled: false, company: req.companyId || null });
    }
    const items = await Integration.find(comp).sort({ category: 1, name: 1 });
    res.json({ success: true, items });
  }),
  create: asyncHandler(async (req, res) => {
    const body = { ...req.body, company: req.companyId || null };
    if (!body.key && body.name) {
      body.key = String(body.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
    if (body.config && typeof body.config === 'string') {
      try { body.config = JSON.parse(body.config); } catch (err) { throw new ApiError(422, 'Invalid config JSON'); }
    }
    const item = await Integration.create(body);
    res.status(201).json({ success: true, item });
  }),
  update: asyncHandler(async (req, res) => {
    const item = await Integration.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    companyOwned(req, item);
    const body = { ...req.body };
    delete body._id;
    delete body.company;
    if (body.config && typeof body.config === 'string') {
      try { body.config = JSON.parse(body.config); } catch (err) { throw new ApiError(422, 'Invalid config JSON'); }
    }
    Object.assign(item, body);
    await item.save();
    res.json({ success: true, item });
  }),
  remove: asyncHandler(async (req, res) => {
    const item = await Integration.findById(req.params.id);
    if (!item) throw new ApiError(404, 'Not found');
    companyOwned(req, item);
    await Integration.deleteOne({ _id: item._id });
    res.json({ success: true, message: 'Deleted' });
  }),
};

exports.importTickets = asyncHandler(async (req, res) => {
  const { csv } = req.body;
  if (!csv || !String(csv).trim()) throw new ApiError(422, 'CSV content is required');
  const rows = parseCsv(csv);
  if (!rows.length) throw new ApiError(422, 'CSV is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes('email') || header.includes('subject');
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const idx = (k) => {
    if (!hasHeader) return { subject: 0, email: 1, status: 2, priority: 3, department: 4 }[k];
    return header.indexOf(k);
  };
  let created = 0, skipped = 0;
  const deptCache = {};
  for (const r of dataRows) {
    const subject = r[idx('subject')]?.trim() || '';
    const email = (r[idx('email')]?.trim() || '').toLowerCase();
    if (!subject || !email) { skipped++; continue; }
    const deptName = r[idx('department')]?.trim();
    let department = null;
    if (deptName) {
      if (!deptCache[deptName]) {
        deptCache[deptName] = await Dept.findOne({ name: deptName, ...(req.companyId ? { company: req.companyId } : {}) }).lean();
      }
      department = deptCache[deptName]?._id || null;
    }
    const priority = r[idx('priority')]?.trim() || 'Normal';
    const status = r[idx('status')]?.trim() || 'open';
    if (!['open', 'pending', 'hold', 'closed', 'deleted'].includes(status)) { skipped++; continue; }
    if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) { skipped++; continue; }
    const user = await User.findOne({ email, ...(req.companyId ? { company: req.companyId } : {}) });
    if (!user) { skipped++; continue; }
    await Ticket.create({
      subject,
      details: '',
      priority,
      status,
      user: user._id,
      department,
      source: 'csv_import',
      createdBy: req.admin?._id || null,
    });
    created++;
  }
  res.status(201).json({ success: true, created, skipped });
});
