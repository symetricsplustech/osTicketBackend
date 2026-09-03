const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const HelpTopic = require('../models/HelpTopic');
const Department = require('../models/Department');
const Team = require('../models/Team');
const SystemSetting = require('../models/SystemSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const ticketService = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { notifyAgent, notifyUser } = require('../services/notification.service');
const { getOrgOwner, hasPermission, USER_PERMISSIONS } = require('../utils/userPermissions');
const config = require('../config/config');
const CustomField = require('../models/CustomField');
const TicketForm = require('../models/TicketForm');

exports.openForm = asyncHandler(async (req, res) => {
  const companyId = req.companyId || (req.query.company && req.query.company !== 'null' ? req.query.company : null);
  const topicQuery = { status: 'active', isPublic: true };
  const deptQuery = { status: 'active', isPublic: true };
  if (companyId) {
    topicQuery.$or = [{ company: companyId }, { company: null }];
    deptQuery.$or = [{ company: companyId }, { company: null }];
  }
  const fieldQuery = companyId ? { isActive: true, $or: [{ company: companyId }, { company: null }] } : { isActive: true };
  const formQuery = companyId ? { isActive: true, $or: [{ company: companyId }, { company: null }] } : { isActive: true };
  const [topics, departments, settings, customFields, forms, priorities] = await Promise.all([
    HelpTopic.find(topicQuery).sort({ topic: 1 }).populate('department', 'name'),
    Department.find(deptQuery).sort({ name: 1 }),
    SystemSetting.getSettings(),
    CustomField.find(fieldQuery).sort({ sortOrder: 1 }).populate('helpTopic', 'topic'),
    TicketForm.find(formQuery).sort({ name: 1 }).populate('helpTopic', 'topic').populate('fields'),
    (async () => {
      const { listPriorities } = require('../services/priority.service');
      return listPriorities(companyId);
    })(),
  ]);
  const emailToTicket = settings.system?.emailToTicket || config.email.emailToTicket || '';
  // Per-organisation support inbox: the ONE mail the customer of this hired
  // organisation must send to so tickets auto-create without portal login.
  let supportInbox = emailToTicket;
  let supportCompany = null;
  try {
    if (companyId) {
      const Company = require('../models/Company');
      const co = await Company.findById(companyId).select('name email supportEmail domain');
      if (co) {
        supportCompany = { _id: co._id, name: co.name };
        supportInbox = co.supportEmail || co.email || emailToTicket;
      }
    }
  } catch (_) { /* non-blocking */ }
  res.json({ success: true, topics, departments, settings, emailToTicket, supportInbox, supportCompany, customFields, forms, priorities });
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  if (!hasPermission(req.user, USER_PERMISSIONS.TICKET_VIEW)) {
    throw new ApiError(403, 'You do not have permission to view tickets');
  }
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 10, sort: '-updatedAt' });
  const { status, q } = req.query;
  const query = { user: getOrgOwner(req.user), status: { $ne: Ticket.STATUSES.DELETED } };
  if (status && status !== 'all') query.status = status;
  if (q) query.subject = { $regex: q, $options: 'i' };

  const [items, total] = await Promise.all([
    Ticket.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('dept', 'name').populate('createdBy', 'name'),
    Ticket.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const { subject, details, topic, priority, customData } = req.body;
  if (!String(subject || '').trim() || !String(details || '').trim()) throw new ApiError(422, 'Subject and details are required');
  let parsedCustom = {};
  if (customData) {
    try {
      parsedCustom = typeof customData === 'string' ? JSON.parse(customData) : customData;
    } catch (err) {
      throw new ApiError(422, 'Invalid custom field data');
    }
  }

  const user = req.user;
  if (!hasPermission(user, USER_PERMISSIONS.TICKET_CREATE)) {
    throw new ApiError(403, 'You do not have permission to create tickets');
  }

  const companyId = req.companyId;
  if (topic) {
    const topicQuery = { _id: topic, status: 'active', isPublic: true };
    if (companyId) topicQuery.$or = [{ company: companyId }, { company: null }];
    const selectedTopic = await HelpTopic.findOne(topicQuery).select('_id');
    if (!selectedTopic) throw new ApiError(422, 'Invalid help topic');
  }

  if (priority) {
    const { isValidPriority } = require('../services/priority.service');
    if (!(await isValidPriority(priority, companyId))) throw new ApiError(422, 'Invalid ticket priority');
  }

  const ticketOwner = getOrgOwner(user) || user._id;
  const attachments = (req.files || []).map((f) => ({
    filename: f.originalname,
    path: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));

  const ticket = await ticketService.createTicket({
    user,
    orgOwner: ticketOwner,
    createdBy: user._id,
    subject: subject.trim(),
    details: details.trim(),
    topicId: topic || null,
    priority,
    source: 'web',
    attachments,
    customData: parsedCustom,
  });

  if (String(ticketOwner) !== String(user._id)) {
    await notifyUser({
      userId: ticketOwner,
      company: ticket.company || null,
      type: 'new_ticket',
      message: `New ticket ${ticket.number} created by ${user.name}: ${ticket.subject}`,
      link: `/ticket/${ticket.number}`,
      ticket: ticket._id,
    });
  }

  res.status(201).json({ success: true, ticket });
});

exports.checkTicketStatus = asyncHandler(async (req, res) => {
  const { email, number } = req.query;
  if (!email || !number) throw new ApiError(422, 'Email and ticket number are required');
  const userQuery = { email: email.toLowerCase() };
  if (req.companyId) userQuery.company = req.companyId;
  const user = await User.findOne(userQuery);
  if (!user) throw new ApiError(404, 'No tickets found for the email provided');
  const ticketQuery = {
    number: String(number).trim().toUpperCase(),
    user: user._id,
    status: { $ne: Ticket.STATUSES.DELETED },
  };
  if (req.companyId) ticketQuery.company = req.companyId;
  const ticket = await Ticket.findOne(ticketQuery)
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name')
    .populate('team', 'name');
  if (!ticket) throw new ApiError(404, 'No ticket found matching your email and ticket number');
  res.json({ success: true, ticket });
});

const loadTicketWithAccess = async (req, { requirePermission = null } = {}) => {
  const ticket = await Ticket.findOne({
    number: String(req.params.number).trim().toUpperCase(),
    status: { $ne: Ticket.STATUSES.DELETED },
  })
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name')
    .populate('team', 'name')
    .populate('sla', 'name')
    .populate('createdBy', 'name');
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const ownerId = getOrgOwner(req.user);
  if (!ownerId || String(ticket.user) !== String(ownerId)) {
    throw new ApiError(403, 'You do not have access to this ticket');
  }
  if (req.companyId && ticket.company && String(ticket.company) !== String(req.companyId)) {
    throw new ApiError(403, 'You do not have access to this ticket');
  }
  if (requirePermission && !hasPermission(req.user, requirePermission)) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }
  return ticket;
};

const notifyOwnerOfEmployeeAction = async ({ ticket, user, type, action }) => {
  if (!user || !user.createdBy) return;
  const ownerId = ticket.user;
  if (!ownerId || String(ownerId) === String(user._id)) return;
  await notifyUser({
    userId: ownerId,
    company: ticket.company || null,
    type,
    message: `Employee ${user.name} ${action} on ticket ${ticket.number}`,
    link: `/ticket/${ticket.number}`,
    ticket: ticket._id,
  });
};

exports.viewTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, { requirePermission: USER_PERMISSIONS.TICKET_VIEW });
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null, type: { $ne: 'note' } }).sort({ createdAt: 1 });
  res.json({ success: true, ticket, threads });
});

exports.reply = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, { requirePermission: USER_PERMISSIONS.TICKET_REPLY });
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
    posterType: 'user',
    user: req.user,
    body: message,
    attachments,
  });

  require('../services/audit.service').audit({ company: ticket.company || req.companyId || null, actorType: 'user', actor: req.user._id, actorName: req.user.name, action: 'ticket.comment_added', entityType: 'ticket', entityId: ticket._id, after: { attachmentCount: attachments.length, hasAttachments: attachments.length > 0 }, req });
  await notifyOwnerOfEmployeeAction({ ticket, user: req.user, type: 'reply', action: 'replied' });

  const ctx = await ticketService.buildTicketContext(ticket);
  const agent = ticket.agent ? await require('../models/Agent').findById(ticket.agent) : null;

  if (agent) {
    await notifyAgent({
      agentId: agent._id,
      company: ticket.company,
      type: 'reply',
      message: `New reply on ticket ${ticket.number}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
    try {
      await emailService.sendFromTemplate({
        key: 'new_reply_alert',
        to: agent.email,
        data: { ...ctx, recipient: { name: agent.name } },
        event: 'new_reply_alert',
        ticket: ticket._id,
        user: req.user._id,
        company: ticket.company,
      });
    } catch (err) {
      // non-blocking
    }
  }

  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null, type: { $ne: 'note' } }).sort({ createdAt: 1 });
  res.json({ success: true, message: 'Reply posted', ticket, threads });
});

exports.closeTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, { requirePermission: USER_PERMISSIONS.TICKET_REPLY });
  if (ticket.status === Ticket.STATUSES.CLOSED) {
    throw new ApiError(400, 'Ticket is already closed');
  }
  ticket.status = Ticket.STATUSES.CLOSED;
  ticket.closedAt = new Date();
  ticket.lockedBy = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: 'Ticket closed by user' });
  await notifyOwnerOfEmployeeAction({ ticket, user: req.user, type: 'status_change', action: 'closed' });
  await ticketService.handleTicketClosed(ticket, { actor: req.user?._id || null });
  res.json({ success: true, message: 'Ticket closed' });
});

exports.reopenTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, { requirePermission: USER_PERMISSIONS.TICKET_REPLY });
  const settings = await SystemSetting.getSettings();
  if (settings.system.allowTicketReopen === false) {
    throw new ApiError(400, 'Ticket reopening is disabled');
  }
  if (ticket.status !== Ticket.STATUSES.CLOSED) {
    throw new ApiError(400, 'Ticket is not closed');
  }
  ticket.status = Ticket.STATUSES.OPEN;
  ticket.closedAt = null;
  ticket.closedBy = null;
  ticket.stats.reopened += 1;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: 'Ticket reopened by user' });
  await notifyOwnerOfEmployeeAction({ ticket, user: req.user, type: 'status_change', action: 'reopened' });
  await ticketService.handleTicketReopened(ticket);
  res.json({ success: true, message: 'Ticket reopened' });
});

exports.mergeTickets = asyncHandler(async (req, res) => {
  const { targetTicketId } = req.body;
  const sourceTicketId = req.ticket._id;
  if (!targetTicketId || targetTicketId === String(sourceTicketId)) {
    throw new ApiError(400, 'Valid target ticket ID is required');
  }
  const targetTicket = await Ticket.findById(targetTicketId).lean();
  if (!targetTicket) throw new ApiError(404, 'Target ticket not found');
  const sourceTicket = await Ticket.findById(sourceTicketId).lean();
  if (!sourceTicket) throw new ApiError(404, 'Source ticket not found');
  if (sourceTicket.user._id.equals(targetTicket.user._id)) {
    throw new ApiError(400, 'Cannot merge a ticket into itself or a ticket in the same user account');
  }
  const mergedTicket = await Ticket.findByIdAndUpdate(
    targetTicket._id,
    {
      $push: { messages: { $each: sourceTicket.messages } },
      $addToSet: { collaborators: { $each: sourceTicket.collaborators } },
    },
    { new: true, runValidators: true }
  );
  await Ticket.findByIdAndDelete(sourceTicket._id);
  res.json({ success: true, message: 'Tickets merged successfully', ticket: mergedTicket });
});

exports.linkTickets = asyncHandler(async (req, res) => {
  const { targetTicketId } = req.body;
  const sourceTicketId = req.ticket._id;
  if (!targetTicketId || targetTicketId === String(sourceTicketId)) {
    throw new ApiError(400, 'Valid target ticket ID is required');
  }
  const targetTicket = await Ticket.findById(targetTicketId).lean();
  if (!targetTicket) throw new ApiError(404, 'Target ticket not found');
  const sourceTicket = await Ticket.findById(sourceTicketId).lean();
  if (!sourceTicket) throw new ApiError(404, 'Source ticket not found');
  const linked = sourceTicket.linkedTickets.includes(targetTicket._id);
  if (linked) {
    throw new ApiError(400, 'Tickets are already linked');
  }
  await Ticket.updateOne(
    { _id: sourceTicket._id },
    { $addToSet: { linkedTickets: targetTicket._id } }
  );
  await Ticket.updateOne(
    { _id: targetTicket._id },
    { $addToSet: { linkedTickets: sourceTicket._id } }
  );
  res.json({ success: true, message: 'Tickets linked successfully' });
});

exports.referTicket = asyncHandler(async (req, res) => {
  const { targetUserId, targetTeamId, targetDeptId, reason } = req.body;
  const sourceTicketId = req.ticket._id;
  if (!targetUserId && !targetTeamId && !targetDeptId) {
    throw new ApiError(400, 'At least one target (user, team, or department) is required');
  }
  const sourceTicket = await Ticket.findById(sourceTicketId);
  if (!sourceTicket) throw new ApiError(404, 'Source ticket not found');
  const referral = {
    ticket: sourceTicket._id,
    referredBy: sourceTicket.user._id,
    reason,
    createdAt: new Date(),
  };
  if (targetUserId) {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new ApiError(404, 'Target user not found');
    targetUser.referredTickets = targetUser.referredTickets || [];
    targetUser.referredTickets.push(referral);
    await targetUser.save();
  }
  if (targetTeamId) {
    const targetTeam = await Team.findById(targetTeamId);
    if (!targetTeam) throw new ApiError(404, 'Target team not found');
    targetTeam.referredTickets = targetTeam.referredTickets || [];
    targetTeam.referredTickets.push(referral);
    await targetTeam.save();
  }
  if (targetDeptId) {
    const targetDept = await Department.findById(targetDeptId);
    if (!targetDept) throw new ApiError(404, 'Target department not found');
    targetDept.referredTickets = targetDept.referredTickets || [];
    targetDept.referredTickets.push(referral);
    await targetDept.save();
  }
  res.json({ success: true, message: 'Ticket referred successfully' });
});

exports.deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, { requirePermission: USER_PERMISSIONS.TICKET_DELETE });
  ticket.status = Ticket.STATUSES.DELETED;
  ticket.lockedBy = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: 'Ticket deleted by user' });
  await notifyOwnerOfEmployeeAction({ ticket, user: req.user, type: 'status_change', action: 'deleted' });
  res.json({ success: true, message: 'Ticket deleted' });
});
