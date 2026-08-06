const User = require('../models/User');
const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const HelpTopic = require('../models/HelpTopic');
const Department = require('../models/Department');
const SystemSetting = require('../models/SystemSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const ticketService = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { notifyAgent } = require('../services/notification.service');

exports.openForm = asyncHandler(async (req, res) => {
  const [topics, departments, settings] = await Promise.all([
    HelpTopic.find({ status: 'active', isPublic: true }).sort({ topic: 1 }).populate('department', 'name'),
    Department.find({ status: 'active', isPublic: true }).sort({ name: 1 }),
    SystemSetting.getSettings(),
  ]);
  res.json({ success: true, topics, departments, settings });
});

exports.getMyTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 10, sort: '-updatedAt' });
  const { status, q } = req.query;
  const query = { user: req.user._id, status: { $ne: Ticket.STATUSES.DELETED } };
  if (status && status !== 'all') query.status = status;
  if (q) query.subject = { $regex: q, $options: 'i' };

  const [items, total] = await Promise.all([
    Ticket.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('dept', 'name'),
    Ticket.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.create = asyncHandler(async (req, res) => {
  const { subject, details, topic, priority, customData } = req.body;
  if (!subject || !details) throw new ApiError(422, 'Subject and details are required');

  let user = req.user;
  let authToken = null;
  if (!user) {
    const { name, email, phone } = req.body;
    if (!name || !email) throw new ApiError(422, 'Name and email are required to open a ticket');
    user = await ticketService.findOrCreateUser({ name, email, phone });
  }

  const attachments = (req.files || []).map((f) => ({
    filename: f.originalname,
    path: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));

  const ticket = await ticketService.createTicket({
    user,
    subject,
    details,
    topicId: topic || null,
    priority,
    source: 'web',
    attachments,
    customData: customData ? JSON.parse(customData) : {},
  });

  if (req.files && req.files.length) {
    res.status(201).json({ success: true, ticket });
  } else {
    res.status(201).json({ success: true, ticket });
  }
});

exports.checkTicketStatus = asyncHandler(async (req, res) => {
  const { email, number } = req.query;
  if (!email || !number) throw new ApiError(422, 'Email and ticket number are required');
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(404, 'No tickets found for the email provided');
  const ticket = await Ticket.findOne({
    number: String(number).trim().toUpperCase(),
    user: user._id,
    status: { $ne: Ticket.STATUSES.DELETED },
  })
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name')
    .populate('team', 'name');
  if (!ticket) throw new ApiError(404, 'No ticket found matching your email and ticket number');
  res.json({ success: true, ticket });
});

const loadTicketWithAccess = async (req, needOwner = false) => {
  const ticket = await Ticket.findOne({
    number: String(req.params.number).trim().toUpperCase(),
    status: { $ne: Ticket.STATUSES.DELETED },
  })
    .populate('dept', 'name')
    .populate('topic', 'topic')
    .populate('agent', 'name')
    .populate('team', 'name')
    .populate('sla', 'name');
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (needOwner) {
    if (!req.user || String(ticket.user) !== String(req.user._id)) {
      throw new ApiError(403, 'You do not have access to this ticket');
    }
  }
  return ticket;
};

exports.viewTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, false);
  const isOwner = req.user && String(ticket.user) === String(req.user._id);
  if (!isOwner) throw new ApiError(403, 'You do not have access to this ticket');
  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null, type: { $ne: 'note' } }).sort({ createdAt: 1 });
  res.json({ success: true, ticket, threads });
});

exports.reply = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, true);
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

  const ctx = await ticketService.buildTicketContext(ticket);
  const agent = ticket.agent ? await require('../models/Agent').findById(ticket.agent) : null;

  if (agent) {
    await notifyAgent({
      agentId: agent._id,
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
      });
    } catch (err) {
      // non-blocking
    }
  }

  const threads = await TicketThread.find({ ticket: ticket._id, deletedAt: null, type: { $ne: 'note' } }).sort({ createdAt: 1 });
  res.json({ success: true, message: 'Reply posted', ticket, threads });
});

exports.closeTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, true);
  if (ticket.status === Ticket.STATUSES.CLOSED) {
    throw new ApiError(400, 'Ticket is already closed');
  }
  ticket.status = Ticket.STATUSES.CLOSED;
  ticket.closedAt = new Date();
  ticket.lockedBy = null;
  ticket.lockExpiresAt = null;
  await ticket.save();
  await ticketService.addSystemEvent({ ticket, message: 'Ticket closed by user' });
  res.json({ success: true, message: 'Ticket closed' });
});

exports.reopenTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketWithAccess(req, true);
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
  res.json({ success: true, message: 'Ticket reopened' });
});
