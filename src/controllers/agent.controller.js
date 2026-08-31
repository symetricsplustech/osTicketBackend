const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const Task = require('../models/Task');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Team = require('../models/Team');
const Department = require('../models/Department');
const Organization = require('../models/Organization');
const CannedResponse = require('../models/CannedResponse');
const FaqCategory = require('../models/FaqCategory');
const Faq = require('../models/Faq');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const EscalationRule = require('../models/EscalationRule');
const SystemSetting = require('../models/SystemSetting');
const TicketStatus = require('../models/TicketStatus');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const ticketService = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { notifyAgent, notifyUser } = require('../services/notification.service');
const { emit } = require('../services/events');
const config = require('../config/config');

const isAdminAgent = (agent) => agent.isAdmin || (agent.role && agent.role.isAdmin);
const hasPerm = (agent, perm) => {
  if (isAdminAgent(agent)) return true;
  return new Set([...(agent.permissions || []), ...(agent.role?.permissions || [])]).has(perm);
};

const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Emergency'];
const VALID_SOURCES = ['web', 'email', 'phone', 'api'];
const { isValidPriority } = require('../services/priority.service');
const assertValidPriority = async (value, msg = 'Invalid priority') => {
  if (!value) return;
  const ok = await isValidPriority(value);
  if (!ok) throw new ApiError(422, msg);
};

const assertNotLocked = (ticket, agent) => {
  if (
    ticket.lockedBy &&
    String(ticket.lockedBy) !== String(agent._id) &&
    ticket.lockExpiresAt &&
    ticket.lockExpiresAt > new Date()
  ) {
    throw new ApiError(423, 'This ticket is locked by another agent');
  }
};

const canManageEscalations = (agent) => isAdminAgent(agent) || hasPerm(agent, 'escalations.manage');

const getAgentDeptIds = (agent) => (agent.departments || []).map((d) => String(d.department)).filter(Boolean);
const getAgentTeamIds = (agent) => (agent.teams || []).map((t) => String(t));

const scopeTicketQuery = (agent, query = {}) => {
  if (agent.company) query.company = agent.company;
  if (isAdminAgent(agent) || hasPerm(agent, 'tickets.view')) return query;
  const deptIds = getAgentDeptIds(agent);
  const teamIds = getAgentTeamIds(agent);
  query.$and = query.$and || [];
  query.$and.push({
    $or: [
      { agent: agent._id },
      { dept: { $in: deptIds } },
      { team: { $in: teamIds } },
    ],
  });
  return query;
};

const toId = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const canAccessTicket = async (agent, ticket) => {
  if (isAdminAgent(agent) || hasPerm(agent, 'tickets.view')) return true;
  const agentId = toId(agent?._id);
  const ticketAgent = toId(ticket.agent);
  const ticketDept = toId(ticket.dept);
  const ticketTeam = toId(ticket.team);
  if (ticketAgent && ticketAgent === agentId) return true;
  if (ticketDept && getAgentDeptIds(agent).includes(ticketDept)) return true;
  if (ticketTeam && getAgentTeamIds(agent).includes(ticketTeam)) return true;
  return false;
};

const loadTicketForAgent = async (number, agent, opts = {}) => {
  const query = { number: String(number).trim().toUpperCase(), status: { $ne: Ticket.STATUSES.DELETED } };
  if (agent.company) query.company = agent.company;
  const ticket = await Ticket.findOne(query)
    .populate('user')
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name email')
    .populate('team', 'name')
    .populate('sla', 'name')
    .populate('collaborators', 'name email');
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (!opts.skipAccess && !(await canAccessTicket(agent, ticket))) {
    throw new ApiError(403, 'You do not have access to this ticket');
  }
  return ticket;
};

exports.dashboard = asyncHandler(async (req, res) => {
  const agent = req.agent;
  const base = scopeTicketQuery(agent, { status: { $ne: Ticket.STATUSES.DELETED } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [open, assigned, overdue, closed, mine, today, total, unread, latest] = await Promise.all([
    Ticket.countDocuments({ ...base, status: Ticket.STATUSES.OPEN }),
    Ticket.countDocuments({ ...base, status: Ticket.STATUSES.ASSIGNED }),
    Ticket.countDocuments({ ...base, status: Ticket.STATUSES.OVERDUE }),
    Ticket.countDocuments({ ...base, status: Ticket.STATUSES.CLOSED }),
    Ticket.countDocuments({ ...base, $or: [{ agent: agent._id }, { team: { $in: getAgentTeamIds(agent) } }], status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.DELETED] } }),
    Ticket.countDocuments({ ...base, createdAt: { $gte: todayStart } }),
    Ticket.countDocuments(base),
    Notification.countDocuments({ recipient: agent._id, recipientType: 'agent', read: false }),
    Ticket.find(base).sort({ updatedAt: -1 }).limit(5).populate('user', 'name email').populate('dept', 'name'),
  ]);

  const byPriority = await Ticket.aggregate([
    { $match: base },
    { $group: { _id: '$priority', count: { $sum: 1 } } },
  ]);

  res.json({
    success: true,
    stats: { open, assigned, overdue, closed, mine, today, total, unread, byPriority },
    latest,
  });
});

exports.queues = asyncHandler(async (req, res) => {
  const agent = req.agent;
  const base = scopeTicketQuery(agent, { status: { $ne: Ticket.STATUSES.DELETED } });
  const count = async (status) => Ticket.countDocuments(status ? { ...base, status } : base);
  const [all, open, assigned, overdue, closed, archived, mine] = await Promise.all([
    count(null),
    count(Ticket.STATUSES.OPEN),
    count(Ticket.STATUSES.ASSIGNED),
    count(Ticket.STATUSES.OVERDUE),
    count(Ticket.STATUSES.CLOSED),
    count(Ticket.STATUSES.ARCHIVED),
    Ticket.countDocuments({
      ...base,
      status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] },
      $or: [{ agent: agent._id }, { team: { $in: getAgentTeamIds(agent) } }],
    }),
  ]);
  res.json({ success: true, queues: { all, open, assigned, overdue, closed, archived, mine } });
});

exports.listTickets = asyncHandler(async (req, res) => {
  const agent = req.agent;
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-updatedAt' });
  const { status, priority, dept, assignee, search, number, q } = req.query;
  const query = { status: { $ne: Ticket.STATUSES.DELETED } };

  if (status && status !== 'all') {
    if (status === 'mine') {
      query.status = { $in: [Ticket.STATUSES.OPEN, Ticket.STATUSES.ASSIGNED, Ticket.STATUSES.OVERDUE] };
      query.$or = [{ agent: agent._id }, { team: { $in: getAgentTeamIds(agent) } }];
    } else if (status === 'unassigned') {
      query.agent = null;
      query.team = null;
      query.status = { $in: [Ticket.STATUSES.OPEN, Ticket.STATUSES.ASSIGNED] };
    } else {
      query.status = status;
    }
  }
  if (priority && priority !== 'all') query.priority = priority;
  if (dept && dept !== 'all') query.dept = dept;
  if (assignee && assignee !== 'all') {
    if (assignee === 'me') query.agent = agent._id;
    else query.agent = assignee;
  }
  if (number) query.number = String(number).trim().toUpperCase();
  if (search || q) {
    const s = search || q;
    query.$or = [
      { number: { $regex: s, $options: 'i' } },
      { subject: { $regex: s, $options: 'i' } },
    ];
  }

  scopeTicketQuery(agent, query);

  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort(getSortObj(sort))
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .populate('dept', 'name')
      .populate('topic', 'topic')
      .populate('agent', 'name')
      .populate('team', 'name'),
    Ticket.countDocuments(query),
  ]);

  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.getTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  await Ticket.populate(ticket, { path: 'lockedBy', select: 'name' });
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null })
    .sort({ createdAt: 1 })
    .populate('user', 'name email')
    .populate('agent', 'name');
  const tasks = await Task.find({ ticket: ticket._id }).sort({ createdAt: -1 }).populate('assignedTo', 'name').populate('createdBy', 'name');
  const comp = req.companyId ? { company: req.companyId } : {};
  const canned = await CannedResponse.find({ status: 'active', ...comp }).sort({ title: 1 });
  const agents = await Agent.find({ isActive: true, ...comp }).select('name email').sort({ name: 1 });
  const teams = await Team.find({ status: 'active', ...comp }).select('name').sort({ name: 1 });
  const depts = await Department.find({ status: 'active', ...comp }).select('name').sort({ name: 1 });
  const topics = await require('../models/HelpTopic').find({ status: 'active', ...comp }).select('topic').sort({ topic: 1 });
  const statuses = await TicketStatus.find({ isActive: true }).select('name key color isDefault sortOrder').sort({ sortOrder: 1 });
  res.json({ success: true, ticket, threads, tasks, canned, agents, teams, depts, topics, statuses });
});

exports.reply = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.reply')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { message } = req.body;
  if (!message) throw new ApiError(422, 'Message is required');
  const attachments = (req.files || []).map((f) => ({
    filename: f.originalname,
    path: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));
  await ticketService.addThreadEntry({
    ticket,
    type: 'message',
    posterType: 'agent',
    agent: req.agent,
    body: message,
    attachments,
  });
  await ticketService.addSystemEvent({ ticket, message: `Response posted by ${req.agent.name}` });
  require('../services/audit.service').audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.replied', entityType: 'ticket', entityId: ticket._id, after: { attachmentCount: attachments.length, hasAttachments: attachments.length > 0 }, req });
  await notifyMentionedAgents({ ticket, message, actor: req.agent, company: ticket.company });
  const ctx = await ticketService.buildTicketContext(ticket);
  try {
    await emailService.sendFromTemplate({
      key: 'ticket_response',
      to: ticket.user.email,
      data: ctx,
      event: 'ticket_response',
      ticket: ticket._id,
      user: ticket.user,
      company: ticket.company,
    });
  } catch (err) { /* non-blocking */ }
  const collabRecipients = (ticket.collaborators || []).filter((c) => c && String(c._id) !== String(ticket.user._id));
  for (const collab of collabRecipients) {
    try {
      await emailService.sendFromTemplate({
        key: 'ticket_response',
        to: collab.email,
        data: ctx,
        event: 'ticket_response',
        ticket: ticket._id,
        user: collab._id,
        company: ticket.company,
      });
    } catch (err) { /* non-blocking */ }
    await notifyUser({
      userId: collab._id,
      company: ticket.company,
      type: 'reply',
      message: `Ticket ${ticket.number} received a response`,
      link: `/ticket/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  await notifyUser({
    userId: ticket.user,
    company: ticket.company,
    type: 'reply',
    message: `Your ticket ${ticket.number} received a response`,
    link: `/ticket/${ticket.number}`,
    ticket: ticket._id,
  });
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Response posted', threads, ticket });
});

exports.addNote = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.note')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { message } = req.body;
  if (!message) throw new ApiError(422, 'Note is required');
  await ticketService.addThreadEntry({
    ticket,
    type: 'note',
    posterType: 'agent',
    agent: req.agent,
    title: 'Internal Note',
    body: message,
  });
  require('../services/audit.service').audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.note_added', entityType: 'ticket', entityId: ticket._id, after: { note: true }, req });
  await notifyMentionedAgents({ ticket, message, actor: req.agent, company: ticket.company });
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Note added', threads });
});

exports.assign = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.assign')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { agentId, teamId } = req.body;
  if (agentId === undefined && teamId === undefined) throw new ApiError(422, 'Select an agent or team to assign');
  const assignedTo = agentId ? await Agent.findOne({ _id: agentId, company: ticket.company, isActive: true }) : null;
  const assignedTeam = teamId ? await Team.findOne({ _id: teamId, company: ticket.company }) : null;
  if (agentId && !assignedTo) throw new ApiError(404, 'Agent not found in this tenant');
  if (teamId && !assignedTeam) throw new ApiError(404, 'Team not found in this tenant');
  ticket.agent = assignedTo?._id || null;
  ticket.team = assignedTeam?._id || null;
  if (assignedTo || assignedTeam) {
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
  } else {
    ticket.status = Ticket.STATUSES.OPEN;
    ticket.isOverdue = false;
  }
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Ticket assigned to ${assignedTo ? assignedTo.name : assignedTeam ? assignedTeam.name : 'nobody'} by ${req.agent.name}`,
  });
  require('../services/audit.service').audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.assigned', entityType: 'ticket', entityId: ticket._id, after: { agentId: assignedTo?._id || null, teamId: assignedTeam?._id || null }, req });
  emit('ticket.assigned', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, agentId: assignedTo?._id || null, teamId: assignedTeam?._id || null, actor: req.agent._id });
  if (assignedTo) {
    await notifyAgent({ agentId: assignedTo._id, company: ticket.company, type: 'assignment', message: `Ticket ${ticket.number} assigned to you`, link: `/tickets/${ticket.number}`, ticket: ticket._id });
    const ctx = await ticketService.buildTicketContext(ticket);
    try {
      await emailService.sendFromTemplate({ key: 'ticket_assigned', to: assignedTo.email, data: { ...ctx, recipient: { name: assignedTo.name } }, event: 'ticket_assigned', ticket: ticket._id, user: ticket.user, company: ticket.company });
    } catch (err) { /* non-blocking */ }
  }
  res.json({ success: true, message: 'Ticket assigned', ticket });
});

exports.transfer = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.transfer')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { deptId } = req.body;
  if (!deptId) throw new ApiError(422, 'Select a department to transfer to');
  const dept = await Department.findOne({ _id: deptId, company: ticket.company });
  if (!dept) throw new ApiError(404, 'Department not found in this tenant');
  ticket.dept = dept._id;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: `Ticket transferred to ${dept.name} by ${req.agent.name}` });
  require('../services/audit.service').audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.transferred', entityType: 'ticket', entityId: ticket._id, after: { deptId: dept._id, deptName: dept.name }, req });
  emit('ticket.transferred', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, deptId: dept._id, actor: req.agent._id });
  const deptAgents = await Agent.find({ 'departments.department': dept._id, isActive: true });
  for (const a of deptAgents) {
    await notifyAgent({ agentId: a._id, company: ticket.company, type: 'transfer', message: `Ticket ${ticket.number} transferred to ${dept.name}`, link: `/tickets/${ticket.number}`, ticket: ticket._id });
  }
  res.json({ success: true, message: 'Ticket transferred', ticket });
});

exports.changeStatus = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { status, closedReason } = req.body;
  const builtIn = [
    Ticket.STATUSES.OPEN,
    Ticket.STATUSES.ASSIGNED,
    Ticket.STATUSES.OVERDUE,
    Ticket.STATUSES.CLOSED,
    Ticket.STATUSES.ARCHIVED,
  ];
  const configured = await TicketStatus.find({ isActive: true }).select('key pauseSla isClosed');
  const valid = new Set([...builtIn, ...configured.map((s) => s.key)]);
  if (!valid.has(status)) throw new ApiError(422, 'Invalid status');
  const prev = ticket.status;
  ticket.status = status;
  if (status === Ticket.STATUSES.CLOSED) {
    ticket.closedAt = new Date();
    ticket.closedBy = req.agent._id;
    ticket.lockedBy = null;
    ticket.lockExpiresAt = null;
  } else if (status !== Ticket.STATUSES.CLOSED && prev === Ticket.STATUSES.CLOSED) {
    ticket.closedAt = null;
    ticket.closedBy = null;
    ticket.stats.reopened += 1;
  }

  // ---- Enterprise: SLA pause/resume on configurable statuses ----
  const statusDef = configured.find((s) => s.key === status);
  const { pauseSla, resumeSla } = require('../services/sla.service');
  if (statusDef && statusDef.pauseSla) {
    await pauseSla(ticket);
  } else if (ticket.slaPaused) {
    await resumeSla(ticket);
  }
  if (status === Ticket.STATUSES.CLOSED) {
    if (ticket.slaPaused) await resumeSla(ticket);
  }

  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Status changed from ${prev} to ${status}${closedReason ? ` (${closedReason})` : ''} by ${req.agent.name}`,
  });
  emit('ticket.status_changed', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, from: prev, to: status, actor: req.agent._id });
  if (status === Ticket.STATUSES.CLOSED) {
    const ctx = await ticketService.buildTicketContext(ticket);
    try {
      await emailService.sendFromTemplate({ key: 'ticket_closed', to: ticket.user.email, data: ctx, event: 'ticket_closed', ticket: ticket._id, user: ticket.user, company: ticket.company });
    } catch (err) { /* non-blocking */ }
    await notifyUser({ userId: ticket.user, company: ticket.company, type: 'status_change', message: `Your ticket ${ticket.number} has been closed`, link: `/ticket/${ticket.number}`, ticket: ticket._id });
    await ticketService.handleTicketClosed(ticket, { actor: req.agent._id });
  }
  if (status !== Ticket.STATUSES.CLOSED && prev === Ticket.STATUSES.CLOSED) {
    await ticketService.handleTicketReopened(ticket);
  }
  res.json({ success: true, message: 'Status updated', ticket });
});

exports.lockTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const settings = await SystemSetting.getSettings();
  const minutes = settings.system?.ticketLockMinutes || 5;
  const now = new Date();
  if (ticket.lockExpiresAt && ticket.lockExpiresAt <= now) {
    ticket.lockedBy = null;
    ticket.lockedAt = null;
    ticket.lockExpiresAt = null;
  }
  if (ticket.lockedBy && String(ticket.lockedBy) !== String(req.agent._id)) {
    const locker = await Agent.findById(ticket.lockedBy);
    throw new ApiError(423, `Ticket is locked by ${locker?.name || 'another agent'}`);
  }
  ticket.lockedBy = req.agent._id;
  ticket.lockedAt = now;
  ticket.lockExpiresAt = new Date(now.getTime() + minutes * 60 * 1000);
  await ticket.save();
  res.json({ success: true, message: 'Ticket locked', ticket });
});

exports.unlockTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  if (ticket.lockedBy && String(ticket.lockedBy) !== String(req.agent._id)) {
    const locker = await Agent.findById(ticket.lockedBy);
    throw new ApiError(423, `Ticket is locked by ${locker?.name || 'another agent'}`);
  }
  ticket.lockedBy = null;
  ticket.lockedAt = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  res.json({ success: true, message: 'Ticket unlocked', ticket });
});

exports.updateFields = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { subject, priority, dueDate, source } = req.body;
  const changed = [];
  if (subject !== undefined) {
    if (!String(subject).trim()) throw new ApiError(422, 'Subject cannot be empty');
    ticket.subject = String(subject).trim();
    changed.push('subject');
  }
  if (priority !== undefined) {
    await assertValidPriority(priority);
    ticket.priority = priority;
    changed.push('priority');
  }
  if (dueDate !== undefined) {
    ticket.dueDate = dueDate ? new Date(dueDate) : null;
    changed.push('due date');
  }
  if (source !== undefined) {
    if (!VALID_SOURCES.includes(source)) throw new ApiError(422, 'Invalid source');
    ticket.source = source;
    changed.push('source');
  }
  if (!changed.length) throw new ApiError(422, 'Nothing to update');
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Fields updated (${changed.join(', ')}) by ${req.agent.name}`,
  });
  res.json({ success: true, message: 'Ticket updated', ticket });
});

exports.claim = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.assign')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  if (ticket.agent && String(ticket.agent) !== String(req.agent._id)) {
    const holder = await Agent.findById(ticket.agent);
    throw new ApiError(409, `Ticket is already assigned to ${holder?.name || 'another agent'}`);
  }
  const claimed = !ticket.agent;
  ticket.agent = req.agent._id;
  ticket.team = null;
  ticket.status = Ticket.STATUSES.ASSIGNED;
  ticket.isOverdue = false;
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `${req.agent.name} ${claimed ? 'claimed' : 'took over'} this ticket`,
  });
  require('../services/audit.service').audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.claimed', entityType: 'ticket', entityId: ticket._id, after: { agentId: req.agent._id, claimed }, req });
  emit('ticket.claimed', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, agentId: req.agent._id, actor: req.agent._id });
  res.json({ success: true, message: 'Ticket claimed', ticket });
});

exports.create = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.create')) throw new ApiError(403, 'Permission denied');
  const { email, name, phone, subject, details, priority, topicId, deptId, source, customData } = req.body;
  if (!email) throw new ApiError(422, 'Customer email is required');
  if (!subject || !String(subject).trim()) throw new ApiError(422, 'Subject is required');
  const user = await ticketService.findOrCreateUser({
    name: name || email.split('@')[0],
    email,
    phone: phone || '',
    company: req.companyId,
  });
  let parsedCustom = {};
  if (customData) {
    try {
      parsedCustom = typeof customData === 'string' ? JSON.parse(customData) : customData;
    } catch (err) {
      throw new ApiError(422, 'Invalid custom field data');
    }
  }
  const ticket = await ticketService.createTicket({
    user,
    orgOwner: user._id,
    createdBy: user._id,
    subject: String(subject).trim(),
    details: details || '',
    topicId: topicId || undefined,
    deptId: deptId || undefined,
    priority: (priority && (await isValidPriority(priority))) ? priority : undefined,
    source: VALID_SOURCES.includes(source) ? source : 'web',
    customData: parsedCustom,
  });
  await ticketService.addSystemEvent({
    ticket,
    message: `Ticket opened by ${req.agent.name} on behalf of ${user.name}`,
  });
  res.status(201).json({ success: true, ticket });
});

exports.addCollaborator = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const { email, name } = req.body;
  if (!email) throw new ApiError(422, 'Email is required');
  const user = await ticketService.findOrCreateUser({
    name: name || email.split('@')[0],
    email,
    company: req.companyId,
  });
  if (String(ticket.user._id) === String(user._id)) {
    throw new ApiError(400, 'The ticket owner is already involved in this ticket');
  }
  const existing = (ticket.collaborators || []).some((c) => c && String(c._id) === String(user._id));
  if (existing) throw new ApiError(409, 'This user is already a collaborator');
  await Ticket.updateOne({ _id: ticket._id }, { $addToSet: { collaborators: user._id } });
  await ticketService.addSystemEvent({
    ticket,
    message: `${user.name} (${user.email}) added as collaborator by ${req.agent.name}`,
  });
  await notifyUser({
    userId: user._id,
    company: ticket.company,
    type: 'collaborator',
    message: `You have been added as a collaborator on ticket ${ticket.number}`,
    link: `/ticket/${ticket.number}`,
    ticket: ticket._id,
  });
  const updated = await Ticket.findById(ticket._id).populate('collaborators', 'name email');
  res.json({ success: true, message: 'Collaborator added', ticket: updated });
});

exports.removeCollaborator = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  await Ticket.updateOne({ _id: ticket._id }, { $pull: { collaborators: req.params.userId } });
  await ticketService.addSystemEvent({
    ticket,
    message: `Collaborator removed by ${req.agent.name}`,
  });
  const updated = await Ticket.findById(ticket._id).populate('collaborators', 'name email');
  res.json({ success: true, message: 'Collaborator removed', ticket: updated });
});

exports.workload = asyncHandler(async (req, res) => {
  const agent = req.agent;
  const comp = req.companyId ? { company: req.companyId } : {};
  const scope = scopeTicketQuery(agent, { status: { $nin: [Ticket.STATUSES.CLOSED, Ticket.STATUSES.ARCHIVED, Ticket.STATUSES.DELETED] } });
  const agents = await Agent.find({ isActive: true, ...comp }).select('name email').sort({ name: 1 });
  const counts = await Ticket.aggregate([
    { $match: scope },
    {
      $group: {
        _id: '$agent',
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', Ticket.STATUSES.OPEN] }, 1, 0] } },
        assigned: { $sum: { $cond: [{ $eq: ['$status', Ticket.STATUSES.ASSIGNED] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', Ticket.STATUSES.OVERDUE] }, 1, 0] } },
      },
    },
  ]);
  const byAgent = new Map(counts.map((c) => [String(c._id), c]));
  const rows = agents.map((a) => {
    const c = byAgent.get(String(a._id)) || { total: 0, open: 0, assigned: 0, overdue: 0 };
    return { agent: a, total: c.total, open: c.open, assigned: c.assigned, overdue: c.overdue };
  });
  res.json({ success: true, items: rows });
});

exports.listEscalations = asyncHandler(async (req, res) => {
  if (!canManageEscalations(req.agent)) throw new ApiError(403, 'Permission denied');
  const items = await EscalationRule.find(req.companyId ? { company: req.companyId } : {})
    .populate('department', 'name')
    .populate('action.reassignAgent', 'name')
    .populate('action.reassignTeam', 'name')
    .populate('action.notifyAgent', 'name')
    .sort({ createdAt: -1 });
  res.json({ success: true, items });
});

exports.createEscalation = asyncHandler(async (req, res) => {
  if (!canManageEscalations(req.agent)) throw new ApiError(403, 'Permission denied');
  const { name, department, priority, statuses, overdueMinutes, action, isActive } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(422, 'Rule name is required');
  if (priority && !(await isValidPriority(priority))) throw new ApiError(422, 'Invalid priority');
  if (action?.raisePriorityTo && !(await isValidPriority(action.raisePriorityTo))) throw new ApiError(422, 'Invalid raise priority');
  const rule = await EscalationRule.create({
    name: String(name).trim(),
    company: req.companyId,
    department: department || null,
    priority: priority || null,
    statuses: Array.isArray(statuses) && statuses.length ? statuses : ['open', 'assigned', 'overdue'],
    overdueMinutes: parseInt(overdueMinutes, 10) || 0,
    action: {
      raisePriorityTo: action?.raisePriorityTo || null,
      reassignAgent: action?.reassignAgent || null,
      reassignTeam: action?.reassignTeam || null,
      notifyAgent: action?.notifyAgent || null,
    },
    isActive: isActive !== false,
  });
  res.status(201).json({ success: true, rule });
});

exports.updateEscalation = asyncHandler(async (req, res) => {
  if (!canManageEscalations(req.agent)) throw new ApiError(403, 'Permission denied');
  const rule = await EscalationRule.findById(req.params.id);
  if (!rule) throw new ApiError(404, 'Escalation rule not found');
  if (req.companyId && String(rule.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, department, priority, statuses, overdueMinutes, action, isActive } = req.body;
  if (name !== undefined) rule.name = String(name).trim();
  if (department !== undefined) rule.department = department;
  if (priority !== undefined) rule.priority = priority;
  if (statuses !== undefined) rule.statuses = statuses;
  if (overdueMinutes !== undefined) rule.overdueMinutes = parseInt(overdueMinutes, 10) || 0;
  if (priority !== undefined && !(await isValidPriority(priority))) throw new ApiError(422, 'Invalid priority');
  if (action !== undefined) {
    rule.action = {
      raisePriorityTo: action.raisePriorityTo || null,
      reassignAgent: action.reassignAgent || null,
      reassignTeam: action.reassignTeam || null,
      notifyAgent: action.notifyAgent || null,
    };
  }
  if (isActive !== undefined) rule.isActive = isActive;
  await rule.save();
  res.json({ success: true, rule });
});

exports.deleteEscalation = asyncHandler(async (req, res) => {
  if (!canManageEscalations(req.agent)) throw new ApiError(403, 'Permission denied');
  const rule = await EscalationRule.findById(req.params.id);
  if (!rule) throw new ApiError(404, 'Escalation rule not found');
  if (req.companyId && String(rule.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  await rule.deleteOne();
  res.json({ success: true, message: 'Escalation rule deleted' });
});

exports.deleteTicket = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.delete')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  ticket.status = Ticket.STATUSES.DELETED;
  await ticket.save();
  res.json({ success: true, message: 'Ticket deleted' });
});

exports.addTask = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.tasks')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { title, description, assignedTo, dueDate } = req.body;
  if (!title) throw new ApiError(422, 'Task title is required');
  const task = await Task.create({
    ticket: ticket._id,
    company: ticket.company || req.companyId,
    title,
    description: description || '',
    assignedTo: assignedTo || null,
    createdBy: req.agent._id,
    dueDate: dueDate || null,
  });
  res.status(201).json({ success: true, task });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const task = await Task.findOne({ _id: req.params.taskId, ticket: ticket._id });
  if (!task) throw new ApiError(404, 'Task not found');
  const { title, description, assignedTo, dueDate, status } = req.body;
  if (title) task.title = title;
  if (description !== undefined) task.description = description;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (status !== undefined) {
    task.status = status;
    task.closedAt = status === 'closed' ? new Date() : null;
  }
  await task.save();
  res.json({ success: true, task });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search } = req.query;
  const query = {};
  if (req.companyId) query.company = req.companyId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(query).sort(getSortObj(sort)).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createUser = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'users.manage')) throw new ApiError(403, 'Permission denied');
  const { name, email, phone, organization, registerPassword } = req.body;
  if (!name || !email) throw new ApiError(422, 'Name and email are required');
  const user = await ticketService.findOrCreateUser({ name, email, phone, registerPassword, organization, company: req.companyId });
  res.status(201).json({ success: true, user });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (req.companyId && String(user.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const tickets = await Ticket.find({ user: user._id, ...(req.companyId ? { company: req.companyId } : {}), status: { $ne: Ticket.STATUSES.DELETED } })
    .sort({ updatedAt: -1 })
    .populate('dept', 'name')
    .populate('agent', 'name');
  res.json({ success: true, user, tickets });
});

exports.listOrgs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search } = req.query;
  const query = {};
  if (req.companyId) query.company = req.companyId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { domain: { $regex: search, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Organization.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('accountManager', 'name'),
    Organization.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createOrg = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'orgs.manage')) throw new ApiError(403, 'Permission denied');
  const { name, address, phone, website, domain, accountManager, notes } = req.body;
  if (!name) throw new ApiError(422, 'Organization name is required');
  const org = await Organization.create({ name, address, phone, website, domain, accountManager, notes, company: req.companyId });
  res.status(201).json({ success: true, org });
});

exports.getOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id).populate('accountManager', 'name');
  if (!org) throw new ApiError(404, 'Organization not found');
  if (req.companyId && String(org.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const users = await User.find({ organization: org._id, ...(req.companyId ? { company: req.companyId } : {}) }).select('name email phone');
  res.json({ success: true, org, users });
});

exports.listCanned = asyncHandler(async (req, res) => {
  const items = await CannedResponse.find(req.companyId ? { company: req.companyId } : {}).sort({ title: 1 });
  res.json({ success: true, items });
});

exports.createCanned = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'canned.manage')) throw new ApiError(403, 'Permission denied');
  const { title, response } = req.body;
  if (!title || !response) throw new ApiError(422, 'Title and response are required');
  const canned = await CannedResponse.create({ title, response, createdBy: req.agent._id, company: req.companyId });
  res.status(201).json({ success: true, canned });
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

exports.listFaqCategories = asyncHandler(async (req, res) => {
  const items = await FaqCategory.find(req.companyId ? { company: req.companyId } : {}).sort({ sortOrder: 1 });
  res.json({ success: true, items });
});

exports.createFaqCategory = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'kb.manage')) throw new ApiError(403, 'Permission denied');
  const { name, description, isPublic, sortOrder } = req.body;
  const cat = await FaqCategory.create({ name, description, isPublic: isPublic !== false, sortOrder: sortOrder || 0, createdBy: req.agent._id, company: req.companyId });
  res.status(201).json({ success: true, cat });
});

exports.listFaqs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search, category } = req.query;
  const query = {};
  if (req.companyId) query.company = req.companyId;
  if (search) query.question = { $regex: search, $options: 'i' };
  if (category) query.category = category;
  const [items, total] = await Promise.all([
    Faq.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('category', 'name'),
    Faq.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createFaq = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'kb.manage')) throw new ApiError(403, 'Permission denied');
  const { category, question, answer, keywords, isPublished } = req.body;
  if (!question || !answer) throw new ApiError(422, 'Question and answer are required');
  const faq = await Faq.create({
    category: category || null,
    company: req.companyId,
    question,
    answer,
    keywords: keywords || [],
    isPublished: isPublished !== false,
    createdBy: req.agent._id,
  });
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

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const items = await Announcement.find(req.companyId ? { company: req.companyId } : {}).sort({ createdAt: -1 });
  res.json({ success: true, items });
});

exports.createAnnouncement = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'kb.manage')) throw new ApiError(403, 'Permission denied');
  const { title, body, showDate, isActive } = req.body;
  if (!title || !body) throw new ApiError(422, 'Title and body are required');
  const ann = await Announcement.create({ title, body, showDate: showDate || null, isActive: isActive !== false, createdBy: req.agent._id, company: req.companyId });
  res.status(201).json({ success: true, ann });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  await Announcement.deleteOne({ _id: req.params.id, ...(req.companyId ? { company: req.companyId } : {}) });
  res.json({ success: true, message: 'Announcement deleted' });
});

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

exports.agentDirectory = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const agents = await Agent.find({ isActive: true, ...comp })
    .select('name email lastLogin')
    .sort({ name: 1 });
  const teams = await Team.find({ status: 'active', ...comp }).select('name members').populate('members', 'name');
  const departments = await Department.find({ status: 'active', ...comp }).select('name').sort({ name: 1 });
  res.json({ success: true, agents, teams, departments });
});

exports.directoryUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 30, sort: 'name' });
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

// ========================== Mention support ==========================
const extractMentionIds = async (message, actor) => {
  if (!message) return [];
  const comp = actor.company ? { company: actor.company, isActive: true } : { isActive: true };
  const ids = new Set();
  const emailRe = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const emails = (message.match(emailRe) || []).map((e) => e.toLowerCase());
  if (emails.length) {
    const byEmail = await require('../models/Agent').find({ ...comp, email: { $in: emails } }).select('_id');
    byEmail.forEach((a) => ids.add(String(a._id)));
  }
  const nameRe = /@([A-Za-z][\w.\-']*(?:\s+[A-Za-z][\w.\-']*)?)/g;
  const names = [];
  const matches = message.matchAll(nameRe);
  for (const m of matches) {
    const n = m[1].trim();
    if (!n) continue;
    if (n.includes('.') && !n.includes(' ')) continue;
    names.push(n);
  }
  const uniqueNames = [...new Set(names)].filter(Boolean);
  for (const n of uniqueNames) {
    const [a, ...rest] = n.split(/\s+/);
    const needle = rest.length ? `${a} ${rest.join(' ')}` : a;
    const found = await require('../models/Agent').findOne({
      ...comp,
      name: new RegExp(`^${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).select('_id');
    if (found) ids.add(String(found._id));
  }
  ids.delete(String(actor._id));
  return [...ids];
};

const notifyMentionedAgents = async ({ ticket, message, actor, company }) => {
  const ids = await extractMentionIds(message, actor);
  const { notifyAgent } = require('../services/notification.service');
  for (const agentId of ids) {
    await notifyAgent({
      agentId,
      company: company || null,
      type: 'mention',
      message: `${actor.name} mentioned you on ticket ${ticket.number}: ${String(message).slice(0, 80)}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
};

exports.mergeTickets = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const source = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(source, req.agent);
  const { targetNumber } = req.body;
  if (!targetNumber || String(targetNumber).toUpperCase() === source.number) {
    throw new ApiError(422, 'Select a different target ticket to merge into');
  }
  const target = await loadTicketForAgent(String(targetNumber).toUpperCase(), req.agent);
  assertNotLocked(target, req.agent);
  if (String(source.company || '') !== String(target.company || '')) {
    throw new ApiError(403, 'Cannot merge tickets across companies');
  }
  const TicketThreadModel = require('../models/TicketThread');
  const TicketLink = require('../models/TicketLink');
  await TicketThreadModel.updateMany({ ticket: source._id }, { $set: { ticket: target._id } });
  const collabs = new Set([...(target.collaborators || []).map((c) => String(c)), ...(source.collaborators || []).map((c) => String(c))]);
  target.collaborators = [...collabs].map((c) => require('mongoose').Types.ObjectId(c));
  await target.save();
  await TicketLink.create({ company: source.company, from: source._id, to: target._id, type: 'merged', createdBy: req.agent._id });
  await TicketLink.create({ company: target.company, from: target._id, to: source._id, type: 'merged', createdBy: req.agent._id });
  const prev = { number: source.number, status: source.status };
  source.status = Ticket.STATUSES.CLOSED;
  source.closedAt = new Date();
  source.closedBy = req.agent._id;
  source.lockedBy = null;
  source.lockExpiresAt = null;
  await source.save();
  await ticketService.addSystemEvent({ ticket: target, message: `Ticket ${source.number} merged into this ticket by ${req.agent.name}` });
  await ticketService.addSystemEvent({ ticket: source, message: `Ticket merged into ${target.number} by ${req.agent.name}` });
  const audit = require('../services/audit.service').audit;
  const meta = { company: source.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.merged', entityType: 'ticket', entityId: source._id, before: prev, after: { number: target.number, status: source.status }, req };
  await audit({ ...meta });
  await audit({ ...meta, after: { mergedFrom: source.number } });
  const bus = require('../services/events');
  bus.emit('ticket.merged', { company: source.company, ticketId: target._id, ticketNumber: target.number, mergedFrom: source.number, actor: req.agent._id });
  res.json({ success: true, message: `Ticket ${source.number} merged into ${target.number}`, ticket: target });
});

exports.splitTicket = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const source = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(source, req.agent);
  const { threadIds, subject } = req.body;
  if (!Array.isArray(threadIds) || !threadIds.length) throw new ApiError(422, 'Select at least one thread to split out');
  if (!subject || !String(subject).trim()) throw new ApiError(422, 'Subject is required for the new ticket');
  const TicketThreadModel = require('../models/TicketThread');
  const TicketLink = require('../models/TicketLink');
  const threads = await TicketThreadModel.find({ _id: { $in: threadIds }, ticket: source._id, deletedAt: null, type: 'message' });
  if (!threads.length) throw new ApiError(404, 'No matching message threads to split');
  const newTicket = await ticketService.createTicket({
    user: source.user,
    orgOwner: source.createdBy || source.user,
    subject: String(subject).trim(),
    details: '',
    topicId: source.topic || undefined,
    deptId: source.dept || undefined,
    priority: source.priority,
    sla: source.sla,
    source: 'web',
    skipRouting: true,
    audit: false,
  });
  const ids = threads.map((t) => t._id);
  await TicketThreadModel.updateMany({ _id: { $in: ids } }, { $set: { ticket: newTicket._id } });
  await TicketLink.create({ company: source.company, from: source._id, to: newTicket._id, type: 'parent', createdBy: req.agent._id });
  await TicketLink.create({ company: source.company, from: newTicket._id, to: source._id, type: 'child', createdBy: req.agent._id });
  await ticketService.addSystemEvent({ ticket: source, message: `${threads.length} message(s) split into new ticket ${newTicket.number} by ${req.agent.name}` });
  await ticketService.addSystemEvent({ ticket: newTicket, message: `Ticket split from ${source.number} by ${req.agent.name}` });
  const audit = require('../services/audit.service').audit;
  await audit({ company: source.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.split', entityType: 'ticket', entityId: source._id, after: { splitInto: newTicket.number, threads: threads.length }, req });
  const bus = require('../services/events');
  bus.emit('ticket.created', { company: source.company, ticketId: newTicket._id, ticketNumber: newTicket.number, actor: req.agent._id });
  res.status(201).json({ success: true, message: `Ticket ${newTicket.number} created from split`, ticket: newTicket });
});

exports.updateThread = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { body } = req.body;
  if (!body || !String(body).trim()) throw new ApiError(422, 'Message body is required');
  const TicketThreadModel = require('../models/TicketThread');
  const thread = await TicketThreadModel.findOne({ _id: req.params.threadId, ticket: ticket._id, deletedAt: null });
  if (!thread) throw new ApiError(404, 'Thread entry not found');
  if (thread.posterType === 'system') throw new ApiError(400, 'System events cannot be edited');
  thread.editHistory = thread.editHistory || [];
  thread.editHistory.push({ at: new Date(), by: req.agent._id, preview: String(thread.body).slice(0, 120) });
  thread.body = String(body).trim();
  thread.editedAt = new Date();
  thread.editedBy = req.agent._id;
  await thread.save();
  const audit = require('../services/audit.service').audit;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'thread.updated', entityType: 'ticket', entityId: ticket._id, after: { threadId: thread._id }, req });
  const threads = await TicketThreadModel.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Message updated', threads });
});

exports.deleteThread = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const TicketThreadModel = require('../models/TicketThread');
  const thread = await TicketThreadModel.findOne({ _id: req.params.threadId, ticket: ticket._id, deletedAt: null });
  if (!thread) throw new ApiError(404, 'Thread entry not found');
  if (thread.posterType === 'system') throw new ApiError(400, 'System events cannot be deleted');
  thread.deletedAt = new Date();
  thread.deletedBy = req.agent._id;
  await thread.save();
  if (thread.type === 'message' && thread.posterType === 'agent') {
    ticket.stats.messages = Math.max(0, (ticket.stats.messages || 0) - 1);
    await ticket.save().catch(() => {});
  }
  const audit = require('../services/audit.service').audit;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'thread.deleted', entityType: 'ticket', entityId: ticket._id, after: { threadId: thread._id, type: thread.type }, req });
  const threads = await TicketThreadModel.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Message deleted', threads });
});

exports.pauseSla = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { pauseSla } = require('../services/sla.service');
  const updated = await pauseSla(ticket);
  const audit = require('../services/audit.service').audit;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'sla.paused', entityType: 'ticket', entityId: ticket._id, after: { dueDate: updated.dueDate, waitingOn: updated.waitingOn }, req });
  res.json({ success: true, message: 'SLA timer paused', ticket: updated });
});

exports.resumeSla = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { resumeSla } = require('../services/sla.service');
  const updated = await resumeSla(ticket);
  const audit = require('../services/audit.service').audit;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'sla.resumed', entityType: 'ticket', entityId: ticket._id, after: { dueDate: updated.dueDate }, req });
  res.json({ success: true, message: 'SLA timer resumed', ticket: updated });
});

exports.listSavedQueues = asyncHandler(async (req, res) => {
  const SavedQueue = require('../models/SavedQueue');
  const items = await SavedQueue.find({ agent: req.agent._id }).sort({ name: 1 });
  res.json({ success: true, items });
});

exports.createSavedQueue = asyncHandler(async (req, res) => {
  const SavedQueue = require('../models/SavedQueue');
  const { name, filters } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(422, 'Queue name is required');
  const item = await SavedQueue.create({
    company: req.companyId,
    agent: req.agent._id,
    name: String(name).trim(),
    filters: filters || {},
  });
  res.status(201).json({ success: true, item });
});

exports.deleteSavedQueue = asyncHandler(async (req, res) => {
  const SavedQueue = require('../models/SavedQueue');
  await SavedQueue.deleteOne({ _id: req.params.id, agent: req.agent._id });
  res.json({ success: true, message: 'Queue removed' });
});

exports.exportTickets = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.view')) throw new ApiError(403, 'Permission denied');
  const { status, priority, dept, assignee, search, number, q } = req.query;
  const query = req.companyId ? { company: req.companyId } : {};
  const statusKey = status || q || (number ? null : 'active');
  if (statusKey && statusKey !== 'all' && statusKey !== 'active') query.status = statusKey;
  if (statusKey === 'all') { /* no status filter */ }
  if (priority && priority !== 'all') query.priority = priority;
  if (dept && dept !== 'all') query.dept = dept;
  if (assignee && assignee !== 'all') {
    if (assignee === 'unassigned') query.agent = null;
    else if (assignee === 'mine') query.agent = req.agent._id;
    else query.agent = assignee;
  }
  const s = search || number;
  if (s) {
    query.$or = [
      { number: { $regex: s, $options: 'i' } },
      { subject: { $regex: s, $options: 'i' } },
    ];
  }
  const tickets = await require('../models/Ticket').find(query)
    .sort({ updatedAt: -1 }).limit(5000)
    .populate('user', 'name email')
    .populate('dept', 'name')
    .populate('agent', 'name')
    .populate('team', 'name')
    .populate('topic', 'topic')
    .lean();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Number', 'Status', 'Priority', 'Subject', 'Customer Name', 'Customer Email', 'Department', 'Agent', 'Team', 'Help Topic', 'Source', 'Due Date', 'Created', 'Last Update', 'Closed At'];
  const rows = tickets.map((t) => [
    t.number, t.status, t.priority, t.subject, t.user?.name, t.user?.email, t.dept?.name, t.agent?.name, t.team?.name, t.topic?.topic, t.source,
    t.dueDate ? new Date(t.dueDate).toISOString() : '', t.createdAt ? new Date(t.createdAt).toISOString() : '', t.lastActivity ? new Date(t.lastActivity).toISOString() : '', t.closedAt ? new Date(t.closedAt).toISOString() : '',
  ].map(esc).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tickets-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});
