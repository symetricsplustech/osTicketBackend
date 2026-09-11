const Ticket = require('../../../models/helpdesk/tickets/Ticket');
const TicketThread = require('../../../models/helpdesk/tickets/TicketThread');
const Task = require('../../../models/Task');
const User = require('../../../models/User');
const Agent = require('../../../models/Agent');
const Team = require('../../../models/Team');
const Department = require('../../../models/Department');
const Organization = require('../../../models/Organization');
const CannedResponse = require('../../../models/helpdesk/knowledge/CannedResponse');
const FaqCategory = require('../../../models/helpdesk/knowledge/FaqCategory');
const Faq = require('../../../models/helpdesk/knowledge/Faq');
const Announcement = require('../../../models/helpdesk/knowledge/Announcement');
const Notification = require('../../../models/Notification');
const EscalationRule = require('../../../models/helpdesk/incidents/EscalationRule');
const SystemSetting = require('../../../models/SystemSetting');
const TicketStatus = require('../../../models/helpdesk/tickets/TicketStatus');
const ApiError = require('../../../utils/ApiError');
const asyncHandler = require('../../../utils/asyncHandler');
const { getPagination, getSortObj } = require('../../../utils/pagination');
const ticketService = require('../../../services/ticket.service');
const emailService = require('../../../services/email.service');
const { notifyAgent, notifyUser } = require('../../../services/notification.service');
const { emit } = require('../../../services/events');
const config = require('../../../config/config');
const { auditRequired } = require('../../../services/audit.service');

const { hasPermission: authzHasPermission, isAggregateAdmin, grantedScopes } = require('../../../services/authorization.service');
// Aggregate-admin bypass preserved (audited as admin_aggregate inside the
// service); exact-match semantics unchanged, plus explicit '!' DENY support.
const isAdminAgent = (agent) => isAggregateAdmin(agent);
const hasPerm = (agent, perm) => authzHasPermission(agent, perm);

const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Emergency'];
const VALID_SOURCES = ['web', 'email', 'phone', 'api'];
const { isValidPriority } = require('../../../services/priority.service');
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
  const scopes = grantedScopes(agent);
  if (isAdminAgent(agent) || scopes.includes('TENANT')) return query;
  const deptIds = getAgentDeptIds(agent);
  const teamIds = getAgentTeamIds(agent);
  const legacy = !agent.role;
  const visible = [];
  if (legacy || scopes.includes('ASSIGNED_TO_ME')) visible.push({ agent: agent._id });
  if (legacy || scopes.includes('DEPARTMENT')) visible.push({ dept: { $in: deptIds } });
  if (legacy || scopes.includes('TEAM')) visible.push({ team: { $in: teamIds } });
  if (scopes.includes('OWN')) visible.push({ createdBy: agent._id });
  query.$and = query.$and || [];
  // An empty scope set must return no records, not silently widen access.
  query.$and.push({ $or: visible.length ? visible : [{ _id: null }] });
  return query;
};


const toId = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const canAccessTicket = async (agent, ticket) => {
  if (isAdminAgent(agent)) return true;
  const scopes = grantedScopes(agent);
  if (scopes.includes('TENANT')) return true;
  const agentId = toId(agent?._id);
  const ticketAgent = toId(ticket.agent);
  const ticketDept = toId(ticket.dept);
  const ticketTeam = toId(ticket.team);
  // Agents without a migrated role retain the legacy assigned/team/department
  // scope. Role-backed agents are restricted to their declared recordScopes.
  const legacy = !agent.role;
  if ((legacy || scopes.includes('ASSIGNED_TO_ME')) && ticketAgent && ticketAgent === agentId) return true;
  if ((legacy || scopes.includes('DEPARTMENT')) && ticketDept && getAgentDeptIds(agent).includes(ticketDept)) return true;
  if ((legacy || scopes.includes('TEAM')) && ticketTeam && getAgentTeamIds(agent).includes(ticketTeam)) return true;
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


// ========================== Dashboard and queues ==========================




// ========================== Ticket operations ==========================




























// ========================== Workload ==========================


// ========================== Escalations ==========================










// ========================== Ticket tasks ==========================




// ========================== Users and organizations ==========================












// ========================== Canned responses ==========================








// Render a canned response with ticket variables (§38). Supports both the
// platform `%{ticket.number}` syntax and `{{customer.name}}` style.


// ========================== Knowledge base ==========================












// Knowledge lifecycle transition (MD ITSM-08): draft -> review -> approved
// -> published, with expiry/retire/archive paths. Keeps the legacy
// isPublished flag in sync so older readers keep working.


// ========================== Announcements ==========================






// ========================== Notifications and directory ==========================










// ========================== Mention support ==========================
const extractMentionIds = async (message, actor) => {
  if (!message) return [];
  const comp = actor.company ? { company: actor.company, isActive: true } : { isActive: true };
  const ids = new Set();
  const emailRe = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const emails = (message.match(emailRe) || []).map((e) => e.toLowerCase());
  if (emails.length) {
    const byEmail = await require('../../../models/Agent').find({ ...comp, email: { $in: emails } }).select('_id');
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
    const found = await require('../../../models/Agent').findOne({
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
  const { notifyAgent } = require('../../../services/notification.service');
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













// ========================== Saved queues and export ==========================









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
  const TicketThreadModel = require('../../../models/helpdesk/tickets/TicketThread');
  const TicketLink = require('../../../models/helpdesk/tickets/TicketLink');
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
  const audit = auditRequired;
  const meta = { company: source.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.merged', entityType: 'ticket', entityId: source._id, before: prev, after: { number: target.number, status: source.status }, req };
  await audit({ ...meta });
  await audit({ ...meta, after: { mergedFrom: source.number } });
  const bus = require('../../../services/events');
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
  const TicketThreadModel = require('../../../models/helpdesk/tickets/TicketThread');
  const TicketLink = require('../../../models/helpdesk/tickets/TicketLink');
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
    auditActorType: 'agent',
    auditActorId: req.agent._id,
    auditActorName: req.agent.name,
    req,
  });
  const ids = threads.map((t) => t._id);
  await TicketThreadModel.updateMany({ _id: { $in: ids } }, { $set: { ticket: newTicket._id } });
  await TicketLink.create({ company: source.company, from: source._id, to: newTicket._id, type: 'parent', createdBy: req.agent._id });
  await TicketLink.create({ company: source.company, from: newTicket._id, to: source._id, type: 'child', createdBy: req.agent._id });
  await ticketService.addSystemEvent({ ticket: source, message: `${threads.length} message(s) split into new ticket ${newTicket.number} by ${req.agent.name}` });
  await ticketService.addSystemEvent({ ticket: newTicket, message: `Ticket split from ${source.number} by ${req.agent.name}` });
  const audit = auditRequired;
  await audit({ company: source.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'ticket.split', entityType: 'ticket', entityId: source._id, after: { splitInto: newTicket.number, threads: threads.length }, req });
  const bus = require('../../../services/events');
  bus.emit('ticket.created', { company: source.company, ticketId: newTicket._id, ticketNumber: newTicket.number, actor: req.agent._id });
  res.status(201).json({ success: true, message: `Ticket ${newTicket.number} created from split`, ticket: newTicket });
});
exports.updateThread = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { body } = req.body;
  if (!body || !String(body).trim()) throw new ApiError(422, 'Message body is required');
  const TicketThreadModel = require('../../../models/helpdesk/tickets/TicketThread');
  const thread = await TicketThreadModel.findOne({ _id: req.params.threadId, ticket: ticket._id, deletedAt: null });
  if (!thread) throw new ApiError(404, 'Thread entry not found');
  if (thread.posterType === 'system') throw new ApiError(400, 'System events cannot be edited');
  thread.editHistory = thread.editHistory || [];
  thread.editHistory.push({ at: new Date(), by: req.agent._id, preview: String(thread.body).slice(0, 120) });
  thread.body = String(body).trim();
  thread.editedAt = new Date();
  thread.editedBy = req.agent._id;
  await thread.save();
  const audit = auditRequired;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'thread.updated', entityType: 'ticket', entityId: ticket._id, after: { threadId: thread._id }, req });
  const threads = await TicketThreadModel.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Message updated', threads });
});
exports.deleteThread = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, 'tickets.edit')) throw new ApiError(403, 'Permission denied');
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const TicketThreadModel = require('../../../models/helpdesk/tickets/TicketThread');
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
  const audit = auditRequired;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'thread.deleted', entityType: 'ticket', entityId: ticket._id, after: { threadId: thread._id, type: thread.type }, req });
  const threads = await TicketThreadModel.find({ ticket: ticket._id, deletedAt: null }).sort({ createdAt: 1 }).populate('user', 'name email').populate('agent', 'name');
  res.json({ success: true, message: 'Message deleted', threads });
});
exports.pauseSla = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { pauseSla } = require('../../../services/sla.service');
  const updated = await pauseSla(ticket);
  const audit = auditRequired;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'sla.paused', entityType: 'ticket', entityId: ticket._id, after: { dueDate: updated.dueDate, waitingOn: updated.waitingOn }, req });
  res.json({ success: true, message: 'SLA timer paused', ticket: updated });
});
exports.resumeSla = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { resumeSla } = require('../../../services/sla.service');
  const updated = await resumeSla(ticket);
  const audit = auditRequired;
  await audit({ company: ticket.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'sla.resumed', entityType: 'ticket', entityId: ticket._id, after: { dueDate: updated.dueDate }, req });
  res.json({ success: true, message: 'SLA timer resumed', ticket: updated });
});
