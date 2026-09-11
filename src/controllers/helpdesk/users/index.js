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
