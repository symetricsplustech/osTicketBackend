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
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const ticketService = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { notifyAgent, notifyUser } = require('../services/notification.service');
const config = require('../config/config');

const isAdminAgent = (agent) => agent.isAdmin || (agent.role && agent.role.isAdmin);
const hasPerm = (agent, perm) => {
  if (isAdminAgent(agent)) return true;
  return new Set([...(agent.permissions || []), ...(agent.role?.permissions || [])]).has(perm);
};

const getAgentDeptIds = (agent) => (agent.departments || []).map((d) => String(d.department)).filter(Boolean);
const getAgentTeamIds = (agent) => (agent.teams || []).map((t) => String(t));

const scopeTicketQuery = (agent, query = {}) => {
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

const canAccessTicket = async (agent, ticket) => {
  if (isAdminAgent(agent) || hasPerm(agent, 'tickets.view')) return true;
  if (ticket.agent && String(ticket.agent) === String(agent._id)) return true;
  if (ticket.dept && getAgentDeptIds(agent).includes(String(ticket.dept))) return true;
  if (ticket.team && getAgentTeamIds(agent).includes(String(ticket.team))) return true;
  return false;
};

const loadTicketForAgent = async (number, agent, opts = {}) => {
  const query = { number: String(number).trim().toUpperCase(), status: { $ne: Ticket.STATUSES.DELETED } };
  const ticket = await Ticket.findOne(query)
    .populate('user')
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name email')
    .populate('team', 'name')
    .populate('sla', 'name');
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
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null })
    .sort({ createdAt: 1 })
    .populate('user', 'name email')
    .populate('agent', 'name');
  const tasks = await Task.find({ ticket: ticket._id }).sort({ createdAt: -1 }).populate('assignedTo', 'name').populate('createdBy', 'name');
  const canned = await CannedResponse.find({ status: 'active' }).sort({ title: 1 });
  const agents = await Agent.find({ isActive: true }).select('name email').sort({ name: 1 });
  const teams = await Team.find({ status: 'active' }).select('name').sort({ name: 1 });
  const depts = await Department.find({ status: 'active' }).select('name').sort({ name: 1 });
  const topics = await require('../models/HelpTopic').find({ status: 'active' }).select('topic').sort({ topic: 1 });
  res.json({ success: true, ticket, threads, tasks, canned, agents, teams, depts, topics });
});

exports.reply = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.reply')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
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
  const ctx = await ticketService.buildTicketContext(ticket);
  try {
    await emailService.sendFromTemplate({
      key: 'ticket_response',
      to: ticket.user.email,
      data: ctx,
      event: 'ticket_response',
      ticket: ticket._id,
      user: ticket.user,
    });
  } catch (err) { /* non-blocking */ }
  await notifyUser({
    userId: ticket.user,
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
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Note added', threads });
});

exports.assign = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.assign')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const { agentId, teamId } = req.body;
  if (!agentId && !teamId) throw new ApiError(422, 'Select an agent or team to assign');
  const assignedTo = agentId ? await Agent.findById(agentId) : null;
  const assignedTeam = teamId ? await Team.findById(teamId) : null;
  ticket.agent = assignedTo?._id || null;
  ticket.team = assignedTeam?._id || null;
  if (assignedTo || assignedTeam) {
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
  }
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Ticket assigned to ${assignedTo ? assignedTo.name : assignedTeam ? assignedTeam.name : 'nobody'} by ${req.agent.name}`,
  });
  if (assignedTo) {
    await notifyAgent({ agentId: assignedTo._id, type: 'assignment', message: `Ticket ${ticket.number} assigned to you`, link: `/tickets/${ticket.number}`, ticket: ticket._id });
    const ctx = await ticketService.buildTicketContext(ticket);
    try {
      await emailService.sendFromTemplate({ key: 'ticket_assigned', to: assignedTo.email, data: { ...ctx, recipient: { name: assignedTo.name } }, event: 'ticket_assigned', ticket: ticket._id, user: ticket.user });
    } catch (err) { /* non-blocking */ }
  }
  res.json({ success: true, message: 'Ticket assigned', ticket });
});

exports.transfer = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.transfer')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const { deptId } = req.body;
  if (!deptId) throw new ApiError(422, 'Select a department to transfer to');
  const dept = await Department.findById(deptId);
  if (!dept) throw new ApiError(404, 'Department not found');
  ticket.dept = dept._id;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: `Ticket transferred to ${dept.name} by ${req.agent.name}` });
  const deptAgents = await Agent.find({ 'departments.department': dept._id, isActive: true });
  for (const a of deptAgents) {
    await notifyAgent({ agentId: a._id, type: 'transfer', message: `Ticket ${ticket.number} transferred to ${dept.name}`, link: `/tickets/${ticket.number}`, ticket: ticket._id });
  }
  res.json({ success: true, message: 'Ticket transferred', ticket });
});

exports.changeStatus = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const { status, closedReason } = req.body;
  const valid = [
    Ticket.STATUSES.OPEN,
    Ticket.STATUSES.ASSIGNED,
    Ticket.STATUSES.OVERDUE,
    Ticket.STATUSES.CLOSED,
    Ticket.STATUSES.ARCHIVED,
  ];
  if (!valid.includes(status)) throw new ApiError(422, 'Invalid status');
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
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Status changed from ${prev} to ${status}${closedReason ? ` (${closedReason})` : ''} by ${req.agent.name}`,
  });
  if (status === Ticket.STATUSES.CLOSED) {
    const ctx = await ticketService.buildTicketContext(ticket);
    try {
      await emailService.sendFromTemplate({ key: 'ticket_closed', to: ticket.user.email, data: ctx, event: 'ticket_closed', ticket: ticket._id, user: ticket.user });
    } catch (err) { /* non-blocking */ }
    await notifyUser({ userId: ticket.user, type: 'status_change', message: `Your ticket ${ticket.number} has been closed`, link: `/ticket/${ticket.number}`, ticket: ticket._id });
  }
  res.json({ success: true, message: 'Status updated', ticket });
});

exports.lockTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const settings = require('../models/SystemSetting').getSettings ? await require('../models/SystemSetting').getSettings() : {};
  const minutes = settings.system?.ticketLockMinutes || 5;
  const now = new Date();
  if (ticket.lockedBy && String(ticket.lockedBy) !== String(req.agent._id) && ticket.lockExpiresAt > now) {
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
  ticket.lockedBy = null;
  ticket.lockedAt = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  res.json({ success: true, message: 'Ticket unlocked', ticket });
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
  const { title, description, assignedTo, dueDate } = req.body;
  if (!title) throw new ApiError(422, 'Task title is required');
  const task = await Task.create({
    ticket: ticket._id,
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
  const user = await ticketService.findOrCreateUser({ name, email, phone, registerPassword, organization });
  res.status(201).json({ success: true, user });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const tickets = await Ticket.find({ user: user._id, status: { $ne: Ticket.STATUSES.DELETED } })
    .sort({ updatedAt: -1 })
    .populate('dept', 'name')
    .populate('agent', 'name');
  res.json({ success: true, user, tickets });
});

exports.listOrgs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search } = req.query;
  const query = {};
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
  const org = await Organization.create({ name, address, phone, website, domain, accountManager, notes });
  res.status(201).json({ success: true, org });
});

exports.getOrg = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id).populate('accountManager', 'name');
  if (!org) throw new ApiError(404, 'Organization not found');
  const users = await User.find({ organization: org._id }).select('name email phone');
  res.json({ success: true, org, users });
});

exports.listCanned = asyncHandler(async (req, res) => {
  const items = await CannedResponse.find().sort({ title: 1 });
  res.json({ success: true, items });
});

exports.createCanned = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'canned.manage')) throw new ApiError(403, 'Permission denied');
  const { title, response } = req.body;
  if (!title || !response) throw new ApiError(422, 'Title and response are required');
  const canned = await CannedResponse.create({ title, response, createdBy: req.agent._id });
  res.status(201).json({ success: true, canned });
});

exports.updateCanned = asyncHandler(async (req, res) => {
  const canned = await CannedResponse.findById(req.params.id);
  if (!canned) throw new ApiError(404, 'Canned response not found');
  const { title, response, status } = req.body;
  if (title) canned.title = title;
  if (response !== undefined) canned.response = response;
  if (status !== undefined) canned.status = status;
  await canned.save();
  res.json({ success: true, canned });
});

exports.deleteCanned = asyncHandler(async (req, res) => {
  await CannedResponse.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Canned response deleted' });
});

exports.listFaqCategories = asyncHandler(async (req, res) => {
  const items = await FaqCategory.find().sort({ sortOrder: 1 });
  res.json({ success: true, items });
});

exports.createFaqCategory = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'kb.manage')) throw new ApiError(403, 'Permission denied');
  const { name, description, isPublic, sortOrder } = req.body;
  const cat = await FaqCategory.create({ name, description, isPublic: isPublic !== false, sortOrder: sortOrder || 0, createdBy: req.agent._id });
  res.status(201).json({ success: true, cat });
});

exports.listFaqs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const { search, category } = req.query;
  const query = {};
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
  await Faq.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'FAQ deleted' });
});

exports.listAnnouncements = asyncHandler(async (req, res) => {
  const items = await Announcement.find().sort({ createdAt: -1 });
  res.json({ success: true, items });
});

exports.createAnnouncement = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'kb.manage')) throw new ApiError(403, 'Permission denied');
  const { title, body, showDate, isActive } = req.body;
  if (!title || !body) throw new ApiError(422, 'Title and body are required');
  const ann = await Announcement.create({ title, body, showDate: showDate || null, isActive: isActive !== false, createdBy: req.agent._id });
  res.status(201).json({ success: true, ann });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
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

exports.agentDirectory = asyncHandler(async (req, res) => {
  const agents = await Agent.find({ isActive: true })
    .select('name email lastLogin')
    .sort({ name: 1 });
  const teams = await Team.find({ status: 'active' }).select('name members').populate('members', 'name');
  res.json({ success: true, agents, teams });
});

exports.directoryUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 30, sort: 'name' });
  const { search } = req.query;
  const query = {};
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const [items, total] = await Promise.all([
    User.find(query).sort(getSortObj(sort)).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
