const asyncHandler = require('../utils/asyncHandler');
const statusPageService = require('../services/statusPage.service');
const chatService = require('../services/chat.service');
const csatService = require('../services/csat.service');
const Ticket = require('../models/Ticket');
const Survey = require('../models/Survey');
const ServiceCatalogItem = require('../models/ServiceCatalogItem');
const ApiError = require('../utils/ApiError');

// Public status page (no auth) — white-labelable via slug + branding
exports.statusPage = asyncHandler(async (req, res) => {
  const data = await statusPageService.publicStatus(req.params.slug);
  if (!data) throw new ApiError(404, 'Status page not found');
  res.json({ success: true, ...data });
});

// Tenant's own status page for the logged-in customer portal
exports.myStatus = asyncHandler(async (req, res) => {
  const company = req.companyId || req.user?.company || null;
  const StatusPage = require('../models/StatusPage');
  let page = await StatusPage.findOne({ company: company || null });
  if (!page) page = await StatusPage.findOne({ isPublic: true }).sort({ createdAt: 1 });
  if (!page) throw new ApiError(404, 'Status page not found');
  const data = await statusPageService.publicStatus(page.slug);
  res.json({ success: true, ...data });
});

// Guest / registered chat start
exports.chatStart = asyncHandler(async (req, res) => {
  const { company: companyBody, companyId, userId, guestName, guestEmail, guestPhone, subject, channel } = req.body;
  let company = companyBody || companyId;
  if (!company && !userId) {
    const Company = require('../models/Company');
    company = (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  }
  const conversation = await chatService.startConversation({
    company: company || null,
    channel: channel || 'chat',
    userId: userId || null,
    guestName: guestName || '',
    guestEmail: guestEmail || '',
    guestPhone: guestPhone || '',
    subject: subject || '',
  });
  res.status(201).json({ success: true, item: conversation });
});

exports.chatMessages = asyncHandler(async (req, res) => {
  const data = await chatService.conversationDetail(req.params.id);
  if (!data) throw new ApiError(404, 'Conversation not found');
  res.json({ success: true, ...data });
});

exports.chatPost = asyncHandler(async (req, res) => {
  const { body, userId, guestEmail, guestName, subject } = req.body;
  if (!body) throw new ApiError(422, 'Message body required');
  let conversation = await require('../models/Conversation').findById(req.params.id);
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  const Company = require('../models/Company');
  const fallbackCompany = conversation.company || (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  const ticketService = require('../services/ticket.service');
  let user = null;
  if (userId) user = await require('../models/User').findById(userId);
  else if (guestEmail) {
    user = await ticketService.findOrCreateUser({ name: guestName || guestEmail.split('@')[0], email: guestEmail, company: fallbackCompany });
    conversation.user = user._id;
    await conversation.save();
  }
  const message = await chatService.postMessage({
    company: fallbackCompany,
    conversationId: conversation._id,
    sender: 'user',
    userId: user?._id || null,
    body,
  });
  res.status(201).json({ success: true, item: message });
});

exports.chatClose = asyncHandler(async (req, res) => {
  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findByIdAndUpdate(req.params.id, { $set: { status: 'closed' } }, { new: true });
  if (!conv) throw new ApiError(404, 'Conversation not found');
  res.json({ success: true, item: conv });
});

// CSAT submission from the customer portal (ticket number + rating, optionally survey id)
exports.submitCsat = asyncHandler(async (req, res) => {
  const { ticketNumber, rating, comment, surveyId } = req.body;
  if (!ticketNumber || rating == null) throw new ApiError(422, 'ticketNumber and rating required');
  const ticket = await Ticket.findOne({ number: String(ticketNumber).toUpperCase() });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const survey = surveyId ? await Survey.findById(surveyId) : await Survey.findOne({ company: ticket.company, type: 'csat', isActive: true });
  if (!survey) throw new ApiError(404, 'No CSAT survey configured');
  const response = await csatService.submitResponse({
    company: ticket.company,
    surveyId: survey._id,
    ticketId: ticket._id,
    userId: ticket.user,
    rating,
    comment: comment || '',
  });
  res.status(201).json({ success: true, item: response });
});

// Customer-facing service catalog for the user's tenant
exports.serviceCatalog = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const user = req.user ? await User.findById(req.user._id) : null;
  let company = req.companyId || user?.company || null;
  if (!company) {
    const Company = require('../models/Company');
    company = (await Company.findOne().sort({ createdAt: 1 }))?._id || null;
  }
  const items = await ServiceCatalogItem.find({ company, visibleInPortal: true, isActive: true })
    .populate('helpTopic', 'topic')
    .populate('department', 'name')
    .populate('sla', 'name')
    .populate('formId', 'name')
    .sort({ category: 1, sortOrder: 1 });
  res.json({ success: true, items });
});

exports.surveysForTicket = asyncHandler(async (req, res) => {
  const { ticketNumber } = req.params;
  const ticket = await Ticket.findOne({ number: String(ticketNumber).toUpperCase() });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const surveys = await Survey.find({ company: ticket.company, isActive: true }).select('name type question scale');
  res.json({ success: true, items: surveys, ticket: { number: ticket.number, status: ticket.status } });
});