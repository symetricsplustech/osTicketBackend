const Ticket = require("../../../models/helpdesk/tickets/Ticket");
const TicketThread = require("../../../models/helpdesk/tickets/TicketThread");
const Task = require("../../../models/Task");
const User = require("../../../models/User");
const Agent = require("../../../models/Agent");
const Team = require("../../../models/Team");
const Department = require("../../../models/Department");
const Organization = require("../../../models/Organization");
const CannedResponse = require("../../../models/helpdesk/knowledge/CannedResponse");
const FaqCategory = require("../../../models/helpdesk/knowledge/FaqCategory");
const Faq = require("../../../models/helpdesk/knowledge/Faq");
const Announcement = require("../../../models/helpdesk/knowledge/Announcement");
const Notification = require("../../../models/Notification");
const EscalationRule = require("../../../models/helpdesk/incidents/EscalationRule");
const SystemSetting = require("../../../models/SystemSetting");
const TicketStatus = require("../../../models/helpdesk/tickets/TicketStatus");
const ApiError = require("../../../utils/ApiError");
const asyncHandler = require("../../../utils/asyncHandler");
const { getPagination, getSortObj } = require("../../../utils/pagination");
const ticketService = require("../../../services/ticket.service");
const emailService = require("../../../services/email.service");
const {
  notifyAgent,
  notifyUser,
} = require("../../../services/notification.service");
const { emit } = require("../../../services/events");
const config = require("../../../config/config");
const { auditRequired } = require("../../../services/audit.service");

const {
  hasPermission: authzHasPermission,
  isAggregateAdmin,
  grantedScopes,
} = require("../../../services/authorization.service");
// Aggregate-admin bypass preserved (audited as admin_aggregate inside the
// service); exact-match semantics unchanged, plus explicit '!' DENY support.
const isAdminAgent = (agent) => isAggregateAdmin(agent);
const hasPerm = (agent, perm) => authzHasPermission(agent, perm);

const VALID_PRIORITIES = ["Low", "Normal", "High", "Emergency"];
const VALID_SOURCES = ["web", "email", "phone", "api"];
const { isValidPriority } = require("../../../services/priority.service");
const assertValidPriority = async (value, msg = "Invalid priority") => {
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
    throw new ApiError(423, "This ticket is locked by another agent");
  }
};

const canManageEscalations = (agent) =>
  isAdminAgent(agent) || hasPerm(agent, "escalations.manage");

const getAgentDeptIds = (agent) =>
  (agent.departments || []).map((d) => String(d.department)).filter(Boolean);
const getAgentTeamIds = (agent) => (agent.teams || []).map((t) => String(t));

const scopeTicketQuery = (agent, query = {}) => {
  if (agent.company) query.company = agent.company;
  const scopes = grantedScopes(agent);
  if (isAdminAgent(agent) || scopes.includes("TENANT")) return query;
  const deptIds = getAgentDeptIds(agent);
  const teamIds = getAgentTeamIds(agent);
  const legacy = !agent.role;
  const visible = [];
  if (legacy || scopes.includes("ASSIGNED_TO_ME"))
    visible.push({ agent: agent._id });
  if (legacy || scopes.includes("DEPARTMENT"))
    visible.push({ dept: { $in: deptIds } });
  if (legacy || scopes.includes("TEAM"))
    visible.push({ team: { $in: teamIds } });
  if (scopes.includes("OWN")) visible.push({ createdBy: agent._id });
  query.$and = query.$and || [];
  // An empty scope set must return no records, not silently widen access.
  query.$and.push({ $or: visible.length ? visible : [{ _id: null }] });
  return query;
};

const toId = (value) => {
  if (value == null) return null;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
};

const canAccessTicket = async (agent, ticket) => {
  if (isAdminAgent(agent)) return true;
  const scopes = grantedScopes(agent);
  if (scopes.includes("TENANT")) return true;
  const agentId = toId(agent?._id);
  const ticketAgent = toId(ticket.agent);
  const ticketDept = toId(ticket.dept);
  const ticketTeam = toId(ticket.team);
  // Agents without a migrated role retain the legacy assigned/team/department
  // scope. Role-backed agents are restricted to their declared recordScopes.
  const legacy = !agent.role;
  if (
    (legacy || scopes.includes("ASSIGNED_TO_ME")) &&
    ticketAgent &&
    ticketAgent === agentId
  )
    return true;
  if (
    (legacy || scopes.includes("DEPARTMENT")) &&
    ticketDept &&
    getAgentDeptIds(agent).includes(ticketDept)
  )
    return true;
  if (
    (legacy || scopes.includes("TEAM")) &&
    ticketTeam &&
    getAgentTeamIds(agent).includes(ticketTeam)
  )
    return true;
  return false;
};

const loadTicketForAgent = async (number, agent, opts = {}) => {
  const query = {
    number: String(number).trim().toUpperCase(),
    status: { $ne: Ticket.STATUSES.DELETED },
  };
  if (agent.company) query.company = agent.company;
  const ticket = await Ticket.findOne(query)
    .populate("user")
    .populate("dept", "name")
    .populate("topic", "topic")
    .populate("agent", "name email")
    .populate("team", "name")
    .populate("sla", "name")
    .populate("collaborators", "name email");
  if (!ticket) throw new ApiError(404, "Ticket not found");
  if (!opts.skipAccess && !(await canAccessTicket(agent, ticket))) {
    throw new ApiError(403, "You do not have access to this ticket");
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
  const comp = actor.company
    ? { company: actor.company, isActive: true }
    : { isActive: true };
  const ids = new Set();
  const emailRe = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const emails = (message.match(emailRe) || []).map((e) => e.toLowerCase());
  if (emails.length) {
    const byEmail = await require("../../../models/Agent")
      .find({ ...comp, email: { $in: emails } })
      .select("_id");
    byEmail.forEach((a) => ids.add(String(a._id)));
  }
  const nameRe = /@([A-Za-z][\w.\-']*(?:\s+[A-Za-z][\w.\-']*)?)/g;
  const names = [];
  const matches = message.matchAll(nameRe);
  for (const m of matches) {
    const n = m[1].trim();
    if (!n) continue;
    if (n.includes(".") && !n.includes(" ")) continue;
    names.push(n);
  }
  const uniqueNames = [...new Set(names)].filter(Boolean);
  for (const n of uniqueNames) {
    const [a, ...rest] = n.split(/\s+/);
    const needle = rest.length ? `${a} ${rest.join(" ")}` : a;
    const found = await require("../../../models/Agent")
      .findOne({
        ...comp,
        name: new RegExp(
          `^${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i",
        ),
      })
      .select("_id");
    if (found) ids.add(String(found._id));
  }
  ids.delete(String(actor._id));
  return [...ids];
};

const notifyMentionedAgents = async ({ ticket, message, actor, company }) => {
  const ids = await extractMentionIds(message, actor);
  const { notifyAgent } = require("../../../services/notification.service");
  for (const agentId of ids) {
    await notifyAgent({
      agentId,
      company: company || null,
      type: "mention",
      message: `${actor.name} mentioned you on ticket ${ticket.number}: ${String(message).slice(0, 80)}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
};

// ========================== Saved queues and export ==========================

exports.listTickets = asyncHandler(async (req, res) => {
  const agent = req.agent;
  const { page, limit, skip, sort } = getPagination(req, {
    page: 1,
    limit: 20,
    sort: "-updatedAt",
  });
  const { status, priority, dept, assignee, search, number, q } = req.query;
  const query = { status: { $ne: Ticket.STATUSES.DELETED } };

  if (status && status !== "all") {
    if (status === "mine") {
      query.status = {
        $in: [
          Ticket.STATUSES.OPEN,
          Ticket.STATUSES.ASSIGNED,
          Ticket.STATUSES.OVERDUE,
        ],
      };
      query.$or = [
        { agent: agent._id },
        { team: { $in: getAgentTeamIds(agent) } },
      ];
    } else if (status === "unassigned") {
      query.agent = null;
      query.team = null;
      query.status = { $in: [Ticket.STATUSES.OPEN, Ticket.STATUSES.ASSIGNED] };
    } else {
      query.status = status;
    }
  }
  if (priority && priority !== "all") query.priority = priority;
  if (dept && dept !== "all") query.dept = dept;
  if (assignee && assignee !== "all") {
    if (assignee === "me") query.agent = agent._id;
    else query.agent = assignee;
  }
  if (number) query.number = String(number).trim().toUpperCase();
  if (search || q) {
    const s = search || q;
    query.$or = [
      { number: { $regex: s, $options: "i" } },
      { subject: { $regex: s, $options: "i" } },
    ];
  }

  scopeTicketQuery(agent, query);

  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort(getSortObj(sort))
      .skip(skip)
      .limit(limit)
      .populate("user", "name email")
      .populate("dept", "name")
      .populate("topic", "topic")
      .populate("agent", "name")
      .populate("team", "name"),
    Ticket.countDocuments(query),
  ]);

  res.json({
    success: true,
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});
exports.getTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  await Ticket.populate(ticket, { path: "lockedBy", select: "name" });
  const threads = await TicketThread.find({
    ticket: ticket._id,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .populate("user", "name email")
    .populate("agent", "name");
  const tasks = await Task.find({ ticket: ticket._id })
    .sort({ createdAt: -1 })
    .populate("assignedTo", "name")
    .populate("createdBy", "name");
  const comp = req.companyId ? { company: req.companyId } : {};
  const canned = await CannedResponse.find({ status: "active", ...comp }).sort({
    title: 1,
  });
  const agents = await Agent.find({ isActive: true, ...comp })
    .select("name email")
    .sort({ name: 1 });
  const teams = await Team.find({ status: "active", ...comp })
    .select("name")
    .sort({ name: 1 });
  const depts = await Department.find({ status: "active", ...comp })
    .select("name")
    .sort({ name: 1 });
  const topics = await require("../../../models/HelpTopic")
    .find({ status: "active", ...comp })
    .select("topic")
    .sort({ topic: 1 });
  const statuses = await TicketStatus.find({ isActive: true })
    .select("name key color isDefault sortOrder")
    .sort({ sortOrder: 1 });
  res.json({
    success: true,
    ticket,
    threads,
    tasks,
    canned,
    agents,
    teams,
    depts,
    topics,
    statuses,
  });
});
exports.reply = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.reply"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { message } = req.body;
  if (!message) throw new ApiError(422, "Message is required");
  const attachments = (req.files || []).map((f) => ({
    filename: f.originalname,
    path: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));
  await ticketService.addThreadEntry({
    ticket,
    type: "message",
    posterType: "agent",
    agent: req.agent,
    body: message,
    attachments,
    auditContext: {
      actorType: "agent",
      actorId: req.agent._id,
      actorName: req.agent.name,
      req,
    },
  });
  await ticketService.addSystemEvent({
    ticket,
    message: `Response posted by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.replied",
    entityType: "ticket",
    entityId: ticket._id,
    after: {
      attachmentCount: attachments.length,
      hasAttachments: attachments.length > 0,
    },
    req,
  });
  await notifyMentionedAgents({
    ticket,
    message,
    actor: req.agent,
    company: ticket.company,
  });
  const ctx = await ticketService.buildTicketContext(ticket);
  try {
    await emailService.sendFromTemplate({
      key: "ticket_response",
      to: ticket.user.email,
      data: ctx,
      event: "ticket_response",
      ticket: ticket._id,
      user: ticket.user,
      company: ticket.company,
    });
  } catch (err) {
    /* non-blocking */
  }
  const collabRecipients = (ticket.collaborators || []).filter(
    (c) => c && String(c._id) !== String(ticket.user._id),
  );
  for (const collab of collabRecipients) {
    try {
      await emailService.sendFromTemplate({
        key: "ticket_response",
        to: collab.email,
        data: ctx,
        event: "ticket_response",
        ticket: ticket._id,
        user: collab._id,
        company: ticket.company,
      });
    } catch (err) {
      /* non-blocking */
    }
    await notifyUser({
      userId: collab._id,
      company: ticket.company,
      type: "reply",
      message: `Ticket ${ticket.number} received a response`,
      link: `/ticket/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  await notifyUser({
    userId: ticket.user,
    company: ticket.company,
    type: "reply",
    message: `Your ticket ${ticket.number} received a response`,
    link: `/ticket/${ticket.number}`,
    ticket: ticket._id,
  });
  const threads = await TicketThread.find({
    ticket: ticket._id,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .populate("user", "name email")
    .populate("agent", "name");
  res.json({ success: true, message: "Response posted", threads, ticket });
});
exports.addNote = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.note"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { message } = req.body;
  if (!message) throw new ApiError(422, "Note is required");
  await ticketService.addThreadEntry({
    ticket,
    type: "note",
    posterType: "agent",
    agent: req.agent,
    title: "Internal Note",
    body: message,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.note_added",
    entityType: "ticket",
    entityId: ticket._id,
    after: { note: true },
    req,
  });
  emit("ticket.note_added", {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    actor: req.agent._id,
  });
  await notifyMentionedAgents({
    ticket,
    message,
    actor: req.agent,
    company: ticket.company,
  });
  const threads = await TicketThread.find({
    ticket: ticket._id,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .populate("user", "name email")
    .populate("agent", "name");
  res.json({ success: true, message: "Note added", threads });
});
exports.assign = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.assign"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { agentId, teamId } = req.body;
  if (agentId === undefined && teamId === undefined)
    throw new ApiError(422, "Select an agent or team to assign");
  const assignedTo = agentId
    ? await Agent.findOne({
        _id: agentId,
        company: ticket.company,
        isActive: true,
      })
    : null;
  const assignedTeam = teamId
    ? await Team.findOne({ _id: teamId, company: ticket.company })
    : null;
  if (agentId && !assignedTo)
    throw new ApiError(404, "Agent not found in this tenant");
  if (teamId && !assignedTeam)
    throw new ApiError(404, "Team not found in this tenant");
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
    message: `Ticket assigned to ${assignedTo ? assignedTo.name : assignedTeam ? assignedTeam.name : "nobody"} by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.assigned",
    entityType: "ticket",
    entityId: ticket._id,
    after: {
      agentId: assignedTo?._id || null,
      teamId: assignedTeam?._id || null,
    },
    req,
  });
  emit("ticket.assigned", {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    agentId: assignedTo?._id || null,
    teamId: assignedTeam?._id || null,
    actor: req.agent._id,
  });
  if (assignedTo) {
    await notifyAgent({
      agentId: assignedTo._id,
      company: ticket.company,
      type: "assignment",
      message: `Ticket ${ticket.number} assigned to you`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
    const ctx = await ticketService.buildTicketContext(ticket);
    try {
      await emailService.sendFromTemplate({
        key: "ticket_assigned",
        to: assignedTo.email,
        data: { ...ctx, recipient: { name: assignedTo.name } },
        event: "ticket_assigned",
        ticket: ticket._id,
        user: ticket.user,
        company: ticket.company,
      });
    } catch (err) {
      /* non-blocking */
    }
  }
  res.json({ success: true, message: "Ticket assigned", ticket });
});
exports.transfer = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.transfer"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { deptId } = req.body;
  if (!deptId) throw new ApiError(422, "Select a department to transfer to");
  const dept = await Department.findOne({
    _id: deptId,
    company: ticket.company,
  });
  if (!dept) throw new ApiError(404, "Department not found in this tenant");
  ticket.dept = dept._id;
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Ticket transferred to ${dept.name} by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.transferred",
    entityType: "ticket",
    entityId: ticket._id,
    after: { deptId: dept._id, deptName: dept.name },
    req,
  });
  emit("ticket.transferred", {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    deptId: dept._id,
    actor: req.agent._id,
  });
  const deptAgents = await Agent.find({
    "departments.department": dept._id,
    isActive: true,
  });
  for (const a of deptAgents) {
    await notifyAgent({
      agentId: a._id,
      company: ticket.company,
      type: "transfer",
      message: `Ticket ${ticket.number} transferred to ${dept.name}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  res.json({ success: true, message: "Ticket transferred", ticket });
});
exports.changeStatus = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { status, closedReason, resolution } = req.body;
  const required = ["resolved", "closed"].includes(status)
    ? "tickets.close"
    : "tickets.edit";
  if (!hasPerm(req.agent, required)) {
    throw new ApiError(
      403,
      `You do not have permission to set tickets to ${status}`,
    );
  }
  await ticketService.applyStatusChange(ticket, status, {
    actorType: "agent",
    actorId: req.agent._id,
    actorName: req.agent.name,
    reason: closedReason || "",
    resolution: resolution || null,
    req,
  });
  res.json({ success: true, message: "Status updated", ticket });
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
    throw new ApiError(
      423,
      `Ticket is locked by ${locker?.name || "another agent"}`,
    );
  }
  ticket.lockedBy = req.agent._id;
  ticket.lockedAt = now;
  ticket.lockExpiresAt = new Date(now.getTime() + minutes * 60 * 1000);
  await ticket.save();
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.locked",
    entityType: "ticket",
    entityId: ticket._id,
    after: { lockedBy: req.agent._id, lockExpiresAt: ticket.lockExpiresAt },
    req,
  });
  res.json({ success: true, message: "Ticket locked", ticket });
});
exports.unlockTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  if (ticket.lockedBy && String(ticket.lockedBy) !== String(req.agent._id)) {
    const locker = await Agent.findById(ticket.lockedBy);
    throw new ApiError(
      423,
      `Ticket is locked by ${locker?.name || "another agent"}`,
    );
  }
  ticket.lockedBy = null;
  ticket.lockedAt = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.unlocked",
    entityType: "ticket",
    entityId: ticket._id,
    after: { lockedBy: null, lockExpiresAt: null },
    req,
  });
  res.json({ success: true, message: "Ticket unlocked", ticket });
});
exports.updateFields = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.edit"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  const { subject, priority, dueDate, source, asset } = req.body;
  const before = {
    subject: ticket.subject,
    priority: ticket.priority,
    dueDate: ticket.dueDate,
    source: ticket.source,
    asset: ticket.asset,
  };
  const changed = [];
  if (subject !== undefined) {
    if (!String(subject).trim())
      throw new ApiError(422, "Subject cannot be empty");
    ticket.subject = String(subject).trim();
    changed.push("subject");
  }
  if (priority !== undefined) {
    await assertValidPriority(priority);
    ticket.priority = priority;
    changed.push("priority");
  }
  if (dueDate !== undefined) {
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (parsedDueDate && Number.isNaN(parsedDueDate.getTime()))
      throw new ApiError(422, "Invalid due date");
    ticket.dueDate = parsedDueDate;
    changed.push("due date");
  }
  if (source !== undefined) {
    if (!VALID_SOURCES.includes(source))
      throw new ApiError(422, "Invalid source");
    ticket.source = source;
    changed.push("source");
  }
  if (asset !== undefined) {
    if (asset) {
      const Asset = require("../../../models/Asset");
      const exists = await Asset.exists({ _id: asset, company: req.companyId });
      if (!exists) throw new ApiError(404, "Asset not found in this tenant");
    }
    ticket.asset = asset || null;
    changed.push("asset");
  }
  if (!changed.length) throw new ApiError(422, "Nothing to update");
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Fields updated (${changed.join(", ")}) by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.fields_updated",
    entityType: "ticket",
    entityId: ticket._id,
    before,
    after: {
      subject: ticket.subject,
      priority: ticket.priority,
      dueDate: ticket.dueDate,
      source: ticket.source,
      asset: ticket.asset,
    },
    req,
  });
  res.json({ success: true, message: "Ticket updated", ticket });
});
exports.claim = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.assign"))
    throw new ApiError(403, "Permission denied");
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  assertNotLocked(ticket, req.agent);
  if (ticket.agent && String(ticket.agent) !== String(req.agent._id)) {
    const holder = await Agent.findById(ticket.agent);
    throw new ApiError(
      409,
      `Ticket is already assigned to ${holder?.name || "another agent"}`,
    );
  }
  const claimed = !ticket.agent;
  ticket.agent = req.agent._id;
  ticket.team = null;
  ticket.status = Ticket.STATUSES.ASSIGNED;
  ticket.isOverdue = false;
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `${req.agent.name} ${claimed ? "claimed" : "took over"} this ticket`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.claimed",
    entityType: "ticket",
    entityId: ticket._id,
    after: { agentId: req.agent._id, claimed },
    req,
  });
  emit("ticket.claimed", {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    agentId: req.agent._id,
    actor: req.agent._id,
  });
  res.json({ success: true, message: "Ticket claimed", ticket });
});
exports.create = asyncHandler(async (req, res) => {
  if (!hasPerm(req.agent, "tickets.create"))
    throw new ApiError(403, "Permission denied");
  const {
    email,
    name,
    phone,
    subject,
    details,
    priority,
    impact,
    urgency,
    topicId,
    deptId,
    source,
    customData,
  } = req.body;
  if (!email) throw new ApiError(422, "Customer email is required");
  if (!subject || !String(subject).trim())
    throw new ApiError(422, "Subject is required");
  for (const [key, value] of [
    ["impact", impact],
    ["urgency", urgency],
  ]) {
    if (
      value !== undefined &&
      value !== null &&
      !["low", "medium", "high"].includes(value)
    ) {
      throw new ApiError(422, `Invalid ${key} (low, medium, high)`);
    }
  }
  const user = await ticketService.findOrCreateUser({
    name: name || email.split("@")[0],
    email,
    phone: phone || "",
    company: req.companyId,
  });
  let parsedCustom = {};
  if (customData) {
    try {
      parsedCustom =
        typeof customData === "string" ? JSON.parse(customData) : customData;
    } catch (err) {
      throw new ApiError(422, "Invalid custom field data");
    }
  }
  const ticket = await ticketService.createTicket({
    user,
    orgOwner: user._id,
    createdBy: user._id,
    subject: String(subject).trim(),
    details: details || "",
    topicId: topicId || undefined,
    deptId: deptId || undefined,
    priority:
      priority && (await isValidPriority(priority)) ? priority : undefined,
    impact: impact || undefined,
    urgency: urgency || undefined,
    source: VALID_SOURCES.includes(source) ? source : "web",
    customData: parsedCustom,
    auditActorType: "agent",
    auditActorId: req.agent._id,
    auditActorName: req.agent.name,
    req,
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
  if (!email) throw new ApiError(422, "Email is required");
  const user = await ticketService.findOrCreateUser({
    name: name || email.split("@")[0],
    email,
    company: req.companyId,
  });
  if (String(ticket.user._id) === String(user._id)) {
    throw new ApiError(
      400,
      "The ticket owner is already involved in this ticket",
    );
  }
  const existing = (ticket.collaborators || []).some(
    (c) => c && String(c._id) === String(user._id),
  );
  if (existing) throw new ApiError(409, "This user is already a collaborator");
  await Ticket.updateOne(
    { _id: ticket._id },
    { $addToSet: { collaborators: user._id } },
  );
  await ticketService.addSystemEvent({
    ticket,
    message: `${user.name} (${user.email}) added as collaborator by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.collaborator_added",
    entityType: "ticket",
    entityId: ticket._id,
    after: { collaboratorId: user._id },
    req,
  });
  await notifyUser({
    userId: user._id,
    company: ticket.company,
    type: "collaborator",
    message: `You have been added as a collaborator on ticket ${ticket.number}`,
    link: `/ticket/${ticket.number}`,
    ticket: ticket._id,
  });
  const updated = await Ticket.findById(ticket._id).populate(
    "collaborators",
    "name email",
  );
  res.json({ success: true, message: "Collaborator added", ticket: updated });
});
exports.removeCollaborator = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent);
  const existing = (ticket.collaborators || []).some(
    (c) => c && String(c._id || c) === String(req.params.userId),
  );
  if (!existing)
    throw new ApiError(404, "Collaborator not found on this ticket");
  await Ticket.updateOne(
    { _id: ticket._id },
    { $pull: { collaborators: req.params.userId } },
  );
  await ticketService.addSystemEvent({
    ticket,
    message: `Collaborator removed by ${req.agent.name}`,
  });
  await auditRequired({
    company: ticket.company,
    actorType: "agent",
    actor: req.agent._id,
    actorName: req.agent.name,
    action: "ticket.collaborator_removed",
    entityType: "ticket",
    entityId: ticket._id,
    before: { collaboratorId: req.params.userId },
    after: { collaboratorId: null },
    req,
  });
  const updated = await Ticket.findById(ticket._id).populate(
    "collaborators",
    "name email",
  );
  res.json({ success: true, message: "Collaborator removed", ticket: updated });
});
